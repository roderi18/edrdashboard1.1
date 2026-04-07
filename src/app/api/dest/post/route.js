export async function POST(req) {
    try {
        const body = await req.json();

        const res = await fetch(
            'https://systexploradores.somee.com/api/Destacamentos/SetDestacamento',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        const text = await res.text();

        return new Response(text, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return Response.json(
            { error: 'Error creando destacamento' },
            { status: 500 }
        );
    }
}