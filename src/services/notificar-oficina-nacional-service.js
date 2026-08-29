import { getDocs, collection } from 'firebase/firestore';

import { paths } from 'src/routes/paths';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { ROLES } from 'src/auth/permissions/roles';

import { crearNotificacionAdmin } from './notification-service';

// ----------------------------------------------------------------------
// Aviso a quien tiene que resolver.
//
// Sin esto la bandeja hay que ir a mirarla por si acaso, y una propuesta puede
// quedarse semanas ahi sin que nadie se entere. El aviso va a la Oficina
// Nacional y al Administrador Global, que son los dos que pueden resolverla.
// ----------------------------------------------------------------------

const ROLES_QUE_RESUELVEN = [ROLES.OFICINA_NACIONAL, ROLES.ADMINISTRADOR_GLOBAL];

const obtenerDestinatarios = async () => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const ids = new Set();

  const leer = async (nombreColeccion) => {
    try {
      const snapshot = await getDocs(collection(FIRESTORE, nombreColeccion));

      snapshot.docs.forEach((documento) => {
        const datos = documento.data() ?? {};
        const rol = String(datos.rolId ?? datos.roleId ?? datos.rol ?? '')
          .trim()
          .toLowerCase();

        if (!ROLES_QUE_RESUELVEN.includes(rol)) return;

        const id = datos.uid ?? datos.idUsuario ?? datos.idMiembros ?? documento.id;

        if (id) ids.add(String(id));
      });
    } catch (error) {
      console.warn(`[oficina-nacional] no se pudo leer ${nombreColeccion}`, error);
    }
  };

  await Promise.all([leer('admins'), leer('users'), leer('usuarios_roles')]);

  return [...ids];
};

export async function notificarCambioPropuesto({ solicitud = {}, usuario = {} } = {}) {
  // Las fotos mandan su propio aviso, con la imagen de antes y la de despues.
  // Este seria el mismo mensaje sin las imagenes.
  if (['foto_destacamento', 'foto_seccion'].includes(solicitud?.ambito)) return null;

  const destinatarios = await obtenerDestinatarios();

  // Sin nadie con el rol, no se inventa un destinatario: la propuesta ya quedo
  // guardada y en Historial, y el aviso es un extra, no la garantia.
  if (!destinatarios.length) {
    console.warn('[oficina-nacional] no hay nadie con el rol para avisar de la propuesta');
    return null;
  }

  const quien = solicitud?.solicitadoPorNombre || 'Alguien';
  const que = solicitud?.entidad?.nombre || solicitud?.ambito || 'la organización';

  return crearNotificacionAdmin({
    tipoNotificacion: 'cambio_propuesto',
    modulo: 'aprobaciones',
    titulo: 'Cambio pendiente de aprobación',
    mensaje: `${quien} propuso cambios en ${que}. Requiere tu revisión.`,
    prioridad: 'importante',
    entidadTipo: solicitud?.entidad?.tipo || 'solicitud_cambio',
    entidadId: String(solicitud?.id || ''),
    ruta: paths.dashboard.admin.aprobaciones,
    etiquetaAccion: 'Revisar',
    metadatos: { ambito: solicitud?.ambito, idSolicitud: solicitud?.id },
    usuario,
    idsDestinatariosPrecalculados: destinatarios,
  });
}

/**
 * Aviso de que una propuesta se RETIRO.
 *
 * La tenian en la bandeja para revisar: si nadie les dice que ya no esta, la van
 * a buscar. No es un rechazo —nadie la juzgo—, asi que el mensaje dice quien la
 * retiro y no da a entender que se decidio algo.
 */
export async function notificarCambioDescartado({ solicitud = {}, actor = '', usuario = {} } = {}) {
  const destinatarios = await obtenerDestinatarios();

  if (!destinatarios.length) return null;

  const quien = actor || solicitud?.solicitadoPorNombre || 'Alguien';
  const que = solicitud?.entidad?.nombre || solicitud?.ambito || 'la organización';

  return crearNotificacionAdmin({
    tipoNotificacion: 'cambio_descartado',
    modulo: 'aprobaciones',
    titulo: 'Cambio retirado por quien lo envió',
    mensaje: `${quien} retiró los cambios que había propuesto en ${que}. Ya no hay nada que revisar.`,
    prioridad: 'informativa',
    entidadTipo: solicitud?.entidad?.tipo || 'solicitud_cambio',
    entidadId: String(solicitud?.id || ''),
    ruta: paths.dashboard.admin.aprobaciones,
    etiquetaAccion: 'Ver la bandeja',
    metadatos: { ambito: solicitud?.ambito, idSolicitud: solicitud?.id },
    usuario,
    idsDestinatariosPrecalculados: destinatarios,
  });
}

/**
 * Aviso de que la ficha de un destacamento CAMBIO.
 *
 * El de arriba avisa de lo que esta pendiente de aprobar; este, de lo que ya se
 * escribio. Modificar un destacamento lo hace el Administrador Global —y el
 * Coordinador de Destacamento en sus cuatro campos—, y en ninguno de esos dos
 * casos hay una propuesta que revisar: sin este aviso el cambio se enteraba
 * quien lo hizo y nadie mas.
 */
export async function notificarDestacamentoActualizado({
  destacamento = {},
  cambios = [],
  usuario = {},
} = {}) {
  const destinatarios = await obtenerDestinatarios();

  if (!destinatarios.length) {
    console.warn('[oficina-nacional] no hay nadie con el rol para avisar del cambio');
    return null;
  }

  const quien =
    usuario?.displayName || usuario?.nombre || usuario?.email || usuario?.correo || 'Alguien';
  const nombre = destacamento?.nombre || 'un destacamento';
  // QUE cambio, no solo que hubo cambios: es lo que decide si hay que mirarlo.
  const camposCambiados = (Array.isArray(cambios) ? cambios : [])
    .map((cambio) => cambio?.etiqueta || cambio?.campo)
    .filter(Boolean);
  const detalle = camposCambiados.length ? `: ${camposCambiados.join(', ')}` : '';

  return crearNotificacionAdmin({
    tipoNotificacion: 'destacamento_actualizado',
    modulo: 'destacamentos',
    titulo: 'Destacamento actualizado',
    mensaje: `${quien} modificó ${nombre}${detalle}.`,
    prioridad: 'informativa',
    entidadTipo: 'destacamento',
    entidadId: String(destacamento?.id || ''),
    ruta: destacamento?.id
      ? `/dashboard/level/dest/${destacamento.id}/edit`
      : '/dashboard/level/dest',
    etiquetaAccion: 'Ver',
    metadatos: { idDestacamento: destacamento?.id, campos: camposCambiados },
    usuario,
    idsDestinatariosPrecalculados: destinatarios,
  });
}

/**
 * Aviso de que la DIRECTIVA de una region cambio.
 *
 * El Director Regional y su Sub-Director componen el organigrama de su region
 * sin pedir permiso: la asignacion ya esta escrita cuando llega este aviso. No
 * es una propuesta ni pide nada, es que la Oficina Nacional y el Administrador
 * Global se enteren de quien entro o salio de una casilla regional sin tener que
 * ir a mirarlo.
 */
export async function notificarDirectivaRegionActualizada({
  idRegion,
  nombreRegion = '',
  nombreCargo = '',
  nombreMiembro = '',
  activo = true,
  usuario = {},
} = {}) {
  const destinatarios = await obtenerDestinatarios();

  if (!destinatarios.length) {
    console.warn('[oficina-nacional] no hay nadie con el rol para avisar de la directiva regional');
    return null;
  }

  const quien =
    usuario?.displayName || usuario?.nombre || usuario?.email || usuario?.correo || 'Alguien';
  const donde = String(nombreRegion || '').trim() || 'su región';
  const casilla = String(nombreCargo || '').trim() || 'un cargo';
  const aQuien = String(nombreMiembro || '').trim();

  return crearNotificacionAdmin({
    tipoNotificacion: 'directiva_region_modificada',
    modulo: 'regiones',
    titulo: 'Directiva regional actualizada',
    mensaje: activo
      ? `${quien} asignó ${casilla}${aQuien ? ` a ${aQuien}` : ''} en ${donde}.`
      : `${quien} liberó ${casilla}${aQuien ? ` (${aQuien})` : ''} en ${donde}.`,
    // Informativa a proposito: no hay nada que resolver, ya esta hecho.
    prioridad: 'informativa',
    entidadTipo: 'region',
    entidadId: String(idRegion || ''),
    ruta: idRegion
      ? `/dashboard/level/regional/${idRegion}/edit/leadership`
      : '/dashboard/level/regional',
    etiquetaAccion: 'Ver la directiva',
    metadatos: { idRegion: String(idRegion || ''), cargo: casilla, activo },
    usuario,
    idsDestinatariosPrecalculados: destinatarios,
  });
}

/**
 * Foto de destacamento sugerida: se ve la de antes y la de despues.
 *
 * Una foto no se juzga por su nombre de archivo. El aviso lleva las dos
 * imagenes para que se pueda decidir sin abrir nada mas, y la ruta apunta a la
 * bandeja de aprobaciones, que es donde se resuelve.
 */
// Como se nombra cada entidad y a donde lleva su ficha. Es lo unico que cambia
// entre un aviso de foto y otro; el plural va escrito porque 'región' no lo hace
// con una 's' y el modulo salia como "regións".
const FOTO_ENTIDAD = {
  destacamento: {
    nombre: 'destacamento',
    plural: 'destacamentos',
    ruta: (id) => `/dashboard/level/dest/${id}/edit`,
  },
  seccion: {
    nombre: 'sección',
    plural: 'secciones',
    ruta: (id) => `/dashboard/level/sectional/${id}/edit`,
  },
  region: {
    nombre: 'región',
    plural: 'regiones',
    ruta: (id) => `/dashboard/level/regional/${id}/edit`,
  },
};

export async function notificarFotoEntidadPropuesta({
  // 'destacamento', 'seccion' o 'region': solo cambia como se nombra y a donde
  // lleva.
  tipoEntidad = 'destacamento',
  entidad = {},
  urlAntes = '',
  urlDespues = '',
  pendiente = true,
  usuario = {},
} = {}) {
  const destinatarios = await obtenerDestinatarios();

  if (!destinatarios.length) {
    console.warn('[oficina-nacional] no hay nadie con el rol para avisar de la foto');
    return null;
  }

  const quien =
    usuario?.displayName || usuario?.nombre || usuario?.email || usuario?.correo || 'Alguien';
  const cual = FOTO_ENTIDAD[tipoEntidad] || FOTO_ENTIDAD.destacamento;
  const comoSeLlama = cual.nombre;
  const nombre = entidad?.nombre || `una ${comoSeLlama}`;
  const rutaDeLaFicha = cual.ruta(entidad?.id || '');

  return crearNotificacionAdmin({
    tipoNotificacion: pendiente ? `foto_${tipoEntidad}_propuesta` : `foto_${tipoEntidad}_actualizada`,
    modulo: pendiente ? 'aprobaciones' : cual.plural,
    titulo: pendiente
      ? `Foto de ${comoSeLlama} sugerida`
      : `Foto de ${comoSeLlama} actualizada`,
    mensaje: pendiente
      ? `${quien} sugiere cambiar la foto de ${nombre}. Requiere tu revisión.`
      : `${quien} cambió la foto de ${nombre}.`,
    prioridad: pendiente ? 'importante' : 'informativa',
    entidadTipo: tipoEntidad,
    entidadId: String(entidad?.id || ''),
    ruta: pendiente ? paths.dashboard.admin.aprobaciones : rutaDeLaFicha,
    // La propuesta va de imagen: se manda como imagen, no como icono.
    imagenTipo: 'imagen',
    imagenURL: urlDespues || null,
    miniaturaURL: urlAntes || null,
    etiquetaAccion: pendiente ? 'Revisar' : 'Ver',
    metadatos: {
      tipoEntidad,
      idEntidad: entidad?.id,
      fotoAntes: urlAntes || '',
      fotoDespues: urlDespues || '',
    },
    usuario,
    idsDestinatariosPrecalculados: destinatarios,
  });
}
