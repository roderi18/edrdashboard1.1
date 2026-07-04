import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, fetchUpstreamText, invalidateUpstream } from 'src/utils/upstream-cache';

export async function GET() {
    try {
        const { text } = await fetchUpstreamText(
            UPSTREAM_KEYS.destacamentos,
            'https://systexploradores.somee.com/api/Destacamentos/GetAllDestacamentos'
        );

        if (!text || text.startsWith('<')) {
            return Response.json(
                { error: 'Respuesta inválida', raw: text },
                { status: 500 }
            );
        }

        const data = JSON.parse(text);

        return Response.json(normalizeApiResponse(data));
    } catch (error) {
        return Response.json(
            { error: 'Error obteniendo destacamentos' },
            { status: 500 }
        );
    }
}

export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return Response.json({ error: 'id es requerido' }, { status: 400 });
        }

        const res = await fetch(
            `https://systexploradores.somee.com/api/Destacamentos/DeleteDestacamento?id=${encodeURIComponent(id)}`,
            {
                method: 'DELETE',
                headers: { Accept: 'application/json, text/plain, */*' },
            }
        );

        invalidateUpstream(UPSTREAM_KEYS.destacamentos);

        const text = await res.text();
        let data = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { raw: text };
        }

        if (!res.ok) {
            return Response.json(
                { error: 'Error eliminando destacamento', status: res.status, data },
                { status: res.status }
            );
        }

        return Response.json(normalizeApiResponse(data ?? { success: true }));
    } catch (error) {
        return Response.json(
            { error: error?.message || 'Error eliminando destacamento' },
            { status: 500 }
        );
    }
}
