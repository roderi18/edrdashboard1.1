// ----------------------------------------------------------------------
// A QUIÉN SE AVISA CUANDO CAMBIA EL ESTATUS, Y QUIÉN PUEDE PONER "FALLECIDO".
//
// Un miembro que deja de venir es asunto de su destacamento; uno que se va o
// fallece lo es de toda la organización. Antes no se avisaba a nadie: el estatus
// cambiaba y solo lo veía quien abriera la ficha.
//
//   - Reclutamiento → los cargos del destacamento, MENOS el Pastor (a él solo
//     le llegan Inactivo y Fallecido; en su ficha ya se le oculta lo demás).
//   - Inactivo y Fallecido → los cargos del destacamento (Pastor incluido) y,
//     además, Oficina Nacional, Administrador Global y Consejo Ejecutivo, con
//     quién es y a qué destacamento pertenece.
//   - "Fallecido" a mano: solo Coordinador de Destacamento, su Asistente y el
//     Administrador Global. Es el único estatus que la asistencia no revierte.
//
// Sin Firebase: solo dice A QUÉ CARGOS, y el servicio busca sus cuentas.
// ----------------------------------------------------------------------

import { ROLES } from 'src/auth/permissions/roles';

import { ESTATUS_MIEMBRO, normalizarEstatusMiembro } from './estatus-miembro.mjs';

/** Los siete cargos del destacamento. */
export const CARGOS_DE_DESTACAMENTO = Object.freeze([
  ROLES.USUARIO_DESTACAMENTO,
  ROLES.USUARIO_DESTACAMENTO_ASISTENTE,
  ROLES.PASTOR_DESTACAMENTO,
  ROLES.CONSEJO_DESTACAMENTO,
  ROLES.CAPELLAN_DESTACAMENTO,
  ROLES.LIDER_GRUPO,
  ROLES.LIDER_ASISTENTE_GRUPO,
]);

const SIN_PASTOR = Object.freeze(
  CARGOS_DE_DESTACAMENTO.filter((cargo) => cargo !== ROLES.PASTOR_DESTACAMENTO)
);

/** Quien pone "Fallecido" a mano. */
export const CARGOS_QUE_MARCAN_FALLECIDO = Object.freeze([
  ROLES.ADMINISTRADOR_GLOBAL,
  ROLES.USUARIO_DESTACAMENTO,
  ROLES.USUARIO_DESTACAMENTO_ASISTENTE,
]);

/** Los estatus cuyo cambio se avisa. Activo no se avisa: es la normalidad. */
export const ESTATUS_QUE_SE_AVISAN = Object.freeze([
  ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO,
  ESTATUS_MIEMBRO.INACTIVO,
  ESTATUS_MIEMBRO.FALLECIDO,
]);

export const seAvisaElEstatus = (estatus) =>
  ESTATUS_QUE_SE_AVISAN.includes(normalizarEstatusMiembro(estatus));

/** Inactivo y Fallecido salen del destacamento y llegan a la nación. */
export const llegaALaOficinaNacional = (estatus) =>
  [ESTATUS_MIEMBRO.INACTIVO, ESTATUS_MIEMBRO.FALLECIDO].includes(normalizarEstatusMiembro(estatus));

/** Cargos del destacamento a los que se avisa este estatus. */
export const cargosDeDestacamentoQueSeAvisan = (estatus) => {
  const destino = normalizarEstatusMiembro(estatus);

  if (!seAvisaElEstatus(destino)) return [];

  return destino === ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO ? SIN_PASTOR : CARGOS_DE_DESTACAMENTO;
};

// `rolesQueEjerce` se pasa desde fuera para no arrastrar aquí todo
// `org-level-access` (y su cadena de imports de React).
export const puedeMarcarFallecido = (cargos = []) =>
  (Array.isArray(cargos) ? cargos : [cargos])
    .map((cargo) => String(cargo ?? '').trim())
    .some((cargo) => CARGOS_QUE_MARCAN_FALLECIDO.includes(cargo));

/** Un solo aviso para todos los que cambiaron el mismo día. */
export const resumirCambios = (cambios = []) => {
  const lista = (Array.isArray(cambios) ? cambios : []).filter(Boolean);

  if (!lista.length) return '';

  const nombres = lista.map((cambio) => cambio.nombreMiembro || cambio.idMiembros).join(', ');

  return lista.length === 1 ? nombres : `${lista.length} miembros: ${nombres}`;
};
