import { ROLES } from 'src/auth/permissions/roles';

import { DIRECTIVA_LEVELS, DIRECTIVA_POSITIONS } from './directiva-positions';

// ----------------------------------------------------------------------
// El rol de una persona SALE de su cargo en la directiva.
//
// Hasta ahora el rol era un campo suelto que se elegia a mano en un desplegable,
// sin relacion con la casilla que la persona ocupa de verdad en el organigrama.
// De ahi salian sesiones incoherentes: alguien nombrado Coordinador de
// Destacamento en la directiva entraba como Usuario Comun.
//
// Aqui se traduce cada casilla al rol que le corresponde. Lo que no aparece en
// este mapa —las cajas de estructura (Concilio, Consejo Nacional, las divisiones)
// y los cargos que todavia no tienen un rol definido— no otorga rol: quien solo
// ocupe una de esas casillas queda como Usuario Comun.
// ----------------------------------------------------------------------

export const ROL_POR_POSICION_DIRECTIVA = {
  // --- Destacamento ---
  'destacamento-pastor': ROLES.PASTOR_DESTACAMENTO,
  'destacamento-coordinador-destacamento': ROLES.USUARIO_DESTACAMENTO,
  'destacamento-coordinador-asistente-destacamento': ROLES.USUARIO_DESTACAMENTO_ASISTENTE,
  'destacamento-consejo-destacamento': ROLES.CONSEJO_DESTACAMENTO,
  'destacamento-capellan': ROLES.CAPELLAN_DESTACAMENTO,
  // Las cuatro divisiones comparten el mismo par de roles: lo que distingue a un
  // lider de Navegantes de uno de Pioneros es la division de su asignacion, no
  // su rol.
  'destacamento-navegantes-lider-grupo': ROLES.LIDER_GRUPO,
  'destacamento-pioneros-lider-grupo': ROLES.LIDER_GRUPO,
  'destacamento-seguidores-lider-grupo': ROLES.LIDER_GRUPO,
  'destacamento-exploradores-lider-grupo': ROLES.LIDER_GRUPO,
  'destacamento-navegantes-lider-asistente-grupo': ROLES.LIDER_ASISTENTE_GRUPO,
  'destacamento-pioneros-lider-asistente-grupo': ROLES.LIDER_ASISTENTE_GRUPO,
  'destacamento-seguidores-lider-asistente-grupo': ROLES.LIDER_ASISTENTE_GRUPO,
  'destacamento-exploradores-lider-asistente-grupo': ROLES.LIDER_ASISTENTE_GRUPO,

  // --- Seccion ---
  'seccional-coordinador-seccional': ROLES.USUARIO_SECCION,
  'seccional-sub-coordinador-seccional': ROLES.USUARIO_SECCION_ASISTENTE,
  'seccional-capellan-seccional': ROLES.CAPELLAN_SECCIONAL,
  'seccional-coordinador-adiestramiento': ROLES.COORDINADOR_ADIESTRAMIENTO_SECCION,
  'seccional-coordinador-promocion': ROLES.COORDINADOR_PROMOCION_SECCION,
  'seccional-coordinador-produccion': ROLES.COORDINADOR_PRODUCCION_SECCION,
  'seccional-coordinador-programa': ROLES.COORDINADOR_PROGRAMA_SECCION,
  'seccional-zonas': ROLES.ZONAS,
  'seccional-grupos-locales': ROLES.GRUPOS_LOCALES,
  'seccional-secretario-regional': ROLES.SECRETARIO_REGIONAL,

  // --- Region ---
  'regional-director-regional': ROLES.USUARIO_REGION,
  'regional-subdirector-regional': ROLES.USUARIO_REGION_ASISTENTE,
  'regional-capellan-regional': ROLES.CAPELLAN_REGIONAL,
  'regional-coordinador-adiestramiento': ROLES.COORDINADOR_ADIESTRAMIENTO_REGION,
  'regional-coordinador-promocion': ROLES.COORDINADOR_PROMOCION_REGION,
  'regional-coordinador-produccion': ROLES.COORDINADOR_PRODUCCION_REGION,
  'regional-coordinador-programa': ROLES.COORDINADOR_PROGRAMA_REGION,
  'regional-secretario-regional': ROLES.SECRETARIO_REGIONAL,

  // --- Consejo Nacional ---
  'nacional-director-nacional': ROLES.DIRECTOR_NACIONAL,
  'nacional-sub-director-nacional': ROLES.SUBDIRECTOR_NACIONAL,
  'nacional-capellan-nacional': ROLES.CAPELLAN_NACIONAL,
  'nacional-coordinador-adiestramiento': ROLES.COORDINADOR_ADIESTRAMIENTO_NACIONAL,
  'nacional-coordinador-promocion': ROLES.COORDINADOR_PROMOCION_NACIONAL,
  'nacional-coordinador-produccion': ROLES.COORDINADOR_PRODUCCION_NACIONAL,
  'nacional-coordinador-programa': ROLES.COORDINADOR_PROGRAMA_NACIONAL,
  'nacional-comites-especiales': ROLES.COMITES_ESPECIALES_NACIONAL,
  'nacional-oficiales-adiestramientos-especiales':
    ROLES.OFICIALES_ADIESTRAMIENTOS_ESPECIALES_NACIONAL,
  'nacional-ministerios-infantiles': ROLES.MINISTERIOS_INFANTILES_NACIONAL,
  'nacional-director-ministerios-infantiles-api': ROLES.MINISTERIOS_INFANTILES_NACIONAL,
};

// Roles que NO se deducen: se asignan a mano y mandan sobre cualquier cargo.
export const ROLES_ASIGNADOS_A_MANO = [
  ROLES.ADMINISTRADOR_GLOBAL,
  ROLES.ADMINISTRADOR_FUNCIONAL,
  ROLES.ADMINISTRADOR_TIENDA,
];

/**
 * Roles que NO salen de una casilla del organigrama, y por eso ningun cargo los
 * borra.
 *
 * Los administradores de arriba y la OFICINA NACIONAL. La Oficina Nacional no
 * ocupa ninguna casilla —se nombra a mano, como ellos—, pero no estaba en la
 * lista: en cuanto esa persona recibia un cargo en su destacamento, el rol se
 * recalculaba desde sus casillas y su Oficina Nacional DESAPARECIA. Perdia la
 * bandeja de aprobaciones, las reglas de Firestore dejaban de reconocerla, y
 * los avisos de cambios pendientes —que se reparten buscando ese rol— ya no le
 * llegaban.
 *
 * Va en una lista aparte y no dentro de la de arriba a proposito: aquella
 * significa ademas "responde de todo el pais y no hay jerarquia que comprobar"
 * (ver `puedeGestionarAMiembro`), y la Oficina Nacional aprueba, no gobierna las
 * claves de nadie.
 */
export const ROLES_QUE_NO_SALEN_DE_UNA_CASILLA = [
  ...ROLES_ASIGNADOS_A_MANO,
  ROLES.OFICINA_NACIONAL,
];

// Cuanto mas alto el nivel, mas manda. Quien ocupa una casilla nacional y otra
// de destacamento entra con la nacional.
const PESO_POR_NIVEL = {
  [DIRECTIVA_LEVELS.nacional]: 4,
  [DIRECTIVA_LEVELS.regional]: 3,
  [DIRECTIVA_LEVELS.seccional]: 2,
  [DIRECTIVA_LEVELS.destacamento]: 1,
};

const POSICION_POR_ID = new Map(
  DIRECTIVA_POSITIONS.map((position) => [position.idCargo, position])
);

const getIdPosicion = (asignacion = {}) =>
  String(asignacion?.idPosicionDirectiva || asignacion?.idCargo || '').trim();

/**
 * TODOS los cargos activos de una persona, con el rol que otorga cada uno.
 *
 * Una misma persona puede ocupar mas de una casilla —Coordinador Asistente en su
 * destacamento y Sub Coordinador en su seccion, por ejemplo— y los dos cargos
 * cuentan: manda el de mayor nivel, pero los poderes se suman.
 *
 * Vienen ordenados de mayor a menor: primero el nivel, y a igual nivel el que
 * esta mas arriba en el organigrama (menor `orden`).
 */
export const resolverRolesPorAsignaciones = (asignaciones = []) => {
  const cargos = (Array.isArray(asignaciones) ? asignaciones : [])
    .filter((asignacion) => asignacion?.activo !== false)
    .map((asignacion) => {
      const idPosicion = getIdPosicion(asignacion);
      const rol = ROL_POR_POSICION_DIRECTIVA[idPosicion];

      if (!rol) return null;

      const posicion = POSICION_POR_ID.get(idPosicion);
      const nivel = posicion?.nivel ?? asignacion?.nivel ?? '';

      return {
        rol,
        nivel,
        idPosicion,
        idEntidad: String(asignacion?.idEntidad ?? asignacion?.idDestacamento ?? '').trim(),
        nombreEntidad: String(asignacion?.nombreEntidad ?? '').trim(),
        nombreCargo: posicion?.nombreCargo ?? '',
        nombreDivision: posicion?.nombreDivision ?? '',
        peso: PESO_POR_NIVEL[nivel] ?? 0,
        orden: Number(posicion?.orden ?? asignacion?.orden ?? 999),
      };
    })
    .filter(Boolean);

  cargos.sort((a, b) => b.peso - a.peso || a.orden - b.orden);

  return cargos;
};

/**
 * El rol con el que entra: el de mayor nivel de todos los que tenga.
 *
 * Sigue haciendo falta uno solo para lo que no admite varios —la pantalla de
 * inicio, el nombre que se muestra—, pero los permisos salen de TODOS: ver
 * `resolverRolesPorAsignaciones`.
 */
export const resolverRolPorAsignaciones = (asignaciones = []) => {
  const [principal] = resolverRolesPorAsignaciones(asignaciones);

  return principal?.rol ?? ROLES.USUARIO_COMUN;
};
