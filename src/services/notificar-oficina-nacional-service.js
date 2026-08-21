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
