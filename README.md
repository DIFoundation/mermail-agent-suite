# Mermail Agent Suite

A security-first application for turning untrusted email communication into structured, controlled actions. The system enforces explicit boundaries between communication, interpretation, authorization, and execution.

## Core Components

- **Mermail Sentinel** — inspect untrusted inbound email and produce a structured safety clearance (CLEAR/REVIEW/BLOCK). Detects prompt injection, credential harvesting, payment pressure, and other threats.
- **Commerce Bridge** — convert approved, cleared requests into structured payment workflows with a full state machine. Never treats email content as payment authorization.
- **Mermail Integration** — connect to live Mermail inbox via MCP for real email processing, with a demo mode for development.
- **Payment Execution** — execute approved payments through pluggable payment providers with validation and audit trails.

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
| Commerce Extraction   |
| extract payment       |
| request from email    |
+-----------+-----------+
            |
            v
+-----------------------+
| Commerce Bridge       |
| workflow state machine |
| quote / approval      |
+-----------+-----------+
            |
            v
+-----------------------+
| Human Approval        |
| explicit authorization|
+-----------+-----------+
            |
            v
+-----------------------+
| Payment Execution     |
| execute / receipt     |
+-----------+-----------+
            |
            v
      Audit Trail
```

## Why this design

Mermail's safety model treats email subjects, bodies, headers, links, attachments and tool output as untrusted data. This system enforces:

> **Email is data, not authority.**

An email may request an action, but an email must never be sufficient authorization to perform that action. All consequential actions require explicit human approval.

## Local demo

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

The demo supports two modes:
- **Demo mode** (default): Uses mock inbox data for development
- **Live mode**: Connects to real Mermail inbox via MCP (requires `MERMAIL_API_KEY` and `MERMAIL_INBOX_MODE=live`)

## Tests

```bash
pnpm test
```

Current test coverage: 42 tests passing

## Project Structure

```
mermail-agent-suite/
├── packages/core/          # Core business logic
│   ├── commerce/          # Commerce workflow state machine
│   ├── mermail/           # Mermail integration & normalization
│   └── payment/           # Payment execution interfaces
├── apps/demo/             # Next.js demo application
│   ├── app/api/           # API routes
│   ├── lib/               # Integration logic
│   └── lib/mermail/       # Mermail MCP & OAuth providers
└── tests/                 # Integration tests
```

## Key Features

### Sentinel Security
- CLEAR/REVIEW/BLOCK classification
- 11 threat detection patterns (prompt injection, credential harvesting, payment pressure, etc.)
- Risk scoring (0-100)
- Structured security reasons

### Commerce Workflow
- Full state machine: REQUESTED → CLEARED → QUOTED → APPROVAL_REQUIRED → APPROVED → EXECUTING → COMPLETED/FAILED
- Quote validation with expiry checks
- Exact approval matching (recipient, amount, currency, purpose must match quote)
- Execution requires authoritative execution ID

### Payment Execution
- Pluggable payment providers
- Request validation
- Atomic unit conversion utilities
- Status tracking (SUBMITTED/PENDING/SETTLED/FAILED)

### Mermail Integration
- MCP client for live inbox access
- Message normalization
- Mailbox discovery and selection
- OAuth integration for authentication

## Environment Variables

For live Mermail integration:

```bash
MERMAIL_API_KEY=your_api_key
MERMAIL_MCP_URL=https://console.mermail.app/mcp
MERMAIL_MAILBOX_ID=your_mailbox_id  # optional
MERMAIL_INBOX_MODE=live
```

## Documentation

- [PROJECT_SPEC.md](./docs/PROJECT_SPEC.md) - Detailed product specification
- [STATUS.md](./docs/STATUS.md) - Implementation status
