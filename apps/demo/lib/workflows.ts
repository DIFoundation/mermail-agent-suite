import {
  approveCommerce,
  attachQuote,
  createCommerceWorkflow,
  type CommerceWorkflow,
} from "@mermail-agent-suite/core";

const workflows = new Map<string, CommerceWorkflow>();

export function getWorkflow(id: string) {
  return workflows.get(id);
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
  purpose: string;
}) {
  const id = `req-${crypto.randomUUID()}`;

  const result = createCommerceWorkflow({
    id,
    sourceMessageId: input.sourceMessageId,
    service: input.service,
    recipient: input.recipient,
    amount: input.amount,
    currency: input.currency,
    purpose: input.purpose,
    network: "demo",
    sentinelDecision: "clear",
    sentinelRiskScore: 0,
    userApproved: false,
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
    network: "demo",
    expiresAt: new Date(
      Date.now() + 15 * 60 * 1000,
    ).toISOString(),
  });

  if (!quoted.ok) {
    throw new Error(quoted.error);
  }

  workflows.set(id, quoted.workflow);

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
  const workflow = workflows.get(id);

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

  return result.workflow;
}

export function saveWorkflow(workflow: CommerceWorkflow) {
  workflows.set(workflow.id, workflow);
  return workflow;
}
