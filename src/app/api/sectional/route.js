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

