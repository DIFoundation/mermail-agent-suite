import { setAuditPersistence } from "@mermail-agent-suite/core";
import {
  loadAuditRecord,
  saveAuditRecordToDisk,
} from "./storage";

// Initialize audit persistence
setAuditPersistence(saveAuditRecordToDisk, loadAuditRecord);

console.log("Audit persistence initialized with disk storage");
