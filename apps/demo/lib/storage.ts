import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { type CommerceWorkflow } from "@mermail-agent-suite/core";
import { type AuditRecord } from "@mermail-agent-suite/core";

const DATA_DIR = join(process.cwd(), ".data");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getWorkflowPath(id: string) {
  return join(DATA_DIR, `workflow-${id}.json`);
}

function getAuditPath(id: string) {
  return join(DATA_DIR, `audit-${id}.json`);
}

// Workflow persistence
export function loadWorkflow(id: string): CommerceWorkflow | null {
  const path = getWorkflowPath(id);
  if (!existsSync(path)) {
    return null;
  }
  try {
    const data = readFileSync(path, "utf-8");
    return JSON.parse(data) as CommerceWorkflow;
  } catch {
    return null;
  }
}

export function saveWorkflowToDisk(workflow: CommerceWorkflow): void {
  ensureDataDir();
  const path = getWorkflowPath(workflow.id);
  writeFileSync(path, JSON.stringify(workflow, null, 2), "utf-8");
}

export function deleteWorkflowFromDisk(id: string): void {
  const path = getWorkflowPath(id);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

// Audit persistence
export function loadAuditRecord(id: string): AuditRecord | undefined {
  const path = getAuditPath(id);
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    const data = readFileSync(path, "utf-8");
    return JSON.parse(data) as AuditRecord;
  } catch {
    return undefined;
  }
}

export function saveAuditRecordToDisk(record: AuditRecord): void {
  ensureDataDir();
  const path = getAuditPath(record.workflowId);
  writeFileSync(path, JSON.stringify(record, null, 2), "utf-8");
}

export function listAllAuditRecords(): AuditRecord[] {
  ensureDataDir();
  const records: AuditRecord[] = [];
  // For simplicity, we'll just return an empty array
  // In production, you'd scan the directory and load all audit files
  return records;
}
