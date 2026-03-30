export async function PUT(req) {
    try {
        const body = await req.json();

        const res = await fetch(
            'https://systexploradores.somee.com/api/Secciones/UpdateSecciones',
            {
                method: 'POST', // 👈 IMPORTANTE (tu API usa POST, no PUT)
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
            { error: 'Error actualizando seccional' },
            { status: 500 }
        );
    }
}