import { approveWorkflow } from "../../../../../lib/workflows";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const body = await request.json();

    const workflow = approveWorkflow(id, {
      recipient: body.recipient,
      amount: body.amount,
      currency: body.currency,
      purpose: body.purpose,
    });

    return Response.json(workflow);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Approval failed.",
      },
      { status: 400 },
    );
  }
}
