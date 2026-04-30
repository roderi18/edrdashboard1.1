import { normalizeApiResponse } from 'src/utils/normalize-api-response';

export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Iglesias/GetAllIglesias'
        );

        const text = await res.text();
        let data;

        try {
            data = JSON.parse(text);
        } catch {
            return Response.json(
                { error: 'Respuesta inválida', raw: text },
                { status: 500 }
            );
        }

        return Response.json(normalizeApiResponse(data));
    } catch (error) {
        return Response.json(
            { error: 'Error obteniendo iglesias' },
            { status: 500 }
        );
    }
}
