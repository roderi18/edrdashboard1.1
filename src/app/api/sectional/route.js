import { normalizeApiResponse } from 'src/utils/normalize-api-response';

export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Secciones/GetAllSecciones'
        );

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

        const resChurches = await fetch(
            'https://systexploradores.somee.com/api/Iglesias/GetAllIglesias'
        );

        const textChurches = await resChurches.text();

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
        return Response.json(
            { error: 'Error fetching sectionals' },
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
            `https://systexploradores.somee.com/api/Secciones/DeleteSecciones?id=${encodeURIComponent(id)}`,
            {
                method: 'DELETE',
                headers: { Accept: 'application/json, text/plain, */*' },
            }
        );
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
