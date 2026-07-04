import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, invalidateUpstream } from 'src/utils/upstream-cache';

export async function PUT(req) {
    try {
        const body = await req.json();

        const res = await fetch(
            'https://systexploradores.somee.com/api/Secciones/UpdateSecciones',
            {
                method: 'POST', // 👈 IMPORTANTE (tu API usa POST, no PUT)
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        invalidateUpstream(UPSTREAM_KEYS.secciones);

        const text = await res.text();
        const parsed = text ? JSON.parse(text) : {};

        return Response.json(normalizeApiResponse(parsed), { status: res.status });
    } catch (error) {
        return Response.json(
            { error: 'Error actualizando seccional' },
            { status: 500 }
        );
    }
}
