import { esUidDeBuzon, BUZON_OFICINA_NACIONAL } from './chat-buzones.mjs';

// ----------------------------------------------------------------------
// EL RESUMEN DIARIO DE DESTACAMENTOS ACTUALIZADOS.
//
// La landing de registro (proyecto aparte, `errd-registro`) guarda cada envío en
// `actualizaciones_destacamentos`. Cada mañana a las 9:00 (hora de Santo
// Domingo) una función programada cuenta cuántos destacamentos DISTINTOS han
// enviado y avisa por la campana y por push a quien revisa esa bandeja: Oficina
// Nacional y Administrador Global (los mismos cargos que su regla de lectura).
//
// UN DESTACAMENTO CUENTA UNA VEZ, aunque envíe varias. Los del padrón se
// reconocen por su id; los nuevos (sin id) por sección + nombre, sin tildes ni
// mayúsculas. Es la misma clave que usa el mapa de la landing
// (`errd-registro/src/server/envios.mjs`): si una cambia, cambia la otra, o el
// aviso y el mapa dirían números distintos.
//
// Aquí solo está la decisión (sin Firestore salvo la lectura de destinatarios,
// que recibe `db`), para probarla desde `node --test` y usarla desde la función
// de Netlify, que no puede cargar módulos con `server-only`.
// ----------------------------------------------------------------------

export const COLECCION_ACTUALIZACIONES = 'actualizaciones_destacamentos';
export const TIPO_RESUMEN_ACTUALIZACIONES = 'resumen_actualizaciones_destacamentos';
export const RUTA_BANDEJA_ACTUALIZACIONES = '/dashboard/admin/actualizaciones-destacamentos';

// República Dominicana no cambia de hora: siempre UTC-4.
const DESFASE_SANTO_DOMINGO_MS = -4 * 60 * 60 * 1000;

const sinTildes = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const claveDeDestacamento = (envio = {}) =>
  envio.destacamento?.id
    ? `id:${envio.destacamento.id}`
    : `nuevo:${envio.seccion?.id ?? ''}:${sinTildes(envio.destacamento?.nombre ?? envio.nombreDestacamento)}`;

/** Cuántos destacamentos distintos han enviado, y cuántos envíos hay en total. */
export const contarDestacamentosActualizados = (envios = []) => {
  const claves = new Set(envios.map(claveDeDestacamento));

  return { destacamentos: claves.size, envios: envios.length };
};

/** "2026-10-01" en hora de Santo Domingo: el id del aviso lleva la fecha dentro. */
export const fechaEnSantoDomingo = (ahora = new Date()) =>
  new Date(ahora.getTime() + DESFASE_SANTO_DOMINGO_MS).toISOString().slice(0, 10);

export const textoDelResumen = ({ destacamentos }) =>
  destacamentos === 1
    ? 'Hasta el momento, 1 destacamento ha actualizado su información.'
    : `Hasta el momento, ${destacamentos} destacamentos han actualizado su información.`;

/**
 * El documento del aviso, con la forma de `notificaciones`. El id lleva la fecha:
 * si la tarea corre dos veces el mismo día, la segunda pisa a la primera en vez
 * de duplicar el aviso.
 */
export const construirAvisoDeResumen = ({ conteo, idsDestinatarios, ahora = new Date() }) => {
  const fecha = fechaEnSantoDomingo(ahora);
  const iso = ahora.toISOString();
  const mensaje = textoDelResumen(conteo);

  return {
    id: `${TIPO_RESUMEN_ACTUALIZACIONES}_${fecha}`,
    tipoNotificacion: TIPO_RESUMEN_ACTUALIZACIONES,
    modulo: 'destacamentos',
    titulo: 'Destacamentos actualizados',
    tituloHtml: null,
    mensaje,
    mensajeVisual: mensaje,
    rolDestinatario: 'admin',
    idsDestinatarios,
    prioridad: 'informativa',
    estado: 'no_leida',
    fechaCreacion: iso,
    fechaEnvio: iso,
    actorId: 'sistema',
    actorTipo: 'sistema',
    actorNombre: 'Sistema',
    actorFotoURL: null,
    entidadTipo: 'actualizaciones_destacamentos',
    entidadId: fecha,
    ruta: RUTA_BANDEJA_ACTUALIZACIONES,
    imagenTipo: 'icono',
    imagenURL: null,
    miniaturaURL: null,
    tipoAccion: 'ver',
    etiquetaAccion: 'Ver actualizaciones',
    tipoAccionSecundaria: null,
    etiquetaAccionSecundaria: null,
    leidaPor: [],
    fechaProgramada: null,
    fechaExpiracion: null,
    fechaLectura: null,
    metadatos: {
      destacamentosActualizados: conteo.destacamentos,
      enviosRecibidos: conteo.envios,
      fechaEjecucion: fecha,
    },
  };
};

/**
 * Quien recibe el resumen: quien ejerce Oficina Nacional o Administrador Global
 * en cualquier posición, más los administradores de las cuentas antiguas. Igual
 * que `perfilesDelBuzon` de la Oficina Nacional, pero con el `db` que se le pase.
 */
export const leerDestinatariosDelResumen = async (db) => {
  const cargos = [...BUZON_OFICINA_NACIONAL.cargos];
  const [porRol, porCargoSecundario, heredados, admins] = await Promise.all([
    db.collection('usuarios_roles').where('rolId', 'in', cargos).get(),
    db
      .collection('usuarios_roles')
      .where('rolesQueEjerce', 'array-contains-any', cargos)
      .get()
      .catch(() => ({ docs: [] })),
    db.collection('usuarios_roles').where('rol', '==', 'administrador').get(),
    db.collection('admins').get(),
  ]);
  const uids = new Set();

  [...porRol.docs, ...porCargoSecundario.docs, ...heredados.docs].forEach((doc) => {
    const datos = doc.data() ?? {};
    uids.add(String(datos.uid ?? datos.uidUsuario ?? doc.id).trim());
  });
  admins.docs.forEach((doc) => uids.add(String(doc.data()?.uid ?? doc.id).trim()));

  return [...uids].filter((uid) => uid && !esUidDeBuzon(uid));
};
