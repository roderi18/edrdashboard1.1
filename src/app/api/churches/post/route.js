import { UPSTREAM_KEYS, invalidateUpstream } from 'src/utils/upstream-cache';

export async function POST(req) {
    try {
        const body = await req.json();

        const payload = {
            nombre: body.nombre?.trim() || 'Iglesia sin nombre',
            pastor: body.pastor?.trim() || 'Pastor no especificado',
            direccion: body.direccion?.trim() || 'Dirección no especificada',
            correo: body.correo?.trim() || 'test@demo2.com',
            idSeccion: Number(body.idSeccion) || 1,
        };


        const res = await fetch('https://systexploradores.somee.com/api/Iglesias/SetIglesia', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json, text/plain, */*',
            },
            body: JSON.stringify(payload),
            cache: 'no-store',
        });

        invalidateUpstream(UPSTREAM_KEYS.iglesias);

        const raw = await res.text();

        let parsed = null;
        try {
            parsed = raw ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }

        if (!res.ok) {
            return Response.json(
                {
                    error: 'Error al crear iglesia en Somee',
                    status: res.status,
                    raw: raw || null,
                    payload,
                },
                { status: res.status }
            );
        }

        return Response.json(parsed ?? { success: true, raw }, { status: 200 });
    } catch (error) {
        return Response.json(
            {
                error: 'Error creando iglesia',
                detail: error.message,
            },
            { status: 500 }
        );
    }
}
