import 'server-only';

import { getAdminDb } from 'src/server/firebase-admin';
import { ROLES_ASIGNADOS_A_MANO } from 'src/catalogs/directiva-roles';
import { buscarMiembroPorId, ubicacionDeDestacamento } from 'src/server/miembros-directorio';
import { textoId, decidirGestionDeMiembro } from 'src/server/alcance-gestion-miembros-core.mjs';

// ----------------------------------------------------------------------
// ¿Puede ESTA persona tocarle el acceso a ESA otra?
//
// Hasta ahora la unica pregunta era "¿tiene permiso para editar miembros?", y
// ese permiso lo tienen los dos Lideres de Grupo, el Coordinador y su asistente,
// el Pastor, el Consejo y el Capellan. Con un si por respuesta, cualquiera de
// ellos podia generarle a CUALQUIER persona del pais un codigo con el que se
// entra a su cuenta —incluida la de quien tiene un cargo nacional, o la de un
// administrador— y quedarse con sus permisos.
//
// Aqui se anaden las dos preguntas que faltaban:
//
//   1. ALCANCE: ¿el otro esta en su destacamento, su seccion o su region?
//   2. JERARQUIA: ¿el otro manda igual o mas que el?
//
// Cualquiera de las dos que falle, no. El Administrador Global se salta ambas:
// es el unico que responde de todo el pais.
// ----------------------------------------------------------------------

const ROL_GLOBAL = 'administrador_global';

/** Los cargos activos de un miembro cualquiera, no solo del que llama. */
export const cargosDeMiembro = async (idMiembros, resolverRoles) => {
  if (!idMiembros) return [];

  const encontrados = await getAdminDb()
    .collection('asignacionesDirectiva')
    .where('idMiembro', '==', String(idMiembros))
    .get()
    .catch((error) => {
      console.error('[alcance] no se pudieron leer los cargos del objetivo', error);

      return null;
    });

  return resolverRoles(
    (encontrados?.docs ?? [])
      .map((documento) => ({ id: documento.id, ...documento.data() }))
      .filter((asignacion) => asignacion.activo !== false)
  );
};

/** ¿Esa cuenta es de un administrador? */
const esAdministrador = async ({ idMiembros, uid }) => {
  const db = getAdminDb();
  const candidatos = [uid, idMiembros].map(textoId).filter(Boolean);

  const documentos = await Promise.all([
    ...candidatos.map((id) => db.collection('admins').doc(id).get().catch(() => null)),
    ...candidatos.map((id) => db.collection('usuarios_roles').doc(id).get().catch(() => null)),
  ]);

  return documentos.some((documento) => {
    if (!documento?.exists) return false;
    if (documento.ref.parent.id === 'admins') return true;

    const datos = documento.data() || {};
    const rol = String(datos.rolId || datos.roleId || datos.rol || datos.role || '')
      .trim()
      .toLowerCase();

    return rol === ROL_GLOBAL || ROLES_ASIGNADOS_A_MANO.includes(rol);
  });
};

/**
 * La decision.
 *
 * `resolverRoles` se recibe de fuera para no repetir aqui el catalogo de cargos
 * que ya sabe interpretar `directiva-roles`.
 *
 * Devuelve `{ permitido, motivo }`. El motivo es para el registro del servidor,
 * NO para la respuesta: a quien lo intenta se le contesta siempre lo mismo, que
 * distinguir "no es de los tuyos" de "manda mas que tu" es dibujarle el
 * organigrama a quien esta tanteando.
 */
export const puedeGestionarAMiembro = async ({ solicitante, idMiembros, uidObjetivo, resolverRoles }) => {
  if (!solicitante?.puedeGestionarOtros) return { permitido: false, motivo: 'sin_permiso' };

  // Los roles que se nombran a mano —Administrador Global y los demas
  // administradores— responden de todo el pais y no salen de ninguna casilla del
  // organigrama: ni alcance ni jerarquia que comprobar.
  if (solicitante.rol === ROL_GLOBAL || ROLES_ASIGNADOS_A_MANO.includes(solicitante.rol)) {
    return { permitido: true, motivo: '' };
  }

  const objetivo = textoId(idMiembros);

  if (!objetivo) return { permitido: false, motivo: 'objetivo_sin_id' };

  // Su propia cuenta siempre.
  if (objetivo === textoId(solicitante.idMiembros)) return { permitido: true, motivo: '' };

  if (await esAdministrador({ idMiembros: objetivo, uid: uidObjetivo })) {
    return { permitido: false, motivo: 'objetivo_administrador' };
  }

  const [miembro, cargosObjetivo] = await Promise.all([
    buscarMiembroPorId(objetivo),
    cargosDeMiembro(objetivo, resolverRoles),
  ]);

  return decidirGestionDeMiembro({
    cargosSolicitante: solicitante.cargos ?? [],
    cargosObjetivo,
    ubicacionObjetivo: miembro
      ? await ubicacionDeDestacamento(miembro?.idDestacamento ?? miembro?.destId)
      : null,
  });
};
