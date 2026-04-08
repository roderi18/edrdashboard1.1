export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Iglesias/GetAllIglesias'
        );

        const text = await res.text();

        return new Response(text, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return Response.json(
            { error: 'Error obteniendo iglesias' },
            { status: 500 }
        );
    }
}