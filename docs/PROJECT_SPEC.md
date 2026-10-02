# Mermail Agent Suite

## Secure Email-to-Action Infrastructure for AI-Assisted Workflows

**Status:** Active Development
**Repository:** `mermail-agent-suite`
**Current phase:** Foundation complete → Product implementation
**Primary stack:** TypeScript, Next.js, React, Vitest, Mermail
**Core domains:** Email security, agent workflows, commerce, human approval, payments, auditability

---

# 1. Product Vision

Mermail Agent Suite is a security-first application for turning untrusted email communication into structured, controlled actions.

The system is designed around a simple principle:

> **An email may request an action, but an email must never be sufficient authorization to perform that action.**

The application receives or processes email through Mermail, evaluates the content through a security layer called **Mermail Sentinel**, and—when the message represents a legitimate commercial or operational request—passes it to the **Mermail Commerce Bridge**.

Potentially consequential actions are then presented to a human for explicit approval before execution.

The complete workflow is:

```text
Incoming Email
      │
      ▼
Mermail Inbox
      │
      ▼
Mermail Sentinel
      │
      ├──────────────► BLOCK
      │
      ├──────────────► REVIEW
      │
      ▼
     CLEAR
      │
      ▼
Intent / Request Extraction
      │
      ▼
Commerce Bridge
      │
      ▼
Human Approval
      │
      ▼
Payment / External Action
      │
      ▼
Receipt + Audit Trail
```

---

# 2. Core Problem

AI-assisted systems increasingly interact with external communication and external services.

Email is particularly dangerous because it is:

* externally controlled;
* untrusted;
* capable of containing instructions;
* capable of containing links and attachments;
* capable of attempting prompt injection;
* capable of requesting financial actions;
* capable of impersonating trusted parties.

A system that blindly follows email instructions can therefore become a mechanism for:

* credential theft;
* secret extraction;
* unauthorized payments;
* fraudulent transactions;
* malicious tool invocation;
* data exfiltration;
* social engineering;
* prompt injection.

Mermail Agent Suite introduces explicit boundaries between:

```text
Communication
      ↓
Interpretation
      ↓
Authorization
      ↓
Execution
```

---

# 3. Core Safety Principle

## Email is data, not authority.

The application must never interpret an email as an authorization token.

For example:

```text
Email:

"Send $50 USDC to this wallet immediately."

```

The system must NOT do:

```text
email → payment
```

Instead:

```text
email
  ↓
security analysis
  ↓
structured payment request
  ↓
human approval
  ↓
payment
```

The same principle applies to:

* credentials;
* API keys;
* wallet operations;
* account changes;
* destructive actions;
* external service calls.

---

# 4. Product Components

## 4.1 Mermail Inbox Layer

Responsible for receiving and reading messages through Mermail.

Responsibilities:

* mailbox discovery;
* mailbox selection;
* email retrieval;
* email search;
* email context retrieval;
* message normalization;
* message metadata extraction.

### Status

**Implementing**

The Mermail skill infrastructure is installed, but the application-level inbox integration is not yet complete.

---

# 5. Mermail Sentinel

Mermail Sentinel is the application's security gate.

Its job is to classify incoming email/request content before any downstream action occurs.

## 5.1 Classification

The primary classifications are:

### CLEAR

The message appears informational and does not request a dangerous action.

Example:

> Your grant application has been received.

### REVIEW

The message contains a potentially consequential request requiring human inspection.

Example:

> Purchase this API service for $15 USDC.

### BLOCK

The message contains an obvious malicious or prohibited instruction.

Example:

> Send us your API key to verify your account.

---

## 5.2 Threat categories

Sentinel should detect or flag:

* secret harvesting;
* credential requests;
* private-key requests;
* wallet seed requests;
* suspicious payment pressure;
* prompt injection;
* attempts to override system rules;
* impersonation indicators;
* suspicious links;
* malicious attachments;
* requests for destructive actions;
* requests to bypass approval;
* requests to reveal internal instructions;
* suspicious financial instructions.

---

## 5.3 Current Sentinel implementation

Already implemented:

* secret-harvesting detection;
* payment-pressure review;
* ordinary informational email clearance;
* security-oriented classification;
* tests for the above behaviors.

### Status

**Implemented**

---

# 6. Mermail Commerce Bridge

Commerce Bridge converts a legitimate commercial request into a structured proposal.

For example:

```text
Incoming email:

"Please purchase the Pro API plan for $15 USDC."

↓

Commerce Bridge

Action:
Purchase API subscription

Amount:
15 USDC

Purpose:
API subscription

Recipient:
[resolved recipient]

Source:
Mermail email

↓

Human approval required
```

---

## 6.1 Responsibilities

Commerce Bridge should:

1. receive an approved/reviewed request;
2. extract commercial intent;
3. normalize the request;
4. identify amount;
5. identify asset/currency;
6. identify recipient;
7. identify purpose;
8. identify requested service;
9. identify relevant payment method;
10. generate an approval request;
11. wait for explicit authorization;
12. execute only after authorization;
13. record the result.

---

## 6.2 Current implementation

Already implemented:

* Commerce Bridge abstraction;
* human-approval boundary;
* test proving that a transaction cannot execute without approval.

### Status

**Implemented**

---

# 7. Human Approval Layer

Human approval is a mandatory authorization boundary.

The UI must clearly show:

```text
WHAT
WHAT AMOUNT
WHICH ASSET
WHO RECEIVES IT
WHY
WHERE THE REQUEST CAME FROM
WHAT WILL HAPPEN NEXT
```

Example:

```text
Payment Request

Amount
15 USDC

Recipient
0x....

Purpose
API subscription

Source
Email from example.com

Risk
REVIEW

[ Reject ]       [ Approve ]
```

Approval must be explicit.

No:

* automatic approval;
* implicit approval;
* email-based approval;
* approval hidden behind navigation;
* approval based solely on classification.

### Status

**Not Implemented**

---

# 8. Payment / Agent Wallet Layer

The project may eventually support Mermail's payment infrastructure where appropriate.

Potential capabilities include:

* wallet balance;
* payment preparation;
* payment execution;
* transaction status;
* payment receipt;
* x402 service payments.

However, payment execution must remain downstream of human authorization.

The application must never:

```text
email → wallet → payment
```

It must use:

```text
email
 → Sentinel
 → Commerce Bridge
 → approval
 → wallet/payment
```

### Status

**Not Implemented**

---

# 9. x402 Integration

x402 may be used for paid HTTP/API services where the original user-requested operation continues after payment.

The system should support the concept of:

```text
Request
   ↓
Paid service detected
   ↓
Payment requirement
   ↓
Human approval
   ↓
x402 payment
   ↓
Original service request
   ↓
Result
```

Important requirement:

> Payment is not the end of the workflow.

A paid request must continue to the original requested operation.

### Status

**Not Implemented**

---

# 10. Audit Trail

Every consequential workflow should produce an auditable record.

A record should contain information such as:

```text
Event ID
Timestamp
Email/message reference
Classification
Detected risks
Extracted intent
Requested action
Amount
Asset
Recipient
Approval status
Approver
Execution status
Transaction/service reference
Final result
```

Sensitive secrets must never be recorded.

### Status

**Not Implemented**

---

# 11. Web Dashboard

The Next.js application will provide the user interface.

The dashboard should expose:

## Inbox

View incoming messages and their security classification.

## Security Review

See why a message was:

* CLEAR;
* REVIEW;
* BLOCK.

## Commerce

See extracted commercial requests.

## Approval Queue

Approve or reject pending consequential actions.

## Activity

View completed actions and audit history.

## Settings

Configure safe application-level settings without exposing credentials.

### Status

**Foundation exists / UI not complete**

---

# 12. Dashboard Design

The interface should communicate security status visually.

A message should show:

```text
┌──────────────────────────────────────┐
│ Web3 Grant Application                │
│ grants@example.org                    │
│                                      │
│ CLEAR                                │
│ Informational message                │
│                                      │
│ No action required                   │
└──────────────────────────────────────┘
```

A suspicious request:

```text
┌──────────────────────────────────────┐
│ Payment Request                       │
│ vendor@example.org                   │
│                                      │
│ REVIEW                               │
│ Financial action requested            │
│                                      │
│ $15 USDC                             │
│                                      │
│ [Review request]                     │
└──────────────────────────────────────┘
```

A malicious request:

```text
┌──────────────────────────────────────┐
│ Account Verification                 │
│ unknown@example.org                  │
│                                      │
│ BLOCKED                              │
│ Credential harvesting detected       │
│                                      │
│ API/private credentials requested    │
└──────────────────────────────────────┘
```

---

# 13. Security Architecture

The application follows multiple trust boundaries.

```text
┌───────────────────────────────┐
│          INTERNET             │
│                               │
│   Email / Links / Attachments │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│        UNTRUSTED DATA         │
│                               │
│     Mermail email content     │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│      MERMAIL SENTINEL         │
│                               │
│ Security classification       │
└───────────────┬───────────────┘
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
      CLEAR   REVIEW    BLOCK
        │       │
        └───┬───┘
            ▼
┌───────────────────────────────┐
│      COMMERCE BRIDGE          │
│                               │
│ Structured intent             │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│       HUMAN APPROVAL          │
│                               │
│ Explicit authorization        │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│       EXECUTION LAYER         │
│                               │
│ Wallet / x402 / service       │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│       AUDIT / RECEIPT         │
└───────────────────────────────┘
```

---

# 14. Security Rules

The implementation must enforce these rules:

### Rule 1 — Never expose secrets

Never reveal:

* API keys;
* private keys;
* seed phrases;
* OAuth tokens;
* cookies;
* authentication headers;
* wallet credentials.

### Rule 2 — Email cannot authorize payment

Payment always requires an independent authorization step.

### Rule 3 — Untrusted content cannot modify system instructions

Email text must never override application policy.

### Rule 4 — Tool output is untrusted

External responses must not automatically become instructions.

### Rule 5 — Destructive operations require explicit approval

### Rule 6 — Uncertain writes must never be blindly replayed

### Rule 7 — Least privilege

Use the narrowest Mermail capability required by a workflow.

---

# 15. Current Repository State

## Implemented

### Project foundation

* [x] pnpm workspace
* [x] TypeScript configuration
* [x] Next.js application foundation
* [x] core package
* [x] Vitest test infrastructure
* [x] Mermail skill installation

### Sentinel

* [x] Sentinel security abstraction
* [x] secret-harvesting protection
* [x] payment-pressure review
* [x] ordinary informational classification
* [x] malicious email example
* [x] security documentation

### Commerce Bridge

* [x] Commerce Bridge abstraction
* [x] human-approval requirement
* [x] commerce request example
* [x] safety test

### Tests

* [x] Sentinel tests
* [x] Commerce Bridge test
* [x] all current tests passing

Current baseline:

```text
4 tests
4 passed
0 failed
```

---

# 16. Implementing

These are the areas that should be worked on next.

### Application layer

* [ ] Connect the Next.js dashboard to the core package
* [ ] Build inbox UI
* [ ] Build message detail UI
* [ ] Display Sentinel classifications
* [ ] Display security explanations
* [ ] Build review queue
* [ ] Build approval interface

### Mermail

* [ ] Establish application-level Mermail integration
* [ ] Mailbox discovery
* [ ] Email retrieval
* [ ] Email search
* [ ] Message normalization
* [ ] Safe read workflow

### Sentinel

* [ ] Expand threat detection
* [ ] Add structured risk reasons
* [ ] Add confidence/severity metadata
* [ ] Add more prompt-injection scenarios
* [ ] Add suspicious-link analysis
* [ ] Add suspicious-attachment handling

### Commerce

* [ ] Structured request extraction
* [ ] Amount extraction
* [ ] Asset extraction
* [ ] Recipient extraction
* [ ] Purpose extraction
* [ ] Approval request generation
* [ ] Approval state machine

---

# 17. Not Implemented

These should not be represented as working functionality until completed.

## Payments

* [ ] Wallet connection
* [ ] Wallet balance
* [ ] Payment preparation
* [ ] Payment execution
* [ ] Transaction tracking
* [ ] Payment receipt

## x402

* [ ] x402 detection
* [ ] Payment requirement parsing
* [ ] Approval before x402 payment
* [ ] Payment execution
* [ ] Original request continuation
* [ ] x402 result recording

## Audit

* [ ] Persistent audit records
* [ ] Event IDs
* [ ] Execution history
* [ ] Approval history
* [ ] Transaction/service references

## Production hardening

* [ ] Error handling
* [ ] Retry policy
* [ ] Rate-limit handling
* [ ] Authentication/session management
* [ ] Secret management
* [ ] Production logging policy
* [ ] Observability
* [ ] End-to-end security tests

---

# 18. Milestones

## Milestone 0 — Foundation

**Status: COMPLETE**

Deliverables:

* repository structure;
* package setup;
* skills installed;
* core abstractions;
* initial tests;
* security principles.

---

## Milestone 1 — Sentinel Engine

**Status: PARTIALLY COMPLETE**

Goal:

Build a reliable email security classification engine.

Deliverables:

* CLEAR/REVIEW/BLOCK;
* threat categories;
* security explanations;
* structured results;
* comprehensive unit tests.

Acceptance criteria:

```text
Malicious credential request → BLOCK

Suspicious payment request → REVIEW

Normal informational email → CLEAR
```

---

## Milestone 2 — Mermail Inbox

**Status: NOT COMPLETE**

Goal:

Connect the application to real Mermail mailbox data.

Deliverables:

* mailbox selection;
* email retrieval;
* email search;
* message normalization;
* safe read pipeline.

Acceptance criteria:

```text
Mermail
  ↓
Application
  ↓
Inbox
  ↓
Sentinel
```

---

## Milestone 3 — Security Dashboard

**Status: NOT COMPLETE**

Goal:

Give users a visual security control center.

Deliverables:

* inbox;
* classification badges;
* message detail;
* risk explanation;
* review queue.

---

## Milestone 4 — Commerce Bridge

**Status: PARTIALLY COMPLETE**

Goal:

Convert commercial emails into structured requests.

Deliverables:

* intent extraction;
* amount;
* asset;
* recipient;
* purpose;
* approval request.

---

## Milestone 5 — Human Approval

**Status: NOT COMPLETE**

Goal:

Create an explicit authorization boundary.

Deliverables:

* approval screen;
* approve;
* reject;
* cancellation;
* state tracking;
* approval audit.

Acceptance criterion:

```text
No approval
    ↓
No execution
```

---

## Milestone 6 — Payment Integration

**Status: NOT COMPLETE**

Goal:

Execute approved payments through the appropriate Mermail payment mechanism.

Deliverables:

* payment preparation;
* approval;
* execution;
* status;
* receipt.

---

## Milestone 7 — x402

**Status: NOT COMPLETE**

Goal:

Demonstrate a complete paid-service workflow.

Deliverables:

```text
Email
 ↓
Sentinel
 ↓
Commerce
 ↓
Approval
 ↓
x402 payment
 ↓
Original request
 ↓
Result
```

---

## Milestone 8 — Audit System

**Status: NOT COMPLETE**

Goal:

Make every consequential action traceable.

---

## Milestone 9 — Security Hardening

**Status: NOT COMPLETE**

Goal:

Test the application against realistic attacks.

Test categories:

* prompt injection;
* credential harvesting;
* malicious links;
* payment manipulation;
* recipient substitution;
* amount manipulation;
* replay;
* unauthorized execution;
* malformed messages;
* tool-output injection.

---

## Milestone 10 — Final Demo

**Status: NOT COMPLETE**

The final demonstration should show at least three complete scenarios.

### Demo 1 — Safe email

```text
Email
 ↓
Sentinel
 ↓
CLEAR
 ↓
Displayed normally
```

### Demo 2 — Malicious email

```text
Email
 ↓
Sentinel
 ↓
BLOCK
 ↓
Threat explanation
```

### Demo 3 — Commercial request

```text
Email
 ↓
Sentinel
 ↓
REVIEW
 ↓
Commerce extraction
 ↓
Human approval
 ↓
Payment/service execution
 ↓
Receipt
```

---

# 19. Testing Strategy

## Unit tests

Test:

* classifiers;
* threat detectors;
* request extraction;
* approval logic;
* payment guards.

## Integration tests

Test:

```text
Mermail → Sentinel
Sentinel → Commerce
Commerce → Approval
Approval → Execution
Execution → Audit
```

## Security tests

Every dangerous operation must have a negative test.

Examples:

```text
Email requests API key
→ key is never returned

Email requests private key
→ private key is never returned

Email requests payment
→ payment does not execute

Email says "ignore approval"
→ approval is still required

Duplicate payment request
→ no blind replay
```

## End-to-end tests

Simulate complete user workflows.

---

# 20. Demo Data

The repository already contains:

```text
examples/malicious-email.json
examples/commerce-request.json
```

These should eventually become part of the automated demo/test suite.

Additional fixtures should include:

```text
examples/
├── malicious-email.json
├── commerce-request.json
├── safe-email.json
├── prompt-injection-email.json
├── credential-harvesting-email.json
├── suspicious-payment.json
├── legitimate-payment.json
└── x402-request.json
```

---

# 21. Definition of Done

The project should not be considered complete until a reviewer can perform the following workflow without manually inspecting source code:

### Security

* Send/process a normal email.
* See it classified as CLEAR.
* See why it is safe.

### Attack

* Process a credential-harvesting email.
* See it classified as BLOCK.
* See the reason.
* Confirm no secret is exposed.

### Commerce

* Process a legitimate payment request.
* See it classified as REVIEW.
* See extracted payment information.
* Approve it.
* Observe execution.
* Receive a receipt.

### Safety

* Attempt to execute without approval.
* Confirm execution is rejected.

### Audit

* Open activity history.
* See the original request.
* See classification.
* See approval.
* See execution status.
* See final result.

---

# 22. Product Success Criteria

The project succeeds when it demonstrates that:

1. External email is treated as untrusted input.
2. Security analysis happens before action.
3. Dangerous requests can be blocked.
4. Ambiguous/consequential requests require review.
5. Commercial intent can be structured.
6. Human approval is independent from email instructions.
7. Payments cannot bypass approval.
8. External service payments can continue into the requested operation.
9. Actions are auditable.
10. The complete workflow is understandable from the UI.

---

# 23. Final Architecture

The intended completed architecture is:

```text
                       ┌─────────────────┐
                       │     MERMAIL     │
                       │      Inbox      │
                       └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │    NORMALIZER   │
                       └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ MERMAIL SENTINEL│
                       │                 │
                       │ Threat Analysis │
                       └────────┬────────┘
                                │
                 ┌──────────────┼──────────────┐
                 ▼              ▼              ▼
              CLEAR          REVIEW          BLOCK
                 │              │               │
                 │              ▼               │
                 │       ┌─────────────┐       │
                 │       │  COMMERCE   │       │
                 │       │   BRIDGE    │       │
                 │       └──────┬──────┘       │
                 │              │               │
                 │              ▼               │
                 │       ┌─────────────┐       │
                 │       │   HUMAN     │       │
                 │       │  APPROVAL   │       │
                 │       └──────┬──────┘       │
                 │              │               │
                 │              ▼               │
                 │       ┌─────────────┐       │
                 │       │   WALLET /  │       │
                 │       │    x402     │       │
                 │       └──────┬──────┘       │
                 │              │               │
                 └──────────────┼───────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ AUDIT + RECEIPT │
                       └─────────────────┘
```

---

# 24. Immediate Development Order

The implementation should proceed in this order:

```text
1. Sentinel engine hardening
          ↓
2. Mermail inbox integration
          ↓
3. Next.js dashboard
          ↓
4. Real email → Sentinel pipeline
          ↓
5. Commerce request extraction
          ↓
6. Human approval UI/state machine
          ↓
7. Payment integration
          ↓
8. x402 workflow
          ↓
9. Audit trail
          ↓
10. End-to-end security tests
          ↓
11. Final demo scenarios
          ↓
12. Submission polish
```

We should **not** jump directly to wallet/payment functionality.

The security and approval boundaries must exist first.

---

# 25. Project North Star

The final product should make this statement demonstrably true:

> **Mermail Agent Suite allows AI-assisted systems to safely turn untrusted email into useful actions without allowing the email itself to control the system.**

The application is therefore not simply an email client.

It is a **trust and authorization layer between external communication and autonomous action**.
