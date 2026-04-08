export async function POST(req) {
    try {
        const body = await req.json();

        console.log('📥 BODY RECIBIDO FRONT 👉', JSON.stringify(body, null, 2));

        const payload = {
            idDestacamento: 0,
            nombre: body.nombre ?? '',
            idIglesia: Number(body.idIglesia) || 0,
            correo: body.correo ?? '',
            telefono: body.telefono ?? '',
            registradoOfnc: body.registradoOfnc ?? true,
            rritrackActivo: body.rritrackActivo ?? true,
            diaReunion: body.diaReunion ?? '',
            horaReunion: body.horaReunion ?? '',
            logo: body.logo ?? '',
            numero: body.numero ?? '',
            fechaInicio: body.fechaInicio ?? '',
            direccion: body.direccion ?? '',
            concilio: body.concilio ?? '',
        };

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

        console.log('================ DEST DEBUG ================');
        console.log('📡 STATUS SOMEE 👉', res.status);
        console.log('📦 RAW RESPONSE 👉', raw);
        console.log('🧠 PARSED RESPONSE 👉', parsed);
        console.log('📤 PAYLOAD FINAL 👉', payload);
        console.log('===========================================');

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