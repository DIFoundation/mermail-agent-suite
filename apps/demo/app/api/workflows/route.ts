import { createWorkflow, listWorkflows } from "../../../lib/workflows";

export async function GET() {
  return Response.json({
    workflows: listWorkflows(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (
      !body.sourceMessageId ||
      !body.service ||
      !body.recipient ||
      !body.amount ||
      !body.currency ||
      !body.purpose
    ) {
      return Response.json(
        { error: "Missing required commerce fields." },
        { status: 400 },
      );
    }

    const workflow = createWorkflow({
      sourceMessageId: body.sourceMessageId,
      service: body.service,
      recipient: body.recipient,
      amount: body.amount,
      currency: body.currency,
      purpose: body.purpose,
    });

    return Response.json(workflow, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create workflow.",
      },
      { status: 400 },
    );
  }
}
