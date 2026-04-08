export async function POST(req) {
    try {
        const body = await req.json();

        console.log('BODY DEST LOCAL 👉', JSON.stringify(body, null, 2));

        const res = await fetch(
            'https://systexploradores.somee.com/api/Destacamentos/SetDestacamento',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    idDestacamento: 0,
                    nombre: body.nombre ?? '',
                    idIglesia: Number(body.idIglesia) || 0,
                    correo: body.correo ?? 'dest@demo.com',
                    telefono: body.telefono ?? '',
                    registradoOfnc: body.registradoOfnc ?? true,
                    rritrackActivo: body.rritrackActivo ?? true,
                    diaReunion: body.diaReunion ?? '',
                    horaReunion: body.horaReunion ?? null,
                    logo: body.logo ?? '',
                    numero: body.numero ?? '',
                    fechaInicio: body.fechaInicio ?? new Date().toISOString(),
                    direccion: body.direccion ?? '',
                    concilio: body.concilio ?? '',
                }),
            }
        );

        const text = await res.text();

        console.log('STATUS SOMEE DEST 👉', res.status);
        console.log('RAW SOMEE DEST 👉', text);

        return new Response(text, {
            status: res.status,
            headers: { 'Content-Type': 'text/plain' },
        });
    } catch (error) {
        console.error('ERROR LOCAL /api/dest/post 👉', error);

        return Response.json(
            { error: 'Error creando destacamento' },
            { status: 500 }
        );
    }
}