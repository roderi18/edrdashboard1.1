export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Regiones/GetListRegiones'
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

        return Response.json(data);
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
                    'Accept': 'application/json',
                },
                body: JSON.stringify(body),
            }
        ); console.log('STATUS 👉', res.status);

        const text = await res.text();

        console.log('RAW RESPONSE 👉', text);

        let data;

        try {
            data = JSON.parse(text);
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