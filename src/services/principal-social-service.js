import {
  doc,
  query,
  where,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

import { getMembers } from 'src/services/member-service';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

const COLECCIONES_SOCIALES = {
  solicitudesAmistad: 'solicitudes_amistad',
  amistades: 'amistades',
  fotos: 'fotos',
};

const ESTADO_PENDIENTE = 'pendiente';
const ESTADO_ACEPTADA = 'aceptada';
const ESTADO_ACTIVO = 'activo';
const ESTADO_ELIMINADA = 'eliminada';

const toNumberOrNull = (value) => {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
};

const getIdMiembros = (user = {}) =>
  toNumberOrNull(user?.idMiembros) || toNumberOrNull(user?.miembroId) || toNumberOrNull(user?.id);

const getNombreCompleto = (miembro = {}) =>
  [miembro.nombres || miembro.firstName || '', miembro.apellidos || miembro.lastName || '']
    .filter(Boolean)
    .join(' ')
    .trim() ||
  miembro.nombre ||
  miembro.name ||
  miembro.displayName ||
  `Miembro ${miembro.idMiembros || miembro.id || ''}`.trim();

const normalizeMember = (member = {}) => {
  const idMiembros = toNumberOrNull(member.idMiembros ?? member.id ?? member.memberId);

  return {
    idMiembros,
    codigoMiembro: member.codigoMiembro ?? member.memberId ?? '',
    nombres: member.nombres ?? member.firstName ?? member.nombre ?? '',
    apellidos: member.apellidos ?? member.lastName ?? '',
    nombreCompleto: getNombreCompleto(member),
    fechaNacimiento: member.fechaNacimiento ?? member.birthDate ?? null,
    correo: member.correo ?? member.email ?? '',
    urlFoto: member.urlFoto ?? member.avatarUrl ?? member.photoURL ?? '',
  };
};

const getBirthdayParts = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;

  const [year, month, day] = String(fechaNacimiento).split('T')[0].split('-').map(Number);

  if (!year || !month || !day) return null;

  return { year, month, day };
};

const getBirthdayInfo = (fechaNacimiento, now = new Date()) => {
  const parts = getBirthdayParts(fechaNacimiento);

  if (!parts) return null;

  const currentYear = now.getFullYear();
  const today = new Date(currentYear, now.getMonth(), now.getDate());
  let nextBirthday = new Date(currentYear, parts.month - 1, parts.day);

  if (nextBirthday < today) {
    nextBirthday = new Date(currentYear + 1, parts.month - 1, parts.day);
  }

  const diffDays = Math.round((nextBirthday.getTime() - today.getTime()) / 86400000);

  return {
    fechaCumpleanos: nextBirthday.toISOString(),
    diasRestantes: diffDays,
    cumpleHoy: diffDays === 0,
    edadCumplira: nextBirthday.getFullYear() - parts.year,
  };
};

const formatBirthdayDate = (date) =>
  new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);

const getFotoMiembro = async (idMiembros) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros) return '';

  const snapshot = await getDoc(
    doc(FIRESTORE, COLECCIONES_SOCIALES.fotos, `miembro_${idMiembros}_perfil`)
  ).catch(() => null);

  if (!snapshot?.exists()) return '';

  const foto = snapshot.data() || {};

  return foto.estado === ESTADO_ACTIVO ? foto.urlFoto || '' : '';
};

const buildProfilesById = async (idsMiembros = []) => {
  const ids = new Set(idsMiembros.map(Number).filter(Boolean));

  if (!ids.size) return new Map();

  const members = await getMembers();
  const baseProfiles = members
    .map(normalizeMember)
    .filter((member) => ids.has(Number(member.idMiembros)));
  const photos = await Promise.all(
    baseProfiles.map((member) => getFotoMiembro(member.idMiembros).catch(() => ''))
  );

  return new Map(
    baseProfiles.map((member, index) => [
      Number(member.idMiembros),
      {
        ...member,
        urlFoto: photos[index] || member.urlFoto || '',
      },
    ])
  );
};

const solicitudToUi = ({ solicitud = {}, perfilSolicitante = null }) => ({
  id: solicitud.idSolicitudAmistad || solicitud.id,
  idSolicitudAmistad: solicitud.idSolicitudAmistad || solicitud.id,
  solicitanteIdMiembros: solicitud.solicitanteIdMiembros,
  destinatarioIdMiembros: solicitud.destinatarioIdMiembros,
  nombre: solicitud.solicitanteNombre || perfilSolicitante?.nombreCompleto || 'Usuario',
  urlFoto: solicitud.solicitanteFotoURL || perfilSolicitante?.urlFoto || '',
  estado: solicitud.estado || ESTADO_PENDIENTE,
});

export async function obtenerResumenSocialPrincipal(usuario = {}) {
  const idMiembros = getIdMiembros(usuario);

  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros) {
    return {
      solicitudesAmistad: [],
      cumpleanerosHoy: [],
      proximosCumpleanos: [],
    };
  }

  const solicitudesSnapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCIONES_SOCIALES.solicitudesAmistad),
      where('destinatarioIdMiembros', '==', idMiembros)
    )
  ).catch(() => ({ docs: [] }));
  const amistadesSnapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCIONES_SOCIALES.amistades),
      where('idsMiembros', 'array-contains', idMiembros)
    )
  ).catch(() => ({ docs: [] }));
  const solicitudes = solicitudesSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((solicitud) => (solicitud.estado || ESTADO_PENDIENTE) === ESTADO_PENDIENTE);
  const amistades = amistadesSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((amistad) => [ESTADO_ACTIVO, ESTADO_ACEPTADA].includes(amistad.estado));
  const solicitantesIds = solicitudes.map((solicitud) => solicitud.solicitanteIdMiembros);
  const amigosIds = amistades
    .flatMap((amistad) => amistad.idsMiembros || [])
    .map(Number)
    .filter((id) => id && id !== idMiembros);
  const perfiles = await buildProfilesById([...solicitantesIds, ...amigosIds]);
  const solicitudesAmistad = solicitudes.map((solicitud) =>
    solicitudToUi({
      solicitud,
      perfilSolicitante: perfiles.get(Number(solicitud.solicitanteIdMiembros)),
    })
  );
  const cumpleanos = [...new Set(amigosIds)]
    .map((id) => perfiles.get(Number(id)))
    .filter(Boolean)
    .map((perfil) => {
      const birthday = getBirthdayInfo(perfil.fechaNacimiento);

      if (!birthday) return null;

      return {
        id: `cumpleanos_${perfil.idMiembros}`,
        idMiembros: perfil.idMiembros,
        nombre: perfil.nombreCompleto,
        urlFoto: perfil.urlFoto,
        fechaNacimiento: perfil.fechaNacimiento,
        fechaCumpleanos: birthday.fechaCumpleanos,
        fechaCumpleanosTexto: formatBirthdayDate(new Date(birthday.fechaCumpleanos)),
        diasRestantes: birthday.diasRestantes,
        edadCumplira: birthday.edadCumplira,
        cumpleHoy: birthday.cumpleHoy,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);

  return {
    solicitudesAmistad,
    cumpleanerosHoy: cumpleanos.filter((item) => item.cumpleHoy),
    proximosCumpleanos: cumpleanos.filter((item) => !item.cumpleHoy).slice(0, 8),
  };
}

export async function aceptarSolicitudAmistadPrincipal({ solicitud, usuario = {} }) {
  if (!isFirebaseConfigured || !FIRESTORE || !solicitud?.idSolicitudAmistad) return null;

  const usuarioIdMiembros = getIdMiembros(usuario);
  const solicitanteIdMiembros = toNumberOrNull(solicitud.solicitanteIdMiembros);

  if (!usuarioIdMiembros || !solicitanteIdMiembros) return null;

  const idsMiembros = [solicitanteIdMiembros, usuarioIdMiembros].sort((a, b) => a - b);
  const idAmistad = `amistad_${idsMiembros.join('_')}`;
  const fechaRespuesta = new Date().toISOString();
  const solicitudRef = doc(
    FIRESTORE,
    COLECCIONES_SOCIALES.solicitudesAmistad,
    solicitud.idSolicitudAmistad
  );
  const solicitudSnapshot = await getDoc(solicitudRef);

  if (!solicitudSnapshot.exists()) throw new Error('La solicitud ya no está disponible.');

  const solicitudActual = solicitudSnapshot.data() || {};

  if (Number(solicitudActual.destinatarioIdMiembros) !== Number(usuarioIdMiembros)) {
    throw new Error('No puedes responder una solicitud dirigida a otra persona.');
  }

  if ((solicitudActual.estado || ESTADO_PENDIENTE) !== ESTADO_PENDIENTE) {
    throw new Error('Esta solicitud ya fue respondida.');
  }

  const batch = writeBatch(FIRESTORE);
  batch.update(solicitudRef, {
    estado: ESTADO_ACEPTADA,
    fechaRespuesta,
    fechaActualizacion: fechaRespuesta,
    actualizadoEnServidor: serverTimestamp(),
  });
  batch.set(
    doc(FIRESTORE, COLECCIONES_SOCIALES.amistades, idAmistad),
    {
      idAmistad,
      idsMiembros,
      primerIdMiembros: idsMiembros[0],
      segundoIdMiembros: idsMiembros[1],
      estado: ESTADO_ACTIVO,
      solicitudOrigenId: solicitud.idSolicitudAmistad,
      fechaCreacion: fechaRespuesta,
      fechaActualizacion: fechaRespuesta,
      creadoEnServidor: serverTimestamp(),
      actualizadoEnServidor: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();

  return { idAmistad, idsMiembros, estado: ESTADO_ACTIVO };
}

export async function eliminarSolicitudAmistadPrincipal({ solicitud, usuario = {} }) {
  if (!isFirebaseConfigured || !FIRESTORE || !solicitud?.idSolicitudAmistad) return null;

  const usuarioIdMiembros = getIdMiembros(usuario);
  const solicitudRef = doc(
    FIRESTORE,
    COLECCIONES_SOCIALES.solicitudesAmistad,
    solicitud.idSolicitudAmistad
  );
  const solicitudSnapshot = await getDoc(solicitudRef);

  if (!solicitudSnapshot.exists()) throw new Error('La solicitud ya no está disponible.');
  if (Number(solicitudSnapshot.data()?.destinatarioIdMiembros) !== Number(usuarioIdMiembros)) {
    throw new Error('No puedes responder una solicitud dirigida a otra persona.');
  }

  const fechaRespuesta = new Date().toISOString();

  await updateDoc(solicitudRef, {
    estado: ESTADO_ELIMINADA,
    fechaRespuesta,
    fechaActualizacion: fechaRespuesta,
    actualizadoEnServidor: serverTimestamp(),
  });

  return { idSolicitudAmistad: solicitud.idSolicitudAmistad, estado: ESTADO_ELIMINADA };
}
