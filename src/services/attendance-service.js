import {
  doc,
  query,
  where,
  getDoc,
  getDocs,
  writeBatch,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { registrarAuditoriaSilenciosa } from './audit-log-service';

export const COLECCION_ASISTENCIAS = 'asistencias';
export const COLECCION_REGISTROS_ASISTENCIA = 'registrosAsistencia';
export const COLECCION_ULTIMAS_ASISTENCIAS_MIEMBROS = 'ultimasAsistenciasMiembros';

const ESTADO_UI_A_FIREBASE = {
  present: 'presente',
  absent: 'ausente',
  excused: 'excusa',
  'absent-unmarked': 'ausente_sin_marcar',
};

const ESTADO_FIREBASE_A_UI = {
  presente: 'present',
  ausente: 'absent',
  excusa: 'excused',
  ausente_sin_marcar: 'absent-unmarked',
};

const normalizeIdSegment = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getAttendanceDocId = (fecha, idDestacamento) =>
  `${normalizeIdSegment(fecha)}_${normalizeIdSegment(idDestacamento)}`;

const getMemberName = (member = {}) =>
  member.nombreMiembro ||
  member.memberName ||
  member.fullName ||
  [member.firstName || member.nombres, member.lastName || member.apellidos]
    .filter(Boolean)
    .join(' ') ||
  member.memberId ||
  member.codigoMiembro ||
  '';

const getMemberCode = (member = {}) => String(member.memberId || member.codigoMiembro || '');

export const convertirEstadoAsistenciaAFirebase = (estado) =>
  ESTADO_UI_A_FIREBASE[estado] || estado || '';

export const convertirEstadoAsistenciaAUi = (estado) => ESTADO_FIREBASE_A_UI[estado] || estado || '';

export const obtenerAsistenciaDestacamento = async ({ fecha, idDestacamento } = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !fecha || !idDestacamento) {
    return {};
  }

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_REGISTROS_ASISTENCIA),
      where('fecha', '==', String(fecha)),
      where('idDestacamento', '==', String(idDestacamento))
    )
  ).catch(() => ({ docs: [] }));

  return Object.fromEntries(
    snapshot.docs.map((item) => {
      const data = item.data() || {};

      return [String(data.idMiembro || ''), convertirEstadoAsistenciaAUi(data.estado)];
    })
  );
};

export const obtenerUltimasPresenciasMiembros = async (idMiembros = []) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros.length) {
    return {};
  }

  const entries = await Promise.all(
    idMiembros.map(async (idMiembro) => {
      const snap = await getDoc(
        doc(FIRESTORE, COLECCION_ULTIMAS_ASISTENCIAS_MIEMBROS, String(idMiembro))
      ).catch(() => null);

      if (!snap?.exists?.()) return [String(idMiembro), ''];

      const data = snap.data() || {};

      return [String(idMiembro), data.fechaUltimaPresencia || ''];
    })
  );

  return Object.fromEntries(entries);
};

export const limpiarAsistenciaDestacamento = async ({
  fecha,
  idDestacamento,
  usuario = null,
} = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !fecha || !idDestacamento) {
    throw new Error('Firebase no esta configurado para limpiar asistencia.');
  }

  const idDest = String(idDestacamento);
  const idAsistencia = getAttendanceDocId(fecha, idDest);
  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_REGISTROS_ASISTENCIA),
      where('fecha', '==', String(fecha)),
      where('idDestacamento', '==', idDest)
    )
  );
  const batch = writeBatch(FIRESTORE);

  snapshot.docs.forEach((item) => {
    batch.delete(item.ref);
  });

  batch.delete(doc(FIRESTORE, COLECCION_ASISTENCIAS, idAsistencia));

  await batch.commit();

  registrarAuditoriaSilenciosa({
    modulo: 'asistencia',
    accion: 'asistencia_limpiada',
    descripcion: `Se limpio la asistencia del destacamento ${idDest} para ${fecha}.`,
    entidad: {
      tipo: 'asistencia',
      id: idAsistencia,
      nombre: idDest,
      ruta: '/dashboard/attendance',
    },
    despues: {
      fecha: String(fecha),
      idDestacamento: idDest,
      registrosEliminados: snapshot.docs.length,
    },
    realizadoPor: usuario,
    origen: 'asistencia',
  });

  return {
    idAsistencia,
    registrosEliminados: snapshot.docs.length,
  };
};

export const guardarAsistenciaDestacamento = async ({
  fecha,
  destacamento = {},
  miembros = [],
  estados = {},
  usuario = null,
} = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !fecha || !destacamento?.idDestacamento) {
    throw new Error('Firebase no esta configurado para guardar asistencia.');
  }

  const idDestacamento = String(destacamento.idDestacamento);
  const idAsistencia = getAttendanceDocId(fecha, idDestacamento);
  const now = new Date().toISOString();
  const batch = writeBatch(FIRESTORE);
  const conteo = {
    presentes: 0,
    ausentes: 0,
    excusas: 0,
    ausentesSinMarcar: 0,
  };
  const estadosResumen = {};

  miembros.forEach((member) => {
    const idMiembro = String(member.idMiembro || member.idMiembros || member.id || member.memberId || '');
    if (!idMiembro) return;

    const estadoUi = estados[idMiembro] || 'absent-unmarked';
    const estado = convertirEstadoAsistenciaAFirebase(estadoUi);
    const idRegistro = `${idAsistencia}_${normalizeIdSegment(idMiembro)}`;

    if (estado === 'presente') conteo.presentes += 1;
    if (estado === 'ausente') conteo.ausentes += 1;
    if (estado === 'excusa') conteo.excusas += 1;
    if (estado === 'ausente_sin_marcar') conteo.ausentesSinMarcar += 1;

    estadosResumen[idMiembro] = estado;

    const registro = {
      idRegistro,
      idAsistencia,
      fecha: String(fecha),
      idDestacamento,
      nombreDestacamento: destacamento.nombreDestacamento || '',
      idMiembro,
      codigoMiembro: getMemberCode(member),
      nombreMiembro: getMemberName(member),
      division: member.memberDivision || member.division || member.divisionName || '',
      estado,
      marcadoManualmente: estado !== 'ausente_sin_marcar',
      actualizadoEn: now,
      actualizadoPor: usuario || null,
      actualizadoEnServidor: serverTimestamp(),
    };

    batch.set(doc(FIRESTORE, COLECCION_REGISTROS_ASISTENCIA, idRegistro), registro, {
      merge: true,
    });

    if (estado === 'presente') {
      batch.set(
        doc(FIRESTORE, COLECCION_ULTIMAS_ASISTENCIAS_MIEMBROS, idMiembro),
        {
          idMiembro,
          codigoMiembro: registro.codigoMiembro,
          nombreMiembro: registro.nombreMiembro,
          fechaUltimaPresencia: String(fecha),
          idDestacamento,
          nombreDestacamento: registro.nombreDestacamento,
          actualizadoEn: now,
          actualizadoEnServidor: serverTimestamp(),
        },
        { merge: true }
      );
    }
  });

  const asistencia = {
    idAsistencia,
    fecha: String(fecha),
    idDestacamento,
    nombreDestacamento: destacamento.nombreDestacamento || '',
    estados: estadosResumen,
    conteo,
    totalMiembros: miembros.length,
    actualizadoEn: now,
    actualizadoPor: usuario || null,
    actualizadoEnServidor: serverTimestamp(),
  };

  batch.set(doc(FIRESTORE, COLECCION_ASISTENCIAS, idAsistencia), asistencia, { merge: true });

  await batch.commit();

  registrarAuditoriaSilenciosa({
    modulo: 'asistencia',
    accion: 'asistencia_guardada',
    descripcion: `Se guardó la asistencia de ${asistencia.nombreDestacamento || idDestacamento}.`,
    entidad: {
      tipo: 'asistencia',
      id: idAsistencia,
      nombre: asistencia.nombreDestacamento || idDestacamento,
      ruta: '/dashboard/attendance',
    },
    despues: {
      fecha: asistencia.fecha,
      idDestacamento,
      conteo,
      totalMiembros: asistencia.totalMiembros,
    },
    realizadoPor: usuario,
    origen: 'asistencia',
  });

  return asistencia;
};
