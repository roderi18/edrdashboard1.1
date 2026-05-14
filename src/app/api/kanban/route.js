import { _kanban } from 'src/_mock';

export async function GET() {
  return Response.json({ board: _kanban });
}

export async function POST() {
  return Response.json({ ok: true });
}
