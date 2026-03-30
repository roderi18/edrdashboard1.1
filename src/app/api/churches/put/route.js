export async function PUT(req) {
    try {
        const body = await req.json();

        const res = await fetch(
            'https://systexploradores.somee.com/api/Iglesias/UpdateIglesia',
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    obj: {
                        idIglesia: body.id,
                        nombre: body.name,
                        pastor: body.pastor || '',
                        direccion: body.address || '',
                        correo: body.correo || '',
                        idSeccion: body.sectionId || null,
                    },
                }),
            }
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
            { error: 'Error actualizando iglesia' },
            { status: 500 }
        );
    }
}