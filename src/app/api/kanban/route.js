export async function GET() {
  return Response.json({ board: { tasks: {}, columns: [] } });
}

export async function POST() {
  return Response.json({ ok: true });
}
