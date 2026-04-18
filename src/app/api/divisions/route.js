export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Divisiones/GetAllDivisiones'
        );

        const text = await res.text();

        if (!text || text.startsWith('<')) {
            return Response.json({ Data: [] });
        }

        return new Response(text, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('ERROR DIVISIONES 👉', error);

        return Response.json({ Data: [] });
    }
}