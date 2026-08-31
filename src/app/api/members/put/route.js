import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, invalidateUpstream } from 'src/utils/upstream-cache';

import { exigirPermisoDeCargoRest } from 'src/server/sesion-rest.mjs';

const MEMBERS_ENDPOINT = 'https://systexploradores.somee.com/api/Miembros';
const UPDATE_ENDPOINT = `${MEMBERS_ENDPOINT}/UpdateMiembros`;
const GET_ALL_ENDPOINT = `${MEMBERS_ENDPOINT}/GetAllMiembros`;

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const isValueProvided = (value) => value !== undefined && value !== null && value !== '';

const optionalNumber = (value) => (isValueProvided(value) ? Number(value) : null);

const buildMemberPayload = (body) => {
  const payload = {
    idMiembros: Number(body.idMiembros),
    codigoMiembro: body.codigoMiembro ?? null,
    nombres: body.nombres ?? null,
    apellidos: body.apellidos ?? null,
    genero: body.genero ?? null,
    fechaNacimiento: body.fechaNacimiento ?? null,
    sizeCamisas: body.sizeCamisas ?? null,
    ocupacion: body.ocupacion ?? null,
    fechaCreacion: body.fechaCreacion ?? null,
    idDestacamento: optionalNumber(body.idDestacamento),
    telefono: body.telefono ?? null,
    direccion: body.direccion ?? null,
    correo: body.correo ?? null,
    idDivision: optionalNumber(body.idDivision),
    instructorCertificadoCi: body.instructorCertificadoCi ?? null,
    estatusVigenciaCi: body.estatusVigenciaCi ?? null,
    fechaInicioCertificado: body.fechaInicioCertificado ?? null,
    fechaFinCertificado: body.fechaFinCertificado ?? null,
  };

  if (isValueProvided(body.estatusMiembro)) {
    payload.estatusMiembro = body.estatusMiembro;
  }

  return payload;
};

const parseResponseText = (text) => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

const getMemberFromApi = async (memberId, authHeader = '') => {
  const membersRes = await fetch(`${GET_ALL_ENDPOINT}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });

  const membersJson = await membersRes.json();
  const normalizedMembers = normalizeApiResponse(membersJson);
  const members = Array.isArray(normalizedMembers?.data) ? normalizedMembers.data : [];

  return members.find((member) => Number(member.idMiembros) === Number(memberId)) ?? null;
};

export async function PUT(req) {
  try {
    // Editar la ficha exige el permiso del cargo. Quien edita por APROBACION
    // tambien lo tiene: lo que le frena es la pantalla, no esta ruta, y la
    // escritura de verdad la hace el Coordinador al aprobar.
    const noAutorizado = await exigirPermisoDeCargoRest(req, ['miembros.editar']);

    if (noAutorizado) return noAutorizado;

    const authHeader = req.headers.get('authorization') || '';
    const body = await req.json();
    const payload = buildMemberPayload(body);

    const upstreamRes = await fetch(UPDATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    });

    invalidateUpstream(UPSTREAM_KEYS.miembros);

    const upstreamText = await upstreamRes.text();
    const upstreamParsed = parseResponseText(upstreamText);

    if (!upstreamRes.ok) {
      return Response.json(
        {
          success: false,
          message:
            `La API externa no pudo actualizar el miembro. ` +
            `UpdateMiembros devolvio ${upstreamRes.status}.`,
          data: {
            endpoint: UPDATE_ENDPOINT,
            status: upstreamRes.status,
            upstream: normalizeApiResponse(upstreamParsed ?? { raw: upstreamText }),
            payload,
          },
        },
        { status: 502 }
      );
    }

    const updatedMember = await getMemberFromApi(payload.idMiembros, authHeader);
    const persisted =
      !!updatedMember &&
      normalize(updatedMember.nombres) === normalize(payload.nombres) &&
      normalize(updatedMember.apellidos) === normalize(payload.apellidos);

    if (!persisted) {
      return Response.json(
        {
          success: false,
          message:
            `La API externa respondio OK, pero el miembro no quedo actualizado. ` +
            `Esperado: "${payload.nombres} ${payload.apellidos}". ` +
            `Encontrado: "${updatedMember?.nombres ?? 'N/A'} ${updatedMember?.apellidos ?? ''}".`,
          data: {
            expected: {
              idMiembros: payload.idMiembros,
              nombres: payload.nombres,
              apellidos: payload.apellidos,
            },
            found: updatedMember
              ? {
                  idMiembros: updatedMember.idMiembros,
                  nombres: updatedMember.nombres,
                  apellidos: updatedMember.apellidos,
                }
              : null,
            upstream: normalizeApiResponse(upstreamParsed ?? { raw: upstreamText }),
          },
        },
        { status: 409 }
      );
    }

    // UpdateMiembros ignora el correo cuando llega vacio o en blanco, y aun asi
    // responde OK. Como la comprobacion de arriba solo mira nombre y apellido,
    // vaciarlo se daba por guardado y volvia al recargar. Se compara aparte
    // para que quien llama pueda decirlo.
    const correoAplicado = normalize(updatedMember.correo) === normalize(payload.correo);

    return Response.json({
      success: true,
      message: 'Actualizacion exitosa',
      data: {
        upstream: normalizeApiResponse(upstreamParsed ?? { raw: upstreamText }),
        correo: {
          aplicado: correoAplicado,
          pedido: payload.correo ?? '',
          guardado: updatedMember.correo ?? '',
        },
        verifiedMember: {
          idMiembros: updatedMember.idMiembros,
          nombres: updatedMember.nombres,
          apellidos: updatedMember.apellidos,
        },
      },
    });
  } catch (error) {
    console.error('[members/put] route error', error);
    return Response.json(
      { success: false, message: error.message || 'Error actualizando miembro' },
      { status: 500 }
    );
  }
}
