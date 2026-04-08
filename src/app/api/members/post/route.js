export async function POST(req) {
    try {
        const body = await req.json();
        console.log('BODY FRONT 👉', JSON.stringify(body, null, 2));
        const res = await fetch(
            'https://systexploradores.somee.com/api/Miembros/SetMiembros',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    idMiembros: 0,
                    codigoMiembro: body.codigoMiembro,
                    nombres: body.nombres,
                    apellidos: body.apellidos,
                    genero: body.genero,
                    fechaNacimiento: body.fechaNacimiento,
                    idDestacamento: body.idDestacamento
                        ? Number(body.idDestacamento)
                        : null,
                    telefono: body.telefono,
                    direccion: body.direccion,
                    correo: body.correo,
                    idDivision: body.idDivision ?? null,
                    instructorCertificadoCi: body.instructorCertificadoCi ?? null,
                    estatusVigenciaCi: body.estatusVigenciaCi ?? null,
                    fechaInicioCertificado: body.fechaInicioCertificado ?? null,
                    fechaFinCertificado: body.fechaFinCertificado ?? null,
                    estatusMiembro: body.estatusMiembro ?? 'activo',
                })
            }
        );

        const text = await res.text();
        console.log('STATUS SOMEE 👉', res.status);
        console.log('RAW SOMEE 👉', text);

        return new Response(text, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return Response.json(
            { error: 'Error creando miembro' },
            { status: 500 }
        );
    }
}