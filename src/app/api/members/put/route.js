import { normalizeApiResponse } from 'src/utils/normalize-api-response';

export async function PUT(req) {
    try {
        const body = await req.json();
        const payload = {
            idMiembros: Number(body.idMiembros),
            codigoMiembro: body.codigoMiembro ?? null,
            nombres: body.nombres ?? '',
            apellidos: body.apellidos ?? '',
            genero: body.genero ?? null,
            fechaNacimiento: body.fechaNacimiento ?? null,
            idDestacamento: body.idDestacamento ? Number(body.idDestacamento) : null,
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
        };

        const createLikePayload = {
            ...payload,
            idMiembros: Number(body.idMiembros) || 0,
            cargosmiembros: body.cargosmiembros ?? [],
            idDestacamentoNavigation: body.idDestacamentoNavigation ?? null,
            idDivisionNavigation: body.idDivisionNavigation ?? null,
            miembromeritos: body.miembromeritos ?? [],
            participanteseventos: body.participanteseventos ?? [],
            tutores: body.tutores ?? [],
            usuarios: body.usuarios ?? [],
            idUniformes: body.idUniformes ?? [],
            uniformesMiembros: body.uniformesMiembros ?? [],
        };

        const endpoint = 'https://systexploradores.somee.com/api/Miembros/UpdateMiembros';
        const createEndpoint = 'https://systexploradores.somee.com/api/Miembros/SetMiembros';
        const normalize = (value) => String(value ?? '').trim().toLowerCase();

        const verifyPersisted = async () => {
            let updatedMember = null;

            for (let attempt = 1; attempt <= 3; attempt += 1) {
                if (attempt > 1) {
                    await new Promise((resolve) => setTimeout(resolve, 700));
                }

                const membersRes = await fetch(
                    `https://systexploradores.somee.com/api/Miembros/GetAllMiembros?t=${Date.now()}&attempt=${attempt}`,
                    {
                        cache: 'no-store',
                        headers: {
                            Accept: 'application/json',
                            'Cache-Control': 'no-cache',
                        },
                    }
                );

                const membersJson = await membersRes.json();
                const normalizedMembers = normalizeApiResponse(membersJson);
                const members = Array.isArray(normalizedMembers?.data) ? normalizedMembers.data : [];

                updatedMember = members.find(
                    (member) => Number(member.idMiembros) === Number(payload.idMiembros)
                );

                if (
                    updatedMember &&
                    normalize(updatedMember.nombres) === normalize(payload.nombres) &&
                    normalize(updatedMember.apellidos) === normalize(payload.apellidos)
                ) {
                    break;
                }
            }

            return {
                persisted:
                    !!updatedMember &&
                    normalize(updatedMember.nombres) === normalize(payload.nombres) &&
                    normalize(updatedMember.apellidos) === normalize(payload.apellidos),
                updatedMember,
            };
        };

        const attempts = [
            { label: 'UpdateMiembros PUT normalized', method: 'PUT', body: payload },
            { label: 'UpdateMiembros POST normalized', method: 'POST', body: payload },
            { label: 'UpdateMiembros PUT raw', method: 'PUT', body },
            { label: 'UpdateMiembros POST raw', method: 'POST', body },
            { label: 'SetMiembros PUT normalized', method: 'PUT', body: createLikePayload, endpoint: createEndpoint },
            { label: 'SetMiembros POST normalized', method: 'POST', body: createLikePayload, endpoint: createEndpoint },
            { label: 'SetMiembros PUT raw', method: 'PUT', body: createLikePayload, endpoint: createEndpoint },
            { label: 'SetMiembros POST raw', method: 'POST', body: createLikePayload, endpoint: createEndpoint },
        ];

        const attemptResults = [];

        for (const attempt of attempts) {
            const targetEndpoint = attempt.endpoint || endpoint;

            const res = await fetch(targetEndpoint, {
                method: attempt.method,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(attempt.body),
            });

            const text = await res.text();
            let parsed = null;

            try {
                parsed = text ? JSON.parse(text) : null;
            } catch {
                parsed = null;
            }

            const completedMessage = parsed?.message?.toLowerCase().includes('completada');
            const shouldVerify = res.ok || completedMessage;
            const verification = shouldVerify
                ? await verifyPersisted()
                : { persisted: false, updatedMember: null };

            attemptResults.push({
                label: attempt.label,
                status: res.status,
                ok: res.ok,
                parsed,
                text,
                persisted: verification.persisted,
                found: verification.updatedMember
                    ? {
                        idMiembros: verification.updatedMember.idMiembros,
                        nombres: verification.updatedMember.nombres,
                        apellidos: verification.updatedMember.apellidos,
                    }
                    : null,
            });

            if (verification.persisted) {
                return Response.json({
                    success: true,
                    message: 'Actualización exitosa',
                    data: {
                        attempt: attempt.label,
                        upstream: normalizeApiResponse(parsed ?? { raw: text }),
                    },
                });
            }
        }

        const lastFound = [...attemptResults].reverse().find((item) => item.found)?.found;

        return Response.json(
            {
                success: false,
                message: `El API respondió, pero el miembro no quedó actualizado. Esperado: "${payload.nombres} ${payload.apellidos}". Encontrado: "${lastFound?.nombres ?? 'N/A'} ${lastFound?.apellidos ?? ''}".`,
                data: {
                    expected: {
                        idMiembros: payload.idMiembros,
                        nombres: payload.nombres,
                        apellidos: payload.apellidos,
                    },
                    attempts: attemptResults,
                },
            },
            { status: 409 }
        );
    } catch (error) {
        console.error('[members/put] route error', error);
        return Response.json(
            { message: error.message || 'Error actualizando miembro' },
            { status: 500 }
        );
    }
}
