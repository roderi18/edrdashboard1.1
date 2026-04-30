import { normalizeApiResponse } from 'src/utils/normalize-api-response';

export async function POST(req) {
    try {
        const body = await req.json();

        const res = await fetch(
            'https://systexploradores.somee.com/api/Regiones/SetRegiones',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        const data = await res.json();

        return Response.json(normalizeApiResponse(data));
    } catch (error) {
        return Response.json({ error: 'Error creando regional' }, { status: 500 });
    }
}
