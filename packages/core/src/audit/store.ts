import type {
  AuditEvent,
  AuditEventType,
  AuditRecord,
} from "./types";

// Optional persistence callbacks - can be set by the application
let persistRecord: ((record: AuditRecord) => void) | null = null;
let loadRecord: ((workflowId: string) => AuditRecord | undefined) | null = null;

export function setAuditPersistence(
  persist: (record: AuditRecord) => void,
  load: (workflowId: string) => AuditRecord | undefined,
) {
  persistRecord = persist;
  loadRecord = load;
}

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

    // Try loading from disk if not in memory and persistence is configured
    if (!record && loadRecord) {
      record = loadRecord(event.workflowId);
      if (record) {
        this.records.set(event.workflowId, record);
      }
    }

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

    // Persist to disk if configured
    if (persistRecord) {
      persistRecord(record);
    }
  }

  getRecord(workflowId: string): AuditRecord | undefined {
    let record = this.records.get(workflowId);

    // Try loading from disk if not in memory and persistence is configured
    if (!record && loadRecord) {
      record = loadRecord(workflowId);
      if (record) {
        this.records.set(workflowId, record);
      }
    }

    return record;
  }

  getAllRecords(): AuditRecord[] {
    return [...this.records.values()];
  }

  getEvents(workflowId: string): AuditEvent[] {
    const record = this.getRecord(workflowId);
    return record?.events ?? [];
  }

  clear(): void {
    this.records.clear();
  }
}

export const auditStore = new AuditStore();
