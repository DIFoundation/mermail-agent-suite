# Mermail Agent Suite

Two composable Agent Skills demonstrating a safer and more capable Mermail workflow:

- **Mermail Sentinel** — inspect untrusted inbound agent mail and produce a structured safety clearance. It never sends mail or authorizes payments.
- **Mermail Commerce Bridge** — turn an approved, cleared request into a paid agent-service workflow using Mermail's existing Agent Wallet / x402 capabilities. It never treats email content as payment authorization.

## Architecture

```text
Incoming Mermail message
        |
        v
+-----------------------+
|   Mermail Sentinel    |
| identity / intent /   |
| injection / payment   |
| / link risk analysis  |
+-----------+-----------+
            |
       CLEAR / REVIEW / BLOCK
            |
            v
+-----------------------+
| Commerce Bridge       |
| service request       |
| quote / approval      |
| payment / execution   |
| result / receipt      |
+-----------+-----------+
            |
            v
      Mermail response
```

## Why this design

Mermail's current safety model treats email subjects, bodies, headers, links, attachments and tool output as untrusted data, and requires explicit approval for external effects. The two skills preserve that boundary while making it reusable across agent workflows.

## Local demo

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Tests

```bash
pnpm test
```

## Mermail integration

The production skills are intentionally written as portable Agent Skills. Live MCP tool names/payloads should be wired against the authenticated Mermail MCP connection rather than inventing an API surface. Mermail documents the hosted MCP endpoint and current Agent Wallet / PayBox flows in its official repositories.
