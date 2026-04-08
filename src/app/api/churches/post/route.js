export async function POST(req) {
    try {
        const body = await req.json();

        console.log('BODY IGLESIA LOCAL 👉', JSON.stringify(body, null, 2));

        const res = await fetch(
            'https://systexploradores.somee.com/api/Iglesias/SetIglesia',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    idIglesia: 0,
                    nombre: body.nombre ?? '',
                    pastor: body.pastor ?? '',
                    direccion: body.direccion ?? '',
                    correo: body.correo ?? '',
                    idSeccion: Number(body.idSeccion) || 0,
                }),
            }
        );

        const text = await res.text();

        console.log('STATUS SOMEE IGLESIA 👉', res.status);
        console.log('RAW SOMEE IGLESIA 👉', text);

        return new Response(text, {
            status: res.status,
            headers: {
                'Content-Type': 'text/plain',
            },
        });
    } catch (error) {
        console.error('ERROR LOCAL /api/churches/post 👉', error);

        return Response.json(
            { error: 'Error creando iglesia' },
            { status: 500 }
        );
    }
}