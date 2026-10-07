export type AuditEventType =
  | "workflow_created"
  | "workflow_approved"
  | "workflow_rejected"
  | "workflow_executed"
  | "workflow_completed"
  | "workflow_failed"
  | "x402_started"
  | "x402_pending"
  | "x402_proof_ready"
  | "x402_completed"
  | "payment_initiated"
  | "payment_submission_unknown"
  | "payment_settled"
  | "payment_failed";

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  workflowId: string;
  userId?: string;
  metadata: {
    [key: string]: unknown;
  };
}

export interface AuditRecord {
  workflowId: string;
  events: AuditEvent[];
  createdAt: string;
  updatedAt: string;
}
