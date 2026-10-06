import {
  approveCommerce,
  attachQuote,
  createCommerceWorkflow,
  type CommerceWorkflow,
  type SentinelResult,
} from "@mermail-agent-suite/core";
import {
  loadWorkflow,
  saveWorkflowToDisk,
} from "./storage";

const workflows = new Map<string, CommerceWorkflow>();

// Initialize workflows from disk on startup
function initializeWorkflows() {
  // In production, you'd scan the data directory and load all workflows
  // For now, we'll start with an empty in-memory cache
}

initializeWorkflows();

export function getWorkflow(id: string) {
  // First check in-memory cache
  const cached = workflows.get(id);
  if (cached) {
    return cached;
  }

  // If not in cache, try loading from disk
  const loaded = loadWorkflow(id);
  if (loaded) {
    workflows.set(id, loaded);
    return loaded;
  }

  return null;
}

export function listWorkflows() {
  return [...workflows.values()];
}

export function createWorkflow(input: {
  sourceMessageId: string;
  service: string;
  recipient: string;
  amount: string;
  currency: string;
  purpose?: string; // Optional for x402
  sentinel: SentinelResult;
  network?: string;
  isX402?: boolean;
  x402Url?: string;
}) {
  const id = `req-${crypto.randomUUID()}`;

  const result = createCommerceWorkflow({
    id,
    sourceMessageId: input.sourceMessageId,
    service: input.service,
    recipient: input.recipient,
    amount: input.amount,
    currency: input.currency,
    purpose: input.purpose ?? (input.isX402 ? "x402 API payment" : "payment"),
    network: input.network ?? "demo",
    sentinelDecision: input.sentinel.decision,
    sentinelRiskScore: input.sentinel.riskScore,
    userApproved: false,
    isX402: input.isX402,
    x402Url: input.x402Url,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  const quoted = attachQuote(result.workflow, {
    quoteId: `quote-${crypto.randomUUID()}`,
    requestId: id,
    service: input.service,
    recipient: input.recipient,
    amount: input.amount,
    currency: input.currency,
    purpose: input.purpose,
    network: input.network ?? "demo",
    expiresAt: new Date(
      Date.now() + 15 * 60 * 1000,
    ).toISOString(),
  });

  if (!quoted.ok) {
    throw new Error(quoted.error);
  }

  workflows.set(id, quoted.workflow);
  saveWorkflowToDisk(quoted.workflow);

  return quoted.workflow;
}

export function approveWorkflow(
  id: string,
  approval: {
    recipient: string;
    amount: string;
    currency: string;
    purpose: string;
  },
) {
  const workflow = getWorkflow(id);

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const result = approveCommerce(workflow, {
    userApproved: true,
    ...approval,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  workflows.set(id, result.workflow);
  saveWorkflowToDisk(result.workflow);

  return result.workflow;
}

export function saveWorkflow(workflow: CommerceWorkflow) {
  workflows.set(workflow.id, workflow);
  saveWorkflowToDisk(workflow);
  return workflow;
}
