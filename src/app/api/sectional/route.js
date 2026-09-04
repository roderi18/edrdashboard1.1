import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, fetchUpstreamText, invalidateUpstream } from 'src/utils/upstream-cache';

import { exigirAdministradorGlobalRest } from 'src/server/sesion-rest.mjs';

export async function GET() {
    try {
        // Secciones e iglesias en paralelo (antes iban en serie) y cacheadas.
        const [{ text }, { text: textChurches }] = await Promise.all([
            fetchUpstreamText(
                UPSTREAM_KEYS.secciones,
                'https://systexploradores.somee.com/api/Secciones/GetAllSecciones'
            ),
            fetchUpstreamText(
                UPSTREAM_KEYS.iglesias,
                'https://systexploradores.somee.com/api/Iglesias/GetAllIglesias'
            ),
        ]);

        let data;

        try {
            data = JSON.parse(text);
        } catch (e) {
            return Response.json(
                { error: 'Respuesta no es JSON', raw: text },
                { status: 500 }
            );
        }

        let churchesData = [];

        try {
            const parsed = JSON.parse(textChurches);
            churchesData = parsed?.data || parsed?.Data || [];
        } catch (e) {
            churchesData = [];
        }

        const sectionals = data?.data || data?.Data || [];

        const newData = sectionals.map((sectional) => {
            const count = churchesData.filter(
                (c) =>
                    c.idSeccion !== null &&
                    Number(c.idSeccion) === Number(sectional.idSeccion)
            ).length;

            return {
                ...sectional,
                sectionalDestCount: count,
            };
        });

        return Response.json(normalizeApiResponse({ ...data, data: newData }));
    } catch (error) {
        // CON EL MOTIVO. Antes salia un 'Error fetching sectionals' pelado y en
        // el navegador solo se leia "Error al obtener seccionales": ni si el
        // upstream se cayo, ni si tardo mas de los 9 segundos de corte.
        console.error('[api/sectional] no se pudieron obtener las secciones', error);

        return Response.json(
            {
                error: 'Error fetching sectionals',
                message: error?.message || 'El servidor de datos no respondió.',
            },
            { status: 500 }
        );
    }
}

export async function DELETE(req) {
    try {
        // Eliminar una SECCION es cosa del Administrador Global, y lo comprueba el
        // servidor: hasta ahora bastaba con conocer la URL, sin cuenta siquiera.
        const noAutorizado = await exigirAdministradorGlobalRest(req);

        if (noAutorizado) return noAutorizado;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return Response.json({ error: 'id es requerido' }, { status: 400 });
        }

        const res = await fetch(
            `https://systexploradores.somee.com/api/Secciones/DeleteSecciones?id=${encodeURIComponent(id)}`,
            {
                method: 'DELETE',
                headers: { Accept: 'application/json, text/plain, */*' },
            }
        );

        invalidateUpstream(UPSTREAM_KEYS.secciones);

        const text = await res.text();
        let data = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { raw: text };
        }

        if (!res.ok) {
            return Response.json(
                { error: 'Error eliminando seccion', status: res.status, data },
                { status: res.status }
            );
        }

        return Response.json(normalizeApiResponse(data ?? { success: true }));
    } catch (error) {
        return Response.json(
            { error: error?.message || 'Error eliminando seccion' },
            { status: 500 }
        );
    }
}
