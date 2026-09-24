import { responderConEtag } from 'src/utils/respuesta-con-etag.mjs';
import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, fetchUpstreamText } from 'src/utils/upstream-cache';

export async function GET(request) {
    try {
        const { text } = await fetchUpstreamText(
            UPSTREAM_KEYS.iglesias,
            'https://systexploradores.somee.com/api/Iglesias/GetAllIglesias'
        );

        let data;

        try {
            data = JSON.parse(text);
        } catch {
            return Response.json(
                { error: 'Respuesta inválida', raw: text },
                { status: 500 }
            );
        }

        // Con huella: si no cambió, 304 y el navegador usa su copia.
        return responderConEtag(request, normalizeApiResponse(data));
    } catch (error) {
        return Response.json(
            { error: 'Error obteniendo iglesias' },
            { status: 500 }
        );
    }
}
