import { normalizeApiResponse } from 'src/utils/normalize-api-response';

export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Miembros/GetAllMiembros'
        );

        const data = await res.json();

        return Response.json(normalizeApiResponse(data));
    } catch {
        return Response.json({ error: 'Error fetching members' }, { status: 500 });
    }
}
