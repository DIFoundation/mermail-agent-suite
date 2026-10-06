import { NextResponse } from "next/server";
import { auditStore } from "@mermail-agent-suite/core";
import { initializeAuditPersistence } from "../../../lib/audit-persistence";

export async function GET() {
  initializeAuditPersistence();

  return NextResponse.json({
    records: auditStore.getAllRecords(),
  });
}

export async function DELETE() {
  initializeAuditPersistence();

  auditStore.clear();

  return NextResponse.json({
    success: true,
  });
}
