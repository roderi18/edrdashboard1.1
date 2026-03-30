export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Iglesias/GetListIglesias',
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            }
        );

        if (!res.ok) {
            return Response.json(
                { error: 'Error al obtener iglesias' },
                { status: res.status }
            );
        }

        const data = await res.json();

        return Response.json(data);
    } catch (error) {
        return Response.json(
            { error: 'Error interno obteniendo iglesias' },
            { status: 500 }
        );
    }
}