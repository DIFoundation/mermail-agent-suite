import { setAuditPersistence } from "@mermail-agent-suite/core";

import { saveAuditRecordToDisk, loadAuditRecord } from "./storage";

let initialized = false;

export function initializeAuditPersistence() {
  if (initialized) {
    return;
  }

  initialized = true;

  setAuditPersistence(saveAuditRecordToDisk, loadAuditRecord);
}
