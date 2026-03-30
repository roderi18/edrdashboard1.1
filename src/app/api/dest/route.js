export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Destacamentos/GetAllDestacamentos'
        );

        const text = await res.text();

        if (!text || text.startsWith('<')) {
            return Response.json(
                { error: 'Respuesta inválida', raw: text },
                { status: 500 }
            );
        }

        const data = JSON.parse(text);

        return Response.json(data);
    } catch (error) {
        return Response.json(
            { error: 'Error obteniendo destacamentos' },
            { status: 500 }
        );
    }
}