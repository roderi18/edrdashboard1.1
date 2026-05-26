import { normalizeApiResponse } from 'src/utils/normalize-api-response';

export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Divisiones/GetAllDivisiones'
        );

        const text = await res.text();

        if (!text || text.startsWith('<')) {
            return Response.json({ data: [] });
        }

        const data = JSON.parse(text);

        return Response.json(
            normalizeApiResponse({ ...data, data: data?.data || data?.Data || [] })
        );
    } catch (error) {
        console.error('ERROR DIVISIONES =>', error);

        return Response.json({ data: [] });
    }
}

