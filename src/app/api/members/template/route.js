import { buildMemberTemplateWorkbook } from 'src/server/member-template-workbook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DESTS_URL = 'https://systexploradores.somee.com/api/Destacamentos/GetAllDestacamentos';

export async function GET(request) {
  try {
    const defaultDestId = new URL(request.url).searchParams.get('destId') || '';
    const response = await fetch(DESTS_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`No se pudo actualizar el catálogo de destacamentos (${response.status}).`);
    }

    const payload = await response.json();
    const dests = Array.isArray(payload) ? payload : (payload?.data ?? payload?.Data ?? []);
    const buffer = await buildMemberTemplateWorkbook(dests, { defaultDestId });

    return new Response(buffer, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="plantilla-miembros.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || 'No se pudo generar la plantilla de miembros.' },
      { status: 500 }
    );
  }
}
