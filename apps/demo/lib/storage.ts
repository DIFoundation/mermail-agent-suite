import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
} from "fs";
import { join } from "path";
import {
  type CommerceWorkflow,
  type AuditRecord,
} from "@mermail-agent-suite/core";

const DATA_DIR = join(process.cwd(), ".data");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, {
      recursive: true,
    });
  }
}

function isSafeId(id: string): boolean {
  /*
   * Workflow IDs are generated as:
   * req-${crypto.randomUUID()}
   *
   * Keep this intentionally narrow so a route
   * parameter cannot escape .data through ../
   */
  return /^req-[A-Za-z0-9-]+$/.test(id);
}

function getWorkflowPath(id: string): string | null {
  if (!isSafeId(id)) {
    return null;
  }

  return join(DATA_DIR, `workflow-${id}.json`);
}

function getAuditPath(id: string): string | null {
  if (!isSafeId(id)) {
    return null;
  }

  return join(DATA_DIR, `audit-${id}.json`);
}

/* -------------------------------------------------------------------------- */
/* Workflow persistence                                                       */
/* -------------------------------------------------------------------------- */

export function loadWorkflow(id: string): CommerceWorkflow | null {
  const path = getWorkflowPath(id);

  if (!path || !existsSync(path)) {
    return null;
  }

  try {
    const data = readFileSync(path, "utf-8");

    return JSON.parse(data) as CommerceWorkflow;
  } catch {
    return null;
  }
}

export function listPersistedWorkflows(): CommerceWorkflow[] {
  ensureDataDir();

  let filenames: string[];

  try {
    filenames = readdirSync(DATA_DIR);
  } catch {
    return [];
  }

  const workflows: CommerceWorkflow[] = [];

  for (const filename of filenames) {
    if (!filename.startsWith("workflow-") || !filename.endsWith(".json")) {
      continue;
    }

    const id = filename.slice("workflow-".length, -".json".length);

    const workflow = loadWorkflow(id);

    if (workflow) {
      workflows.push(workflow);
    }
  }

  return workflows;
}

export function saveWorkflowToDisk(workflow: CommerceWorkflow): void {
  const path = getWorkflowPath(workflow.id);

  if (!path) {
    throw new Error("Invalid workflow ID.");
  }

  ensureDataDir();

  writeFileSync(path, JSON.stringify(workflow, null, 2), "utf-8");
}

export function deleteWorkflowFromDisk(id: string): void {
  const path = getWorkflowPath(id);

  if (!path) {
    return;
  }

  if (existsSync(path)) {
    unlinkSync(path);
  }
}

/* -------------------------------------------------------------------------- */
/* Audit persistence                                                          */
/* -------------------------------------------------------------------------- */

export function loadAuditRecord(id: string): AuditRecord | undefined {
  const path = getAuditPath(id);

  if (!path || !existsSync(path)) {
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
  const path = getAuditPath(record.workflowId);

  if (!path) {
    throw new Error("Invalid workflow ID.");
  }

  ensureDataDir();

  writeFileSync(path, JSON.stringify(record, null, 2), "utf-8");
}

export function listAllAuditRecords(): AuditRecord[] {
  ensureDataDir();

  let filenames: string[];

  try {
    filenames = readdirSync(DATA_DIR);
  } catch {
    return [];
  }

  const records: AuditRecord[] = [];

  for (const filename of filenames) {
    if (!filename.startsWith("audit-") || !filename.endsWith(".json")) {
      continue;
    }

    const id = filename.slice("audit-".length, -".json".length);

    const record = loadAuditRecord(id);

    if (record) {
      records.push(record);
    }
  }

  return records;
}
