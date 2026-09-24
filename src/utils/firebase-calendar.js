import {
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  Timestamp,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export const COLECCION_CALENDARIO = 'actividades_calendario';
export const ZONA_HORARIA_CALENDARIO = 'America/Caracas';

const MESES_DOCUMENTO = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

// ----------------------------------------------------------------------

const getCalendarioCollection = () => collection(FIRESTORE, COLECCION_CALENDARIO);

const ensureFirebaseCalendar = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no esta configurado para el calendario.');
  }
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const toIso = (value) => {
  const date = toDate(value);

  return date ? date.toISOString() : '';
};

const toTimestamp = (value) => {
  const date = toDate(value);

  return date ? Timestamp.fromDate(date) : null;
};

const removeAccents = (value = '') =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const slugify = (value = '') =>
  removeAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const buildActivityDocumentId = (eventData = {}) => {
  const title = eventData.title || eventData.titulo || 'actividad';
  const date = toDate(eventData.start || eventData.fechaInicio) || new Date();
  const month = MESES_DOCUMENTO[date.getMonth()];
  const year = date.getFullYear();

  return `${slugify(title)}-${month}-${year}`;
};

const isUuid = (value = '') =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const normalizeActor = (actor = null) => {
  if (!actor) return null;

  const idMiembros = Number(actor.idMiembros || actor.id || actor.memberId || 0) || null;
  const codigoMiembro = actor.codigoMiembro || actor.memberId || actor.codigo || '';
  const nombre = actor.nombre || actor.displayName || actor.name || '';
  const correo = actor.correo || actor.email || '';

  if (!idMiembros && !codigoMiembro && !nombre && !correo) {
    return null;
  }

  return {
    idMiembros,
    codigoMiembro,
    nombre,
    correo,
  };
};

const normalizeScope = (scope = null) => {
  const level = scope?.nivel || scope?.level || 'nacional';
  const id = scope?.id || scope?.value || scope?.valor || (level === 'nacional' ? 'nacional' : '');
  const nombre = scope?.nombre || scope?.label || (level === 'nacional' ? 'Nacional' : '');

  return {
    nivel: level,
    id: String(id),
    nombre,
  };
};

export const toCalendarEvent = (documentSnapshot) => {
  const data =
    typeof documentSnapshot.data === 'function' ? documentSnapshot.data() : documentSnapshot;
  const id = documentSnapshot.id || data.id;
  const color = data.color || '#00A76F';

  return {
    id,
    title: data.titulo || data.title || '',
    description: data.descripcion || data.description || '',
    color,
    textColor: color,
    allDay: Boolean(data.todoElDia ?? data.allDay),
    start: toIso(data.fechaInicio || data.start),
    end: toIso(data.fechaFin || data.end),
    extendedProps: {
      tipo: data.tipo || 'actividad',
      estado: data.estado || 'publicado',
      ubicacion: data.ubicacion || null,
      visibleParaTodos: data.visibleParaTodos !== false,
      destacado: Boolean(data.destacado),
      zonaHoraria: data.zonaHoraria || ZONA_HORARIA_CALENDARIO,
      alcance: normalizeScope(data.alcance),
    },
  };
};

export const toFirestoreCalendarDoc = (eventData, options = {}) => {
  const { includeCreatedFields = false } = options;
  const fechaInicio = toTimestamp(eventData.start || eventData.fechaInicio);
  const fechaFin = toTimestamp(eventData.end || eventData.fechaFin);
  const creadoPor = normalizeActor(eventData.creadoPor);
  const actualizadoPor = normalizeActor(eventData.actualizadoPor);

  const calendarDoc = {
    titulo: eventData.title || eventData.titulo || '',
    descripcion: eventData.description || eventData.descripcion || '',
    tipo: eventData.tipo || eventData.extendedProps?.tipo || 'actividad',
    fechaInicio,
    fechaFin,
    todoElDia: Boolean(eventData.allDay ?? eventData.todoElDia),
    zonaHoraria:
      eventData.zonaHoraria || eventData.extendedProps?.zonaHoraria || ZONA_HORARIA_CALENDARIO,
    color: eventData.color || '#00A76F',
    estado: eventData.estado || eventData.extendedProps?.estado || 'publicado',
    ubicacion: eventData.ubicacion ||
      eventData.extendedProps?.ubicacion || {
        nombre: '',
        direccion: '',
        latitud: null,
        longitud: null,
      },
    visibleParaTodos: eventData.visibleParaTodos ?? eventData.extendedProps?.visibleParaTodos ?? true,
    destacado: Boolean(eventData.destacado ?? eventData.extendedProps?.destacado),
    alcance: normalizeScope(eventData.alcance || eventData.extendedProps?.alcance),
    actualizadoEn: serverTimestamp(),
  };

  if (actualizadoPor) {
    calendarDoc.actualizadoPor = actualizadoPor;
  }

  if (includeCreatedFields) {
    if (creadoPor) {
      calendarDoc.creadoPor = creadoPor;
    }
    calendarDoc.creadoEn = serverTimestamp();
  }

  return calendarDoc;
};

export async function obtenerActividadesCalendario() {
  ensureFirebaseCalendar();

  const snapshot = await getDocs(getCalendarioCollection());

  return snapshot.docs
    .map(toCalendarEvent)
    .filter(
      (event) =>
        event.extendedProps.estado === 'publicado' && event.extendedProps.visibleParaTodos === true
    )
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export async function guardarActividadCalendario(eventData) {
  ensureFirebaseCalendar();

  const actividadId = eventData.id && !isUuid(eventData.id) ? eventData.id : buildActivityDocumentId(eventData);
  const actividadRef = actividadId
    ? doc(FIRESTORE, COLECCION_CALENDARIO, actividadId)
    : doc(getCalendarioCollection());

  await setDoc(
    actividadRef,
    toFirestoreCalendarDoc({ ...eventData, id: actividadRef.id }, { includeCreatedFields: true }),
    { merge: true }
  );

  return actividadRef.id;
}

export async function actualizarActividadCalendario(eventData) {
  ensureFirebaseCalendar();

  await setDoc(
    doc(FIRESTORE, COLECCION_CALENDARIO, eventData.id),
    toFirestoreCalendarDoc(eventData),
    { merge: true }
  );
}

export async function eliminarActividadCalendario(eventId) {
  ensureFirebaseCalendar();

  await deleteDoc(doc(FIRESTORE, COLECCION_CALENDARIO, String(eventId)));
}
