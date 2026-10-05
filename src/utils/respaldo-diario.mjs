// ----------------------------------------------------------------------
// EL RESPALDO DIARIO EN LA NUBE.
//
// Por si la aplicación llegara a quedarse sin datos. Cada noche el servidor
// guarda en Storage (`respaldos/AAAA-MM-DD/`) TODO lo que la aplicación necesita
// para volver a estar como estaba:
//  - Firestore entero, con sus subcolecciones (mensajes del chat, historial…).
//  - El padrón de la API .NET (vive en otro servidor, fuera de Google).
//  - Las cuentas de acceso de Firebase Auth (sin contraseñas).
//  - Una copia espejo de los archivos de Storage (`respaldos/archivos/`), que
//    solo copia lo nuevo o cambiado y NO borra lo que se borre del original.
// Se conservan 14 días; el espejo de archivos, siempre. Al terminar, Sistema
// manda el resumen al chat "ADMINISTRADORES GLOBALES".
//
// Antes el único respaldo era el botón de Mantenimiento, a mano, que bajaba 13
// colecciones a la computadora de quien lo pulsara: el último era de hacía 41
// días. Sin React ni Firebase, para probarlo con `node --test`.
// ----------------------------------------------------------------------

import { fechaLegibleSalud } from './salud-sistema.mjs';

export const CARPETA_RESPALDOS = 'respaldos';
export const CARPETA_ESPEJO_ARCHIVOS = `${CARPETA_RESPALDOS}/archivos`;
export const DIAS_QUE_SE_CONSERVAN = 14;

// El padrón de la API .NET, servicio por servicio (las mismas rutas que lee la app).
export const SERVICIOS_PADRON = [
  { id: 'miembros', nombre: 'Miembros', ruta: '/Miembros/GetAllMiembros' },
  { id: 'destacamentos', nombre: 'Destacamentos', ruta: '/Destacamentos/GetAllDestacamentos' },
  { id: 'secciones', nombre: 'Secciones', ruta: '/Secciones/GetAllSecciones' },
  { id: 'regiones', nombre: 'Regiones', ruta: '/Regiones/GetAllRegiones' },
  { id: 'iglesias', nombre: 'Iglesias', ruta: '/Iglesias/GetAllIglesias' },
  { id: 'divisiones', nombre: 'Divisiones', ruta: '/Divisiones/GetAllDivisiones' },
  { id: 'paises', nombre: 'Países', ruta: '/Paises/GetListPaises' },
  { id: 'cargos', nombre: 'Cargos', ruta: '/Cargos/GetAllCargos' },
  {
    id: 'cargos_miembros',
    nombre: 'Cargos de miembros',
    ruta: '/CargosMiembros/GetAllCargosMiembros',
  },
  { id: 'tutores', nombre: 'Tutores', ruta: '/Tutores/GetAllTutores' },
];

/** `respaldos/2026-10-02` */
export const carpetaDelDia = (fechaClave) => `${CARPETA_RESPALDOS}/${fechaClave}`;

/** ¿Es una carpeta diaria vieja, que ya se puede borrar? El espejo de archivos nunca. */
export const esCarpetaDiariaVencida = (ruta, fechaClaveHoy, dias = DIAS_QUE_SE_CONSERVAN) => {
  const coincide = String(ruta).match(/^respaldos\/(\d{4}-\d{2}-\d{2})\//);

  if (!coincide) return false;

  const diferencia =
    (Date.parse(`${fechaClaveHoy}T00:00:00Z`) - Date.parse(`${coincide[1]}T00:00:00Z`)) /
    86_400_000;

  return diferencia >= dias;
};

/** Las filas de una respuesta de la API .NET, venga como venga. */
export const filasDelPadron = (respuesta) => {
  if (Array.isArray(respuesta)) return respuesta;
  if (Array.isArray(respuesta?.data)) return respuesta.data;
  if (Array.isArray(respuesta?.Data)) return respuesta.Data;
  if (Array.isArray(respuesta?.result)) return respuesta.result;

  return [];
};

// ---------------------------------------------------------------- Firestore

/**
 * Un valor de Firestore a JSON SIN perder su tipo: una fecha guardada como
 * texto volvería como texto y las pantallas que esperan una fecha fallarían.
 * `revivirValor` hace lo contrario al restaurar.
 */
export const serializarValor = (valor) => {
  if (valor === null || valor === undefined) return valor ?? null;
  if (Array.isArray(valor)) return valor.map(serializarValor);
  if (typeof valor !== 'object') return valor;

  if (typeof valor.toDate === 'function' && 'seconds' in valor && 'nanoseconds' in valor) {
    return { __tipo: 'fecha', s: valor.seconds, ns: valor.nanoseconds };
  }
  if (typeof valor.path === 'string' && typeof valor.collection === 'function') {
    return { __tipo: 'referencia', ruta: valor.path };
  }
  if ('latitude' in valor && 'longitude' in valor && Object.keys(valor).length <= 2) {
    return { __tipo: 'geopunto', lat: valor.latitude, lng: valor.longitude };
  }
  if (valor instanceof Uint8Array) {
    return { __tipo: 'bytes', base64: Buffer.from(valor).toString('base64') };
  }

  return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, serializarValor(v)]));
};

/** Al restaurar: de vuelta a los tipos de Firestore. Recibe sus constructores. */
export const revivirValor = (valor, { Timestamp, GeoPoint, referencia }) => {
  if (valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor))
    return valor.map((v) => revivirValor(v, { Timestamp, GeoPoint, referencia }));

  switch (valor.__tipo) {
    case 'fecha':
      return new Timestamp(valor.s, valor.ns);
    case 'referencia':
      return referencia(valor.ruta);
    case 'geopunto':
      return new GeoPoint(valor.lat, valor.lng);
    case 'bytes':
      return Buffer.from(valor.base64, 'base64');
    default:
      return Object.fromEntries(
        Object.entries(valor).map(([k, v]) => [
          k,
          revivirValor(v, { Timestamp, GeoPoint, referencia }),
        ])
      );
  }
};

// ---------------------------------------------------------------- Textos

// "11.409": punto de miles, porque los decimales van con coma ("14,3 MB"). Con
// `toLocaleString('es-DO')` salía "11,409", que se leía como once coma cuatro.
const numero = (n) =>
  String(Math.round(Number(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** "14,3 MB", "512 KB". */
export const tamanoLegible = (bytes) => {
  const b = Number(bytes || 0);

  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;

  return `${(b / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;
};

/** "1 min 40 s", "35 s". */
export const duracionLegible = (milis) => {
  const s = Math.round(Number(milis || 0) / 1000);

  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
};

/**
 * El mensaje del chat. Por parte: qué se guardó, cuánto se leyó (descargado) y
 * cuánto ocupa lo guardado (cargado). Lo que falló, arriba y en rojo.
 */
export const textoResumenRespaldo = ({
  partes = {},
  fallos = [],
  fecha = new Date(),
  duracionMs = 0,
  carpeta = '',
} = {}) => {
  const { firestore, padron, cuentas, archivos } = partes;
  const lineas = [
    `🗄️ Respaldo diario · ${fechaLegibleSalud(fecha)}`,
    fallos.length
      ? `Estado: 🔴 Incompleto (${fallos.length} ${fallos.length === 1 ? 'parte falló' : 'partes fallaron'}) · ${duracionLegible(duracionMs)}`
      : `Estado: ✅ Completo · ${duracionLegible(duracionMs)}`,
    '',
    ...fallos.map((f) => `🔴 ${f.parte}: ${f.mensaje}`),
  ];

  if (firestore) {
    lineas.push(
      `✅ Base de datos (Firestore): ${numero(firestore.documentos)} documentos de ${numero(firestore.colecciones)} colecciones · descargado ${tamanoLegible(firestore.bytesLeidos)}, guardado ${tamanoLegible(firestore.bytesGuardados)}`
    );
  }
  if (padron) {
    const detalle = padron.servicios
      .filter((s) => ['miembros', 'destacamentos', 'secciones', 'regiones'].includes(s.id))
      .map((s) => `${numero(s.filas)} ${s.nombre.toLowerCase()}`)
      .join(', ');

    lineas.push(
      `${padron.fallidos ? '⚠️' : '✅'} Padrón (API .NET): ${padron.servicios.length - padron.fallidos} de ${padron.servicios.length} servicios${detalle ? ` (${detalle})` : ''} · descargado ${tamanoLegible(padron.bytesLeidos)}, guardado ${tamanoLegible(padron.bytesGuardados)}`
    );
  }
  if (cuentas) {
    lineas.push(
      `✅ Cuentas de acceso: ${numero(cuentas.total)} · guardado ${tamanoLegible(cuentas.bytesGuardados)}`
    );
  }
  if (archivos) {
    lineas.push(
      `✅ Archivos (Storage): ${numero(archivos.total)} archivos, ${tamanoLegible(archivos.bytesTotal)} · hoy ${archivos.copiados ? `se copiaron ${numero(archivos.copiados)} nuevos o cambiados (${tamanoLegible(archivos.bytesCopiados)})` : 'sin cambios que copiar'}`
    );
  }

  lineas.push(
    '',
    `Guardado en Storage → ${carpeta} · se conservan ${DIAS_QUE_SE_CONSERVAN} días; los archivos, siempre.`
  );

  return lineas.join('\n');
};
