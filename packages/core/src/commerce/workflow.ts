import type { SentinelResult } from "../index";

export type CommerceStatus =
  | "REQUESTED"
  | "CLEARED"
  | "QUOTED"
  | "APPROVAL_REQUIRED"
  | "APPROVED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED";

export interface CommerceRequest {
  id: string;
  service: string;
  recipient: string;
  amount: string;
  currency: string;
  purpose: string;
  network?: string;
  sourceMessageId: string;
  sentinelDecision: SentinelResult["decision"];
  sentinelRiskScore: number;
  userApproved: boolean;
}

export interface CommerceQuote {
  quoteId: string;
  requestId: string;
  service: string;
  recipient: string;
  amount: string;
  currency: string;
  purpose: string;
  network?: string;
  expiresAt: string;
}

export interface CommerceWorkflow {
  id: string;
  request: CommerceRequest;
  status: CommerceStatus;
  quote?: CommerceQuote;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
  executionId?: string;
}

export interface TransitionResult {
  ok: boolean;
  workflow: CommerceWorkflow;
  error?: string;
}

function now() {
  return new Date().toISOString();
}

function update(
  workflow: CommerceWorkflow,
  status: CommerceStatus,
  extra: Partial<CommerceWorkflow> = {},
): CommerceWorkflow {
  return {
    ...workflow,
    ...extra,
    status,
    updatedAt: now(),
  };
}

function hasRequiredRequestFields(request: CommerceRequest) {
  return Boolean(
    request.service &&
      request.recipient &&
      request.amount &&
      request.currency &&
      request.purpose &&
      request.sourceMessageId,
  );
}

function isValidFutureExpiry(expiresAt: string): boolean {
  const timestamp = Date.parse(expiresAt);

  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function quoteMatchesRequest(
  workflow: CommerceWorkflow,
  quote: CommerceQuote,
): boolean {
  return (
    quote.requestId === workflow.request.id &&
    quote.service === workflow.request.service &&
    quote.recipient === workflow.request.recipient &&
    quote.amount === workflow.request.amount &&
    quote.currency === workflow.request.currency &&
    quote.purpose === workflow.request.purpose &&
    quote.network === workflow.request.network
  );
}

export function createCommerceWorkflow(
  request: CommerceRequest,
): TransitionResult {
  const timestamp = now();

  const workflow: CommerceWorkflow = {
    id: request.id,
    request,
    status: "REQUESTED",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (!hasRequiredRequestFields(request)) {
    return {
      ok: false,
      workflow: update(workflow, "FAILED", {
        failureReason:
          "Service, recipient, amount, currency, purpose and source message are required.",
      }),
      error: "Incomplete commerce request.",
    };
  }

  if (request.sentinelDecision !== "clear") {
    return {
      ok: false,
      workflow: update(workflow, "FAILED", {
        failureReason:
          "Commerce cannot proceed because Sentinel did not return CLEAR.",
      }),
      error: "Sentinel clearance required.",
    };
  }

  return {
    ok: true,
    workflow: update(workflow, "CLEARED"),
  };
}

export function attachQuote(
  workflow: CommerceWorkflow,
  quote: CommerceQuote,
): TransitionResult {
  if (workflow.status !== "CLEARED") {
    return {
      ok: false,
      workflow,
      error: `Cannot quote workflow in ${workflow.status} state.`,
    };
  }

  if (quote.requestId !== workflow.request.id) {
    return {
      ok: false,
      workflow,
      error: "Quote does not belong to this request.",
    };
  }

  if (
    quote.service !== workflow.request.service ||
    quote.recipient !== workflow.request.recipient ||
    quote.amount !== workflow.request.amount ||
    quote.currency !== workflow.request.currency ||
    quote.purpose !== workflow.request.purpose ||
    quote.network !== workflow.request.network
  ) {
    return {
      ok: false,
      workflow,
      error: "Quote does not exactly match the commerce request.",
    };
  }

  if (!isValidFutureExpiry(quote.expiresAt)) {
    return {
      ok: false,
      workflow,
      error: "Quote expiry must be a valid future timestamp.",
    };
  }

  return {
    ok: true,
    workflow: update(workflow, "APPROVAL_REQUIRED", {
      quote,
    }),
  };
}

export function approveCommerce(
  workflow: CommerceWorkflow,
  approval: {
    userApproved: boolean;
    recipient: string;
    amount: string;
    currency: string;
    purpose: string;
  },
): TransitionResult {
  if (workflow.status !== "APPROVAL_REQUIRED") {
    return {
      ok: false,
      workflow,
      error: "Commerce workflow is not awaiting approval.",
    };
  }

  const quote = workflow.quote;

  if (!quote) {
    return {
      ok: false,
      workflow,
      error: "Cannot approve commerce without a quote.",
    };
  }

  if (!isValidFutureExpiry(quote.expiresAt)) {
    return {
      ok: false,
      workflow,
      error: "Quote has expired.",
    };
  }

  if (!quoteMatchesRequest(workflow, quote)) {
    return {
      ok: false,
      workflow,
      error: "Quote no longer matches the commerce request.",
    };
  }

  if (!approval.userApproved) {
    return {
      ok: false,
      workflow,
      error: "Explicit user approval is required.",
    };
  }

  if (
    approval.recipient !== workflow.request.recipient ||
    approval.amount !== workflow.request.amount ||
    approval.currency !== workflow.request.currency ||
    approval.purpose !== workflow.request.purpose
  ) {
    return {
      ok: false,
      workflow,
      error: "Approval does not exactly match the quoted request.",
    };
  }

  return {
    ok: true,
    workflow: {
      ...workflow,
      status: "APPROVED",
      request: {
        ...workflow.request,
        userApproved: true,
      },
      updatedAt: new Date().toISOString(),
    },
  };
}

export function beginExecution(
  workflow: CommerceWorkflow,
): TransitionResult {
  if (workflow.status !== "APPROVED") {
    return {
      ok: false,
      workflow,
      error: "Only an explicitly approved workflow may execute.",
    };
  }

  if (!workflow.request.userApproved) {
    return {
      ok: false,
      workflow,
      error: "Human approval is missing.",
    };
  }

  return {
    ok: true,
    workflow: update(workflow, "EXECUTING"),
  };
}

export function completeExecution(
  workflow: CommerceWorkflow,
  executionId: string,
): TransitionResult {
  if (workflow.status !== "EXECUTING") {
    return {
      ok: false,
      workflow,
      error: "Workflow is not executing.",
    };
  }

  if (!executionId) {
    return {
      ok: false,
      workflow,
      error: "Authoritative execution identifier is required.",
    };
  }

  return {
    ok: true,
    workflow: update(workflow, "COMPLETED", {
      executionId,
    }),
  };
}

export function failExecution(
  workflow: CommerceWorkflow,
  reason: string,
): TransitionResult {
  if (workflow.status !== "EXECUTING") {
    return {
      ok: false,
      workflow,
      error: "Only an executing workflow can fail.",
    };
  }

  return {
    ok: true,
    workflow: update(workflow, "FAILED", {
      failureReason: reason,
    }),
  };
}

