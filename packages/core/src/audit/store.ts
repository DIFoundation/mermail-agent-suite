import type {
  AuditEvent,
  AuditEventType,
  AuditRecord,
} from "./types";

class AuditStore {
  private records = new Map<string, AuditRecord>();

  createEvent(
    eventType: AuditEventType,
    workflowId: string,
    metadata: Record<string, unknown> = {},
    userId?: string,
  ): AuditEvent {
    const event: AuditEvent = {
      id: `audit-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      eventType,
      workflowId,
      userId,
      metadata,
    };

    this.addEvent(event);

    return event;
  }

  private addEvent(event: AuditEvent): void {
    let record = this.records.get(event.workflowId);

    if (!record) {
      record = {
        workflowId: event.workflowId,
        events: [],
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
      this.records.set(event.workflowId, record);
    }

    record.events.push(event);
    record.updatedAt = event.timestamp;
  }

  getRecord(workflowId: string): AuditRecord | undefined {
    return this.records.get(workflowId);
  }

  getAllRecords(): AuditRecord[] {
    return [...this.records.values()];
  }

  getEvents(workflowId: string): AuditEvent[] {
    return this.records.get(workflowId)?.events ?? [];
  }

  clear(): void {
    this.records.clear();
  }
}

export const auditStore = new AuditStore();
