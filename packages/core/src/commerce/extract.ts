export type CommerceExtractionStatus =
  | "MATCHED"
  | "INCOMPLETE"
  | "NOT_COMMERCE";

export interface ExtractedCommerceRequest {
  status: CommerceExtractionStatus;
  service?: string;
  recipient?: string;
  amount?: string;
  currency?: string;
  purpose?: string;
  missingFields: Array<
    "service" | "recipient" | "amount" | "currency" | "purpose"
  >;
  evidence: {
    amount?: string;
    recipient?: string;
    service?: string;
    purpose?: string;
  };
  isX402?: boolean;
  x402Url?: string;
}

const CURRENCY_PATTERN =
  /\b(USDT|USDC|USD|EUR|GBP|NGN|BTC|ETH|SOL|DAI)\b/i;

const AMOUNT_CURRENCY_PATTERN =
  /\b(?:of\s+)?([0-9]+(?:\.[0-9]+)?)\s*(USDT|USDC|USD|EUR|GBP|NGN|BTC|ETH|SOL|DAI)\b/i;

const CURRENCY_AMOUNT_PATTERN =
  /\b(USDT|USDC|USD|EUR|GBP|NGN|BTC|ETH|SOL|DAI)\s*([0-9]+(?:\.[0-9]+)?)\b/i;

const EVM_ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}\b/;

const SOLANA_ADDRESS_PATTERN = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i;

const X402_INDICATORS = [
  /\bx402\b/i,
  /\b402\s+payment\b/i,
  /\bpay-per-call\b/i,
  /\bpay-per-request\b/i,
  /\bpaid\s+api\b/i,
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractAmountAndCurrency(text: string) {
  const amountFirst = text.match(AMOUNT_CURRENCY_PATTERN);

  if (amountFirst) {
    return {
      amount: amountFirst[1],
      currency: amountFirst[2].toUpperCase(),
      evidence: amountFirst[0],
    };
  }

  const currencyFirst = text.match(CURRENCY_AMOUNT_PATTERN);

  if (currencyFirst) {
    return {
      amount: currencyFirst[2],
      currency: currencyFirst[1].toUpperCase(),
      evidence: currencyFirst[0],
    };
  }

  return {};
}

function extractRecipient(text: string) {
  const evm = text.match(EVM_ADDRESS_PATTERN);

  if (evm) {
    return {
      recipient: evm[0],
      evidence: evm[0],
    };
  }

  const solana = text.match(SOLANA_ADDRESS_PATTERN);

  if (solana) {
    return {
      recipient: solana[0],
      evidence: solana[0],
    };
  }

  return {};
}

function extractService(text: string) {
  const patterns = [
    /\bfor\s+(?:the\s+)?([^.?!\n]+?)\s+(?:service|services)\b/i,
    /\bfor\s+(?:the\s+)?([^.?!\n]+?)\s+API\b/i,
    /\b(?:service|services)\s*:\s*([^.?!\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return normalizeWhitespace(match[1]);
    }
  }

  return undefined;
}

function extractPurpose(text: string) {
  const patterns = [
    /\bfor\s+(?:the\s+)?(?:payment\s+of\s+)?(?:an?\s+)?([^.!?\n]+?)\s+(?:invoice|bill)\b/i,
    /\b(?:outstanding|unpaid|pending)\s+(?:invoice|bill)\b/i,
    /\b(?:invoice|bill)\s*(?:number|#|id)?\s*[:#-]?\s*([A-Za-z0-9_-]+)/i,
    /\bpurpose\s*:\s*([^.!?\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      if (match[1]) {
        return normalizeWhitespace(match[1]);
      }

      return normalizeWhitespace(match[0]);
    }
  }

  if (/\binvoice\b/i.test(text)) {
    return "invoice payment";
  }

  if (/\bsubscription\b/i.test(text)) {
    return "subscription payment";
  }

  if (/\bapi\b/i.test(text)) {
    return "API service payment";
  }

  return undefined;
}

function detectX402(text: string): boolean {
  return X402_INDICATORS.some((pattern) => pattern.test(text));
}

function extractUrl(text: string): string | undefined {
  const match = text.match(URL_PATTERN);
  return match?.[0];
}

export function extractCommerceRequest(input: {
  subject?: string;
  body: string;
}): ExtractedCommerceRequest {
  const text = normalizeWhitespace(
    `${input.subject ?? ""}\n${input.body ?? ""}`,
  );

  if (!text) {
    return {
      status: "NOT_COMMERCE",
      missingFields: [],
      evidence: {},
    };
  }

  const paymentIntent =
    /\b(pay|payment|payable|invoice|bill|transfer|send\s+funds|purchase|buy)\b/i.test(
      text,
    );

  if (!paymentIntent) {
    return {
      status: "NOT_COMMERCE",
      missingFields: [],
      evidence: {},
    };
  }

  const amount = extractAmountAndCurrency(text);
  const recipient = extractRecipient(text);
  const service = extractService(text);
  const purpose = extractPurpose(text);
  const isX402 = detectX402(text);
  const x402Url = isX402 ? extractUrl(text) : undefined;

  const missingFields: ExtractedCommerceRequest["missingFields"] = [];

  if (!service) missingFields.push("service");
  if (!recipient.recipient) missingFields.push("recipient");
  if (!amount.amount) missingFields.push("amount");
  if (!amount.currency) missingFields.push("currency");
  if (!purpose) missingFields.push("purpose");

  return {
    status: missingFields.length === 0 ? "MATCHED" : "INCOMPLETE",
    service,
    recipient: recipient.recipient,
    amount: amount.amount,
    currency: amount.currency,
    purpose,
    missingFields,
    evidence: {
      amount: amount.evidence,
      recipient: recipient.evidence,
      service,
      purpose,
    },
    isX402,
    x402Url,
  };
}
