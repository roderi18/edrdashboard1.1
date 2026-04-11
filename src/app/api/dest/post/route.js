export async function POST(req) {
    try {
        const body = await req.json();

        console.log('📥 BODY RECIBIDO FRONT 👉', JSON.stringify(body, null, 2));

        // 👇 NO enviar campos vacíos
        const payload = {
            idDestacamento: 0,
            nombre: body?.nombre?.trim() || '',
            idIglesia: Number(body.idIglesia) || (() => { throw new Error('idIglesia es requerido'); })(),

            registradoOfnc: body?.registradoOfnc ?? null,
            rritrackActivo: body?.rritrackActivo ?? null,

            diaReunion: body?.diaReunion?.trim() || '',

            horaReunion: body?.horaReunion
                ? (body.horaReunion.includes(':')
                    ? (body.horaReunion.length === 5
                        ? `${body.horaReunion}:00`
                        : body.horaReunion)
                    : `${body.horaReunion}:00:00`)
                : '',

            logo: body?.logo?.trim() || '',
            numero: body?.numero?.trim() || '',
            fechaInicio: body?.fechaInicio || '',
        };

        // 👇 SOLO SI EXISTEN
        if (body?.correo?.trim()) payload.correo = body.correo.trim();
        if (body?.telefono?.trim()) payload.telefono = body.telefono.trim();

        const direccion = body?.direccion?.trim();
        if (direccion) payload.direccion = direccion;

        if (body?.concilio?.trim()) payload.concilio = body.concilio.trim();

        console.log('📤 PAYLOAD ENVIADO A SOMEE 👉', JSON.stringify(payload, null, 2));

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

        let parsed = null;
        try {
            parsed = raw ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }

        if (!res.ok) {
            console.error('❌ ERROR DETALLADO DEST 👉', {
                status: res.status,
                raw,
                parsed,
                payload,
            });

            return Response.json(
                {
                    error: 'Error creando destacamento en Somee',
                    status: res.status,
                    raw,
                    parsed,
                    payload,
                },
                { status: res.status }
            );
        }

        return Response.json(parsed ?? { raw }, { status: 200 });

    } catch (error) {
        console.error('🔥 ERROR LOCAL /api/dest/post 👉', error);

        return Response.json(
            {
                error: 'Error creando destacamento',
                detail: error.message,
            },
            { status: 500 }
        );
    }
}