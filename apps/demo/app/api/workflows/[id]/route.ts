import { getWorkflow } from "../../../../lib/workflows";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const workflow = getWorkflow(id);

  if (!workflow) {
    return Response.json(
      { error: "Workflow not found." },
      { status: 404 },
    );
  }

  return Response.json(workflow);
}
