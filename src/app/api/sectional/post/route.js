import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, invalidateUpstream } from 'src/utils/upstream-cache';

export async function POST(req) {
    try {
        const body = await req.json();

        const res = await fetch(
            'https://systexploradores.somee.com/api/Secciones/SetSecciones',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        invalidateUpstream(UPSTREAM_KEYS.secciones);

        const text = await res.text();

        let data;

        try {
            data = JSON.parse(text);
        } catch (e) {
            return Response.json(
                { error: 'Respuesta no es JSON', raw: text },
                { status: 500 }
            );
        }

        return Response.json(normalizeApiResponse(data));
    } catch (error) {
        return Response.json(
            { error: 'Error creando sección' },
            { status: 500 }
        );
    }
}
