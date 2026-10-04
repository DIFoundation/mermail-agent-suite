import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type OAuthClientInformationContext,
  type OAuthClientInformationMixed,
  type OAuthClientMetadata,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
  type OAuthTokens,
} from "@modelcontextprotocol/client";

const MERMAIL_MCP_URL =
  process.env.MERMAIL_MCP_URL ?? "https://console.mermail.app/mcp";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const MERMAIL_OAUTH_REDIRECT_URI =
  process.env.MERMAIL_OAUTH_REDIRECT_URI ??
  `${APP_URL}/api/mermail/oauth/callback`;

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "mermail-oauth-sessions.enc");

interface OAuthSessionState {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
  discoveryState?: OAuthDiscoveryState;
  state?: string;
  authorizationUrl?: string;
}

type OAuthSessionStore = Record<string, OAuthSessionState>;

function getEncryptionKey(): Buffer {
  const secret = process.env.MERMAIL_OAUTH_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "MERMAIL_OAUTH_SESSION_SECRET is required for OAuth session storage",
    );
  }

  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decrypt(value: string): string {
  const [ivValue, authTagValue, encryptedValue] = value.split(".");

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Invalid encrypted OAuth session store");
  }

  const iv = Buffer.from(ivValue, "base64url");
  const authTag = Buffer.from(authTagValue, "base64url");
  const encrypted = Buffer.from(encryptedValue, "base64url");

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

async function readStore(): Promise<OAuthSessionStore> {
  try {
    const encrypted = await readFile(STORE_FILE, "utf8");

    return JSON.parse(decrypt(encrypted)) as OAuthSessionStore;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeStore(store: OAuthSessionStore): Promise<void> {
  await mkdir(STORE_DIR, {
    recursive: true,
  });

  const encrypted = encrypt(JSON.stringify(store));

  const temporaryFile = `${STORE_FILE}.${randomUUID()}.tmp`;

  await writeFile(temporaryFile, encrypted, {
    encoding: "utf8",
    mode: 0o600,
  });

  await rename(temporaryFile, STORE_FILE);
}

async function updateSession(
  sessionId: string,
  update: (session: OAuthSessionState) => void,
): Promise<void> {
  const store = await readStore();

  const session = store[sessionId] ?? {};

  update(session);

  store[sessionId] = session;

  await writeStore(store);
}

async function getSession(
  sessionId: string,
): Promise<OAuthSessionState | undefined> {
  const store = await readStore();

  return store[sessionId];
}

export async function createOAuthSession(): Promise<string> {
  const sessionId = randomUUID();

  const store = await readStore();

  store[sessionId] = {};

  await writeStore(store);

  return sessionId;
}

export async function hasOAuthSession(sessionId: string): Promise<boolean> {
  return Boolean(await getSession(sessionId));
}

export async function deleteOAuthSession(sessionId: string): Promise<void> {
  const store = await readStore();

  delete store[sessionId];

  await writeStore(store);
}

export function createMermailOAuthProvider(
  sessionId: string,
): OAuthClientProvider {
  const clientMetadata: OAuthClientMetadata = {
    client_name: "Mermail Agent Suite",
    redirect_uris: [MERMAIL_OAUTH_REDIRECT_URI],
    response_types: ["code"],
    grant_types: ["authorization_code", "refresh_token"],
    token_endpoint_auth_method: "none",
  };

  return {
    redirectUrl: MERMAIL_OAUTH_REDIRECT_URI,

    clientMetadata,

    async clientInformation(_ctx?: OAuthClientInformationContext) {
      const session = await getSession(sessionId);

      return session?.clientInformation;
    },

    async saveClientInformation(
      information: OAuthClientInformationMixed,
      _ctx?: OAuthClientInformationContext,
    ) {
      await updateSession(sessionId, (session) => {
        session.clientInformation = information;
      });
    },

    async tokens(_ctx?: OAuthClientInformationContext) {
      const session = await getSession(sessionId);

      return session?.tokens;
    },

    async saveTokens(
      tokens: OAuthTokens,
      _ctx?: OAuthClientInformationContext,
    ) {
      await updateSession(sessionId, (session) => {
        session.tokens = tokens;
      });
    },

    async state() {
      const state = randomUUID();

      await updateSession(sessionId, (session) => {
        session.state = state;
      });

      return state;
    },

    async saveCodeVerifier(codeVerifier: string) {
      await updateSession(sessionId, (session) => {
        session.codeVerifier = codeVerifier;
      });
    },

    async codeVerifier() {
      const session = await getSession(sessionId);

      if (!session?.codeVerifier) {
        throw new Error("OAuth PKCE code verifier is missing");
      }

      return session.codeVerifier;
    },

    async saveDiscoveryState(discoveryState: OAuthDiscoveryState) {
      await updateSession(sessionId, (session) => {
        session.discoveryState = discoveryState;
      });
    },

    async discoveryState() {
      const session = await getSession(sessionId);

      return session?.discoveryState;
    },

    async redirectToAuthorization(authorizationUrl: URL) {
      await updateSession(sessionId, (session) => {
        session.authorizationUrl = authorizationUrl.toString();
      });
    },
  };
}

export async function getOAuthAuthorizationUrl(
  sessionId: string,
): Promise<string | undefined> {
  const session = await getSession(sessionId);

  return session?.authorizationUrl;
}

export async function getOAuthState(
  sessionId: string,
): Promise<string | undefined> {
  const session = await getSession(sessionId);

  return session?.state;
}

export function getMermailMcpUrl(): URL {
  return new URL(MERMAIL_MCP_URL);
}
