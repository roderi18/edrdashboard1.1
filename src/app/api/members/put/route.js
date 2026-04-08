export async function PUT(req) {
    try {
        const body = await req.json();

        const res = await fetch(
            'https://systexploradores.somee.com/api/Miembros/UpdateMiembros',
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    idMiembros: body.idMiembros,
                    codigoMiembro: body.codigoMiembro ?? null,
                    nombres: body.nombres ?? '',
                    apellidos: body.apellidos ?? '',
                    genero: body.genero ?? null,
                    fechaNacimiento: body.fechaNacimiento ?? null,
                    idDestacamento: body.idDestacamento ?? null,
                    telefono: body.telefono ?? '',
                    direccion: body.direccion ?? null,
                    correo: body.correo ?? '',
                    idCargoLocal: body.idCargoLocal ?? null,
                    idCargoInstitucional: body.idCargoInstitucional ?? null,
                    idDivision: body.idDivision ?? null,
                    instructorCertificadoCi: body.instructorCertificadoCi ?? null,
                    estatusVigenciaCi: body.estatusVigenciaCi ?? null,
                    fechaInicioCertificado: body.fechaInicioCertificado ?? null,
                    fechaFinCertificado: body.fechaFinCertificado ?? null,
                    estatusMiembro: body.estatusMiembro ?? null,
                }),
            }
        );

        const text = await res.text();

        return new Response(text, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return Response.json(
            { error: 'Error actualizando miembro' },
            { status: 500 }
        );
    }
}