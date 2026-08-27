import 'server-only';

import { resolverRolesPorAsignaciones } from 'src/catalogs/directiva-roles';

import { ROLES } from 'src/auth/permissions/roles';
import { deriveUserClaims } from 'src/auth/permissions/user-claims';
import { PERMISOS_POR_ROL } from 'src/auth/permissions/role-permissions';

// ----------------------------------------------------------------------
// El rol que sale de las casillas de la directiva, escrito donde el servidor lo
// busca.
//
// Lo comparten las dos rutas que lo hacen: la que sincroniza a quien acaba de
// entrar y la que pone al dia a todas las cuentas de una vez. Una sola copia de
// la regla, para que no puedan discrepar.
// ----------------------------------------------------------------------

export const COLECCION_USUARIOS_ROLES = 'usuarios_roles';
export const COLECCION_ASIGNACIONES = 'asignacionesDirectiva';

// El alcance sale de las propias casillas: cada cargo manda sobre SU entidad.
const alcanceDeSusCargos = (cargos = []) => {
  const destino = { destacamento: 'destacamentos', seccional: 'secciones', regional: 'regiones' };
  const alcance = { destacamentos: [], secciones: [], regiones: [] };

  cargos.forEach((cargo) => {
    const clave = destino[cargo?.nivel];

    if (clave && cargo?.idEntidad) alcance[clave].push(String(cargo.idEntidad));
  });

  return {
    destacamentos: [...new Set(alcance.destacamentos)],
    secciones: [...new Set(alcance.secciones)],
    regiones: [...new Set(alcance.regiones)],
  };
};

/**
 * Que le corresponde a alguien segun sus asignaciones.
 *
 * Los permisos son los de TODOS sus cargos, no solo los del principal: las
 * reglas preguntan por un unico `rolId`, asi que quien entra por un cargo de
 * region —y ademas coordina su destacamento— se quedaba sin lo que le da el
 * cargo local. Con la lista completa en el documento, las reglas lo resuelven
 * por `tienePermisoDirecto` sin depender de cual sea el principal.
 */
export const resolverAccesoPorCargo = (asignaciones = []) => {
  const cargos = resolverRolesPorAsignaciones(asignaciones);

  return {
    cargos,
    rolId: cargos[0]?.rol ?? ROLES.USUARIO_COMUN,
    permisos: [...new Set(cargos.flatMap((cargo) => PERMISOS_POR_ROL[cargo.rol] ?? []))].sort(),
    alcance: alcanceDeSusCargos(cargos),
  };
};

/**
 * Lo escribe en `usuarios_roles/<uid>` —la puerta que miran las reglas— y
 * refresca los claims del token.
 */
export const escribirAccesoPorCargo = async ({ db, auth, uid, idMiembros, acceso }) => {
  await db
    .collection(COLECCION_USUARIOS_ROLES)
    .doc(String(uid))
    .set(
      {
        uid: String(uid),
        uidUsuario: String(uid),
        idMiembros: String(idMiembros),
        rolId: acceso.rolId,
        cargos: acceso.cargos,
        permisos: acceso.permisos,
        alcance: acceso.alcance,
        // Deja constancia de que lo puso el sistema a partir de la directiva,
        // para distinguirlo de una asignacion hecha por una persona.
        asignadoPor: 'sistema:cargo',
        sincronizadoEn: new Date().toISOString(),
        activo: true,
      },
      { merge: true }
    );

  // Los claims viajan en el token y los leen las reglas de Firestore; sin
  // refrescarlos, el servidor seguiria viendo el rol anterior hasta el proximo
  // inicio de sesion.
  await auth
    .setCustomUserClaims(
      String(uid),
      deriveUserClaims({
        rolId: acceso.rolId,
        alcance: acceso.alcance,
        idMiembros: String(idMiembros),
      })
    )
    .catch((error) => {
      console.warn('[rol-por-cargo] no se pudieron actualizar los claims', error);
    });
};

/** Las asignaciones activas de una persona. */
export const leerAsignacionesDe = async (db, idMiembros) => {
  const snapshot = await db
    .collection(COLECCION_ASIGNACIONES)
    .where('idMiembro', '==', String(idMiembros))
    .where('activo', '==', true)
    .get()
    .catch(() => null);

  return (snapshot?.docs ?? []).map((documento) => documento.data());
};
