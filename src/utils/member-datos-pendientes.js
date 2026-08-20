import { TELEFONO_PENDIENTE, FECHA_NACIMIENTO_PENDIENTE } from 'src/services/pastor-destacamento-service';

import { ROLES } from 'src/auth/permissions/roles';

import { EDAD_MAYORIA, getMemberAge } from './member-age';

// ----------------------------------------------------------------------
// ¿A este miembro le faltan datos por completar?
//
// Se DEDUCE de la propia ficha, no de una marca guardada. Una marca habria que
// apagarla a mano cuando alguien completa los datos, y en la practica se queda
// encendida para siempre; deduciendolo, el aviso desaparece solo en cuanto la
// ficha esta completa.
//
// Pensado para las altas hechas de pasada —el pastor que se registra al crear la
// iglesia, del que solo se conoce el nombre—, pero vale para cualquiera.
// ----------------------------------------------------------------------

const vacio = (valor) => !String(valor ?? '').trim();

// Solo digitos, para comparar telefonos escritos de cualquier forma:
// "(000) 000-0000", "000-000-0000" y "0000000000" son el mismo dato.
const soloDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

export function getDatosPendientesMiembro(member) {
  if (!member) return [];

  const pendientes = [];

  const telefono = soloDigitos(member.phoneNumber ?? member.telefono);
  if (!telefono || telefono === soloDigitos(TELEFONO_PENDIENTE)) {
    pendientes.push('teléfono');
  }

  // OJO CON LOS NOMBRES DE CAMPO. El miembro llega de dos sitios: crudo de la API
  // (`fechaNacimiento`, `direccion`) o ya mapeado para la interfaz (`birthDate`,
  // `memberAddress`). Mirar solo unos daba falsos positivos: se avisaba de que
  // faltaba la fecha o la direccion en fichas que las tenian.
  const nacimiento = String(
    member.birthDate ?? member.birthdate ?? member.fechaNacimiento ?? ''
  ).slice(0, 10);

  if (!nacimiento || nacimiento === FECHA_NACIMIENTO_PENDIENTE) {
    pendientes.push('fecha de nacimiento');
  }

  if (vacio(member.gender ?? member.genero)) pendientes.push('sexo');

  // El correo NO se le reclama a un menor: muchos no tienen, y marcarlo como
  // pendiente convertiria el aviso en permanente para media organizacion.
  const edad = getMemberAge(member);
  const esMenor = edad !== null && edad < EDAD_MAYORIA;

  if (!esMenor && vacio(member.email ?? member.correo)) pendientes.push('correo');

  if (vacio(member.memberAddress ?? member.address ?? member.direccion)) {
    pendientes.push('dirección');
  }

  return pendientes;
}

export const tieneDatosPendientes = (member) => getDatosPendientesMiembro(member).length > 0;

// Texto del aviso: enumera lo que falta para que se sepa que hay que rellenar sin
// tener que abrir la ficha.
export function getAvisoDatosPendientes(member) {
  const pendientes = getDatosPendientesMiembro(member);

  if (!pendientes.length) return '';

  const lista =
    pendientes.length === 1
      ? pendientes[0]
      : `${pendientes.slice(0, -1).join(', ')} y ${pendientes[pendientes.length - 1]}`;

  return `Faltan datos por completar: ${lista}.`;
}

// ----------------------------------------------------------------------
// ¿Quien ve el aviso?
//
// Solo quien puede hacer algo con el: los cargos del destacamento, que son
// quienes conocen a la persona y pueden completar su ficha, y los
// administradores global y funcional. Para el resto es ruido — un triangulo de
// advertencia sobre alguien cuyos datos no les corresponde tocar.
// ----------------------------------------------------------------------
const ROLES_QUE_VEN_EL_AVISO = [
  ROLES.USUARIO_DESTACAMENTO, // Coordinador de Destacamento
  ROLES.USUARIO_DESTACAMENTO_ASISTENTE, // Coordinador Asistente de Destacamento
  ROLES.LIDER_GRUPO,
  ROLES.LIDER_ASISTENTE_GRUPO,
  ROLES.ADMINISTRADOR_GLOBAL,
  ROLES.ADMINISTRADOR_FUNCIONAL,
];

// El rol llega con nombres distintos segun de donde venga la sesion (claims,
// documento de rol o el objeto de usuario heredado), asi que se miran todos.
const getRolDelUsuario = (user = {}) =>
  String(
    user?.rolId ?? user?.roleId ?? user?.rolCodigo ?? user?.roleCodigo ?? user?.rol ?? user?.role ?? ''
  )
    .trim()
    .toLowerCase();

export const puedeVerAvisoDatosPendientes = (user) =>
  ROLES_QUE_VEN_EL_AVISO.includes(getRolDelUsuario(user));
