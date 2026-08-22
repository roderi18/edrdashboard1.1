import { ROLES, ALCANCES, ROLES_CATALOGO } from 'src/auth/permissions/roles';
import {
  PERMISOS_POR_ROL,
  RESTRICCIONES_ROL,
  ALCANCE_PREDETERMINADO_ROL,
} from 'src/auth/permissions/role-permissions';

// ----------------------------------------------------------------------
// Combinaciones de roles.
//
// Una persona puede ocupar dos casillas a la vez —Coordinador Asistente en su
// destacamento y Sub Coordinador en su seccion— y desde agosto de 2026 ejerce
// las dos: los permisos se suman y el alcance tambien. Este catalogo describe
// QUE parejas son posibles, para poder revisarlas una por una.
//
// La regla: siempre un cargo de destacamento MAS uno de otro nivel. Nunca dos
// del mismo nivel —una persona no ocupa dos casillas de la misma directiva— y
// nunca sola: un rol suelto no es una combinacion.
//
// Quedan fuera el Administrador Global y el Administrador Funcional: mandan
// sobre todo, asi que combinarlos no cambia nada y las filas no enseñarian
// nada.
// ----------------------------------------------------------------------

export const NIVEL_COMBINACION = {
  destacamento: 'destacamento',
  seccion: 'seccion',
  region: 'region',
  nacional: 'nacional',
  tienda: 'tienda',
};

export const ETIQUETA_NIVEL = {
  [NIVEL_COMBINACION.destacamento]: 'Destacamento',
  [NIVEL_COMBINACION.seccion]: 'Sección',
  [NIVEL_COMBINACION.region]: 'Región',
  [NIVEL_COMBINACION.nacional]: 'Consejo Nacional',
  [NIVEL_COMBINACION.tienda]: 'Tienda',
};

const ROLES_EXCLUIDOS = new Set([ROLES.ADMINISTRADOR_GLOBAL, ROLES.ADMINISTRADOR_FUNCIONAL]);

// Cuanto mas alto el nivel, mas pesa para elegir el rol PRINCIPAL de navegación.
// Eso no borra las facultades locales: sobre miembros de su propio destacamento,
// el cargo de destacamento conserva la prioridad y sus permisos.
export const PESO_NIVEL = {
  [NIVEL_COMBINACION.nacional]: 4,
  [NIVEL_COMBINACION.region]: 3,
  [NIVEL_COMBINACION.seccion]: 2,
  [NIVEL_COMBINACION.tienda]: 2,
  [NIVEL_COMBINACION.destacamento]: 1,
};

const nivelDeAlcance = (alcance, codigo) => {
  if (alcance === ALCANCES.DESTACAMENTO) return NIVEL_COMBINACION.destacamento;
  if (alcance === ALCANCES.SECCION) return NIVEL_COMBINACION.seccion;
  if (alcance === ALCANCES.REGION) return NIVEL_COMBINACION.region;
  if (alcance === ALCANCES.NACIONAL) return NIVEL_COMBINACION.nacional;
  // El unico global que se combina es el de la tienda: su parcela no se pisa
  // con la de los cargos organizacionales.
  if (codigo === ROLES.ADMINISTRADOR_TIENDA) return NIVEL_COMBINACION.tienda;

  return '';
};

/** Todos los roles combinables, con su nivel y lo que trae de fabrica. */
export const ROLES_COMBINABLES = ROLES_CATALOGO.filter(
  (rol) => !ROLES_EXCLUIDOS.has(rol.codigo)
)
  .map((rol) => {
    const alcance = ALCANCE_PREDETERMINADO_ROL[rol.codigo] ?? rol.alcancePredeterminado;

    return {
      codigo: rol.codigo,
      nombre: rol.nombre,
      descripcion: rol.descripcion ?? '',
      nivel: nivelDeAlcance(alcance, rol.codigo),
      alcance,
      permisos: PERMISOS_POR_ROL[rol.codigo] ?? [],
      restricciones: RESTRICCIONES_ROL[rol.codigo] ?? {},
    };
  })
  .filter((rol) => rol.nivel);

export const ROL_COMBINABLE_POR_CODIGO = Object.fromEntries(
  ROLES_COMBINABLES.map((rol) => [rol.codigo, rol])
);

export const rolesDeNivel = (nivel) => ROLES_COMBINABLES.filter((rol) => rol.nivel === nivel);

/** Niveles que pueden acompañar a un cargo de destacamento. */
export const NIVELES_ACOMPANANTES = [
  NIVEL_COMBINACION.seccion,
  NIVEL_COMBINACION.region,
  NIVEL_COMBINACION.nacional,
  NIVEL_COMBINACION.tienda,
];

/** Identificador estable de una pareja, para guardarla y volver a encontrarla. */
export const idCombinacion = (codigoDestacamento, codigoAcompanante) =>
  `${codigoDestacamento}__${codigoAcompanante}`;

/**
 * Todas las parejas posibles.
 *
 * Es la lista de control de calidad: cada fila es una combinacion que alguien
 * puede tener de verdad, y hay que poder decir que hace cada una.
 */
export const COMBINACIONES = rolesDeNivel(NIVEL_COMBINACION.destacamento).flatMap((deDestacamento) =>
  NIVELES_ACOMPANANTES.flatMap((nivel) =>
    rolesDeNivel(nivel).map((acompanante) => ({
      id: idCombinacion(deDestacamento.codigo, acompanante.codigo),
      nivelAcompanante: nivel,
      destacamento: deDestacamento,
      acompanante,
    }))
  )
);

/** El rol con el que entra: el de mayor nivel de los dos. */
export const rolPrincipalDe = (roles = []) =>
  [...roles].sort((a, b) => (PESO_NIVEL[b.nivel] ?? 0) - (PESO_NIVEL[a.nivel] ?? 0))[0] ?? null;

export const COMBINACION_POR_ID = Object.fromEntries(
  COMBINACIONES.map((combinacion) => [combinacion.id, combinacion])
);
