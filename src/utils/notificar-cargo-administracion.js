import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';

import { FIRESTORE } from 'src/lib/firebase';
import { resolverNotificacionConConfiguracion } from 'src/services/notification-service';

import { ROLES_POR_CODIGO } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// AL INTERESADO, NO SOLO A LOS DEMAS ADMINISTRADORES.
//
// Cuando se reparte un cargo ya salia un aviso, pero iba dirigido al RESTO de los
// administradores: la unica persona que no se enteraba era aquella a la que le
// cambiaban lo que puede hacer. Entraba al dia siguiente y se encontraba
// pantallas nuevas —o pantallas que ya no estaban— sin nada que se lo explicara.
//
// Este aviso va a esa persona y a nadie mas. El de los administradores sigue
// donde estaba: son dos avisos porque son dos noticias distintas.
// ----------------------------------------------------------------------

const nombreDelCargo = (rolId, rolNombre = '') =>
  rolNombre || ROLES_POR_CODIGO[String(rolId ?? '').trim()]?.nombre || rolId || 'un nuevo cargo';

/**
 * Avisa a quien acaba de recibir —o perder— un cargo de administracion.
 *
 * NO BLOQUEA ni propaga: el cargo ya esta guardado cuando esto se llama, y que
 * falle un aviso no puede deshacer un cambio que ya es real. Se registra en
 * consola y se sigue.
 */
export const notificarCargoDeAdministracion = async ({
  uidUsuario,
  nombre = '',
  rolId,
  rolNombre = '',
  actor = {},
} = {}) => {
  const destinatario = String(uidUsuario ?? '').trim();

  if (!FIRESTORE || !destinatario || !rolId) return null;

  try {
    const esQuitar = String(rolId).trim() === 'usuario_comun';
    const cargo = nombreDelCargo(rolId, rolNombre);
    const ahora = new Date().toISOString();
    const mensaje = esQuitar
      ? 'Ya no tienes un cargo de administración: tu cuenta vuelve a ser de usuario común.'
      : `Ahora eres ${cargo}. Al volver a entrar verás lo que ese cargo te permite.`;

    const notificacion = await resolverNotificacionConConfiguracion({
      // El identificador lleva el destinatario y la hora: dos cambios seguidos
      // sobre la misma persona son dos avisos, no uno que pisa al otro.
      id: `cargo_administracion_${destinatario}_${Date.now()}`,
      tipoNotificacion: 'permisos_cambiados',
      modulo: 'administradores',
      titulo: esQuitar ? 'Se retiró tu cargo de administración' : 'Tienes un cargo nuevo',
      tituloHtml: `<p>${mensaje}</p>`,
      mensaje,
      mensajeVisual: mensaje,
      idsDestinatarios: [destinatario],
      prioridad: 'importante',
      estado: 'no_leida',
      fechaCreacion: ahora,
      fechaEnvio: ahora,
      actorId: String(actor?.uid || actor?.email || 'sistema'),
      actorTipo: 'admin',
      actorNombre: actor?.displayName || actor?.nombre || actor?.email || 'Administración',
      entidadTipo: 'administrador',
      entidadId: destinatario,
      // A su propia cuenta: es donde ve lo que tiene, no a la lista de
      // administradores, que puede no poder abrir.
      ruta: '/dashboard/user/account',
      metadatos: { rolId, cargo, nombre },
      actualizadoEnServidor: serverTimestamp(),
    });

    if (!notificacion) return null;

    await setDoc(
      doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificacion.id),
      notificacion
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('notificaciones:actualizar'));
    }

    return notificacion.id;
  } catch (error) {
    console.warn('[cargo de administración] no se pudo avisar a la persona', error);

    return null;
  }
};
