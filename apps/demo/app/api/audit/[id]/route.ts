import { NextResponse } from "next/server";
import { auditStore } from "@mermail-agent-suite/core";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const { id } = await context.params;

  const record = auditStore.getRecord(id);

  if (!record) {
    return NextResponse.json({ error: "Audit record not found" }, { status: 404 });
  }

  return NextResponse.json(record);
}
