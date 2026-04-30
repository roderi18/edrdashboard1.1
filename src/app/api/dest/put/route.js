import { normalizeApiResponse } from 'src/utils/normalize-api-response';

export async function PUT(req) {
    try {
        const body = await req.json();

        const res = await fetch(
            'https://systexploradores.somee.com/api/Destacamentos/UpdateDestacamento',
            {
                method: 'POST', // 👈 tu API usa POST
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        const text = await res.text();

        const parsed = text ? JSON.parse(text) : {};

        return Response.json(normalizeApiResponse(parsed), { status: res.status });
    } catch (error) {
        return Response.json(
            { error: 'Error actualizando destacamento' },
            { status: 500 }
        );
    }
}
