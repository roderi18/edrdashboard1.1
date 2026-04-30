import { normalizeApiResponse } from 'src/utils/normalize-api-response';

export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Regiones/GetAllRegiones'
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

        const resSections = await fetch(
            'https://systexploradores.somee.com/api/Secciones/GetAllSecciones'
        );

        const textSections = await resSections.text();

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
        return Response.json(
            { error: 'Error obteniendo regionales' },
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
        console.log('STATUS ðŸ‘‰', res.status);

        const text = await res.text();

        const resSections = await fetch(
            'https://systexploradores.somee.com/api/Secciones/GetAllSecciones'
        );

        const textSections = await resSections.text();

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
            console.log('REGIONALES CON SECCIONES ðŸ‘‰', newData);
            newData.forEach((r) => {
                console.log(`REGION: ${r.nombre} â†’ SECCIONES: ${r.regionalXSectionalCount}`);
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

