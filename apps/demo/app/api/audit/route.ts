import { NextResponse } from "next/server";
import { auditStore } from "@mermail-agent-suite/core";

export async function GET() {
  return NextResponse.json({
    records: auditStore.getAllRecords(),
  });
}

export async function DELETE() {
  auditStore.clear();
  return NextResponse.json({ success: true });
}
