import { UPSTREAM_KEYS, invalidateUpstream } from 'src/utils/upstream-cache';

import { getDivisions } from 'src/services/division-service';

const MEMBERS_ENDPOINT = 'https://systexploradores.somee.com/api/Miembros';
const CREATE_ENDPOINT = `${MEMBERS_ENDPOINT}/SetMiembros`;
const UPDATE_ENDPOINT = `${MEMBERS_ENDPOINT}/UpdateMiembros`;
const GET_ALL_ENDPOINT = `${MEMBERS_ENDPOINT}/GetAllMiembros`;

const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

const toPositiveNumberOrNull = (value) => (isPositiveNumber(value) ? Number(value) : null);

const parseResponseText = (text) => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

const getRowsFromApi = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
};

const getDivisionIdByBirthdate = (birthDate, divisions) => {
  if (!birthDate) return null;

  const today = new Date();
  const [year, month, day] = birthDate.split('T')[0].split('-');
  const birth = new Date(Number(year), Number(month) - 1, Number(day));

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  const findByName = (keyword) =>
    divisions.find((d) => d.name.toLowerCase().trim().includes(keyword.toLowerCase()))?.id;

  if (age >= 5 && age <= 7) return findByName('navegantes');
  if (age >= 8 && age <= 10) return findByName('pioneros');
  if (age >= 11 && age <= 13) return findByName('seguidores');
  if (age >= 14 && age <= 17) return findByName('exploradores');
  if (age >= 18) return findByName('liderazgo');

  return null;
};

const resolveDivisionId = (body, divisions) => {
  const explicitDivisionId = toPositiveNumberOrNull(body.idDivision);

  if (explicitDivisionId) return explicitDivisionId;

  const birthdateDivisionId = toPositiveNumberOrNull(
    getDivisionIdByBirthdate(body.fechaNacimiento, divisions)
  );

  if (birthdateDivisionId) return birthdateDivisionId;

  return toPositiveNumberOrNull(divisions[0]?.id);
};

const getCreatedMemberId = (payload) =>
  payload?.idMiembros ||
  payload?.data?.idMiembros ||
  payload?.Data?.idMiembros ||
  payload?.member?.idMiembros ||
  payload?.miembro?.idMiembros;

const findCreatedMember = async ({ codigoMiembro, createdMemberId, authHeader = '' }) => {
  const membersRes = await fetch(`${GET_ALL_ENDPOINT}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });

  if (!membersRes.ok) return null;

  const membersJson = await membersRes.json();
  const members = getRowsFromApi(membersJson);

  return (
    members.find((member) => Number(member.idMiembros) === Number(createdMemberId)) ||
    members.find((member) => String(member.codigoMiembro) === String(codigoMiembro)) ||
    null
  );
};

const ensureCreatedMemberDivision = async ({ responsePayload, memberPayload, authHeader = '' }) => {
  try {
    const divisionId = toPositiveNumberOrNull(memberPayload.idDivision);

    if (!divisionId) return;

    const createdMember = await findCreatedMember({
      codigoMiembro: memberPayload.codigoMiembro,
      createdMemberId: getCreatedMemberId(responsePayload),
      authHeader,
    });

    if (!createdMember?.idMiembros || toPositiveNumberOrNull(createdMember.idDivision)) return;

    await fetch(UPDATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        idMiembros: Number(createdMember.idMiembros),
        codigoMiembro: createdMember.codigoMiembro ?? memberPayload.codigoMiembro ?? null,
        nombres: createdMember.nombres ?? memberPayload.nombres ?? null,
        apellidos: createdMember.apellidos ?? memberPayload.apellidos ?? null,
        genero: createdMember.genero ?? memberPayload.genero ?? null,
        fechaNacimiento: createdMember.fechaNacimiento ?? memberPayload.fechaNacimiento ?? null,
        sizeCamisas: createdMember.sizeCamisas ?? memberPayload.sizeCamisas ?? null,
        ocupacion: createdMember.ocupacion ?? memberPayload.ocupacion ?? null,
        fechaCreacion: createdMember.fechaCreacion ?? memberPayload.fechaCreacion ?? null,
        idDestacamento: toPositiveNumberOrNull(
          createdMember.idDestacamento ?? memberPayload.idDestacamento
        ),
        telefono: createdMember.telefono ?? memberPayload.telefono ?? null,
        direccion: createdMember.direccion ?? memberPayload.direccion ?? null,
        correo: createdMember.correo ?? memberPayload.correo ?? null,
        idDivision: divisionId,
        instructorCertificadoCi:
          createdMember.instructorCertificadoCi ?? memberPayload.instructorCertificadoCi ?? null,
        estatusVigenciaCi:
          createdMember.estatusVigenciaCi ?? memberPayload.estatusVigenciaCi ?? null,
        fechaInicioCertificado:
          createdMember.fechaInicioCertificado ?? memberPayload.fechaInicioCertificado ?? null,
        fechaFinCertificado:
          createdMember.fechaFinCertificado ?? memberPayload.fechaFinCertificado ?? null,
        estatusMiembro: createdMember.estatusMiembro ?? memberPayload.estatusMiembro ?? null,
      }),
    });
  } catch {
    // La creacion ya termino; la correccion de division no debe romper el alta del miembro.
  }
};

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const body = await req.json();
    const divisions = await getDivisions();
    const divisionId = resolveDivisionId(body, divisions);
    const memberPayload = {
      idMiembros: 0,
      codigoMiembro: body.codigoMiembro,
      nombres: body.nombres,
      apellidos: body.apellidos,
      genero: body.genero,
      fechaNacimiento: body.fechaNacimiento,
      sizeCamisas: body.sizeCamisas ?? null,
      ocupacion: body.ocupacion ?? null,
      fechaCreacion: body.fechaCreacion ?? new Date().toISOString(),
      idDestacamento: body.idDestacamento ? Number(body.idDestacamento) : null,
      telefono: body.telefono,
      direccion: body.direccion,
      correo: body.correo,
      idCargoLocal: body.idCargoLocal ?? null,
      idCargoInstitucional: body.idCargoInstitucional ?? null,

      idDivision: divisionId,
      instructorCertificadoCi: body.instructorCertificadoCi ?? null,
      estatusVigenciaCi: body.estatusVigenciaCi ?? null,
      fechaInicioCertificado: body.fechaInicioCertificado ?? null,
      fechaFinCertificado: body.fechaFinCertificado ?? null,
      estatusMiembro: body.estatusMiembro ?? 'activo',
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
    const res = await fetch(CREATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },

      body: JSON.stringify(memberPayload),
    });

    const text = await res.text();
    const responsePayload = parseResponseText(text);

    if (res.ok) {
      await ensureCreatedMemberDivision({ responsePayload, memberPayload, authHeader });
    }

    invalidateUpstream(UPSTREAM_KEYS.miembros);

    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Error creando miembro' }, { status: 500 });
  }
}
