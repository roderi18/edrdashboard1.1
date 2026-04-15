export async function GET() {
    try {
        // 🔹 1. SECCIONES
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

        // 🔹 2. IGLESIAS
        const resChurches = await fetch(
            'https://systexploradores.somee.com/api/Iglesias/GetAllIglesias'
        );

        const textChurches = await resChurches.text();

        let churchesData = [];

        try {
            const parsed = JSON.parse(textChurches);
            churchesData = parsed?.Data || [];
        } catch (e) {
            churchesData = [];
        }

        // 🔹 3. CALCULAR CONTEO
        const sectionals = data?.Data || [];

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

        console.log('🔥 SECCIONALES CON IGLESIAS 👉', newData);

        data.Data = newData;

        return Response.json(data);
    } catch (error) {
        return Response.json(
            { error: 'Error fetching sectionals' },
            { status: 500 }
        );
    }
}