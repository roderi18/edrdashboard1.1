export async function POST(req) {
    try {
        const body = await req.json();

        console.log('BODY RECIBIDO EN /api/dest/post 👉', body);

        const res = await fetch(
            'https://systexploradores.somee.com/api/Destacamentos/SetDestacamento',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        const text = await res.text();

        console.log('RESPUESTA BACKEND DEST 👉', text);

        return new Response(text, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('ERROR EN /api/dest/post 👉', error);

        return Response.json(
            { error: 'Error creando destacamento' },
            { status: 500 }
        );
    }
}