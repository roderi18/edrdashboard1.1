export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Cargos/GetAllCargos',
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
            }
        );

        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return new Response(
                JSON.stringify({
                    Success: false,
                    Message: 'Respuesta inválida del servidor',
                    raw: text,
                }),
                { status: 500 }
            );
        }

        return new Response(JSON.stringify(data), {
            status: 200,
        });
    } catch (error) {
        return new Response(
            JSON.stringify({
                Success: false,
                Message: 'Error al obtener cargos',
                error: error.message,
            }),
            { status: 500 }
        );
    }
}