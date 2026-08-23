import 'server-only';

import { getAdminDb } from 'src/server/firebase-admin';

// ----------------------------------------------------------------------
// Cerrar la peticion de ayuda de un miembro.
//
// La solicitud llega a los DOS coordinadores del destacamento a la vez. En
// cuanto uno la resuelve —le genera un codigo, o el miembro vuelve a entrar por
// su cuenta— el otro tiene que verlo, o acaba haciendo el mismo trabajo y
// tumbando el codigo que el primero ya habia dictado.
// ----------------------------------------------------------------------

const COLECCION = 'notificaciones';
const TIPO = 'recuperacion_clave_miembro';

export const marcarSolicitudesRecuperacionAtendidas = async ({
  idMiembros,
  atendidaPor = '',
  nombreAtendio = '',
  motivo = '',
}) => {
  if (!idMiembros) return 0;

  const db = getAdminDb();
  const encontradas = await db
    .collection(COLECCION)
    .where('tipoNotificacion', '==', TIPO)
    .where('entidadId', '==', String(idMiembros))
    .get()
    .catch((error) => {
      console.error('[recuperacion] no se pudieron leer las solicitudes', error);

      return null;
    });

  const pendientes = (encontradas?.docs ?? []).filter(
    (documento) => documento.data()?.estado !== 'atendida'
  );

  if (!pendientes.length) return 0;

  const ahora = new Date().toISOString();

  await Promise.all(
    pendientes.map((documento) =>
      documento.ref.set(
        {
          estado: 'atendida',
          fechaAtencion: ahora,
          atendidaPor: atendidaPor ? [String(atendidaPor)] : [],
          metadatos: {
            ...(documento.data()?.metadatos ?? {}),
            atendida: true,
            atendidaEn: ahora,
            atendidaPorNombre: nombreAtendio || '',
            atendidaMotivo: motivo,
          },
        },
        { merge: true }
      )
    )
  );

  return pendientes.length;
};

/** El nombre con el que se le conoce en su perfil, para poder decir quien fue. */
export const nombreDeUsuario = async (uid) => {
  if (!uid) return '';

  const documento = await getAdminDb()
    .collection('usuarios_roles')
    .doc(String(uid))
    .get()
    .catch(() => null);

  const datos = documento?.exists ? documento.data() : null;

  return String(datos?.nombre || datos?.displayName || '').trim();
};
