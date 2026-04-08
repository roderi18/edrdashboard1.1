export async function POST() {
    try {
        const payload = {
            idDestacamento: 0,
            nombre: '',
            idIglesia: 1, //
            correo: '',
            telefono: '',
            registradoOfnc: true,
            rritrackActivo: true,
            diaReunion: '',
            horaReunion: '',
            logo: '',
            numero: '',
            fechaInicio: '2026-04-08T03:22:15.027Z', //
            direccion: '',
            concilio: '',
        };

        console.log('BODY DEST HARDCODED 👉', JSON.stringify(payload, null, 2));

        const res = await fetch(
            'https://systexploradores.somee.com/api/Destacamentos/SetDestacamento',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json, text/plain, */*',
                },
                body: JSON.stringify(payload),
                cache: 'no-store',
            }
        );

        const raw = await res.text();

        console.log('STATUS SOMEE DEST 👉', res.status);
        console.log('RAW SOMEE DEST 👉', raw);

        return new Response(raw || JSON.stringify({ status: res.status }), {
            status: res.status,
            headers: {
                'Content-Type': raw ? 'application/json' : 'application/json',
            },
        });
    } catch (error) {
        console.error('ERROR LOCAL /api/dest/post 👉', error);

        return Response.json(
            {
                error: 'Error creando destacamento',
                detail: error.message,
            },
            { status: 500 }
        );
    }
}