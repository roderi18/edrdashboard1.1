import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, fetchUpstreamText, invalidateUpstream } from 'src/utils/upstream-cache';

import { exigirAdministradorGlobalRest } from 'src/server/sesion-rest.mjs';

export async function GET() {
    try {
        // Regiones y secciones en paralelo (antes iban en serie) y cacheadas.
        //
        // Mismo reparto que en /api/sectional: las regiones SON la respuesta y
        // las secciones solo cuentan cuantas cuelgan de cada region. Una
        // seccion lenta no puede llevarse por delante la lista de regiones.
        const [resultadoRegiones, resultadoSecciones] = await Promise.allSettled([
            fetchUpstreamText(
                UPSTREAM_KEYS.regiones,
                'https://systexploradores.somee.com/api/Regiones/GetAllRegiones'
            ),
            fetchUpstreamText(
                UPSTREAM_KEYS.secciones,
                'https://systexploradores.somee.com/api/Secciones/GetAllSecciones'
            ),
        ]);

        if (resultadoRegiones.status === 'rejected') {
            throw resultadoRegiones.reason;
        }

        const { text } = resultadoRegiones.value;
        const textSections =
            resultadoSecciones.status === 'fulfilled' ? resultadoSecciones.value.text : '';

        let data;

        try {
            data = JSON.parse(text);
        } catch (e) {
            return Response.json(
                { error: 'Respuesta no es JSON', raw: text },
                { status: 500 }
            );
        }

        let sectionsData = [];

        try {
            const parsedSections = JSON.parse(textSections);
            sectionsData = parsedSections?.data || parsedSections?.Data || [];
        } catch (e) {
            sectionsData = [];
        }

        const regionals = data?.data || data?.Data || [];

        const newData = regionals.map((regional) => {
            const count = sectionsData.filter(
                (s) => String(s.idRegion) === String(regional.idRegion)
            ).length;

            return {
                ...regional,
                regionalXSectionalCount: count,
            };
        });

        return Response.json(normalizeApiResponse({ ...data, data: newData }));
    } catch (error) {
        // Con el motivo: sin el, en el navegador solo se leia "Error obteniendo
        // regionales" y no se sabia si el upstream se cayo o tardo de mas.
        console.error('[api/regional] no se pudieron obtener las regiones', error);

        return Response.json(
            {
                error: 'Error obteniendo regionales',
                message: error?.message || 'El servidor de datos no respondió.',
            },
            { status: 500 }
        );
    }
}

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

        invalidateUpstream(UPSTREAM_KEYS.regiones);

        const text = await res.text();

        const { text: textSections } = await fetchUpstreamText(
            UPSTREAM_KEYS.secciones,
            'https://systexploradores.somee.com/api/Secciones/GetAllSecciones'
        );

        let sectionsData = [];

        try {
            const parsedSections = JSON.parse(textSections);
            sectionsData = parsedSections?.data || parsedSections?.Data || [];
        } catch (e) {
            sectionsData = [];
        }

        let data;

        try {
            data = JSON.parse(text);
            const regionals = data?.data || data?.Data || [];

            const newData = regionals.map((regional) => {
                const count = sectionsData.filter(
                    (s) => String(s.idRegion) === String(regional.idRegion)
                ).length;

                return {
                    ...regional,
                    regionalXSectionalCount: count,
                };
            });

            data = normalizeApiResponse({ ...data, data: newData });
            newData.forEach((r) => {
            });
        } catch (e) {
            return Response.json(
                { error: 'Respuesta no es JSON', raw: text },
                { status: 500 }
            );
        }

        return Response.json(data);
    } catch (error) {
        return Response.json({ error: 'Error creando regional' }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        // Eliminar una REGION se lleva por delante sus secciones y sus
        // destacamentos. Es cosa del Administrador Global, y lo comprueba el
        // servidor: hasta ahora bastaba con conocer la URL, sin cuenta siquiera.
        const noAutorizado = await exigirAdministradorGlobalRest(req);

        if (noAutorizado) return noAutorizado;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return Response.json({ error: 'id es requerido' }, { status: 400 });
        }

        const res = await fetch(
            `https://systexploradores.somee.com/api/Regiones/DeleteRegiones?id=${encodeURIComponent(id)}`,
            {
                method: 'DELETE',
                headers: { Accept: 'application/json, text/plain, */*' },
            }
        );

        invalidateUpstream(UPSTREAM_KEYS.regiones);

        const text = await res.text();
        let data = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { raw: text };
        }

        if (!res.ok) {
            return Response.json(
                { error: 'Error eliminando regional', status: res.status, data },
                { status: res.status }
            );
        }

        return Response.json(normalizeApiResponse(data ?? { success: true }));
    } catch (error) {
        return Response.json(
            { error: error?.message || 'Error eliminando regional' },
            { status: 500 }
        );
    }
}
