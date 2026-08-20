import { TELEFONO_PENDIENTE, FECHA_NACIMIENTO_PENDIENTE } from 'src/services/pastor-destacamento-service';

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

  const nacimiento = String(member.birthdate ?? member.fechaNacimiento ?? '').slice(0, 10);
  if (!nacimiento || nacimiento === FECHA_NACIMIENTO_PENDIENTE) {
    pendientes.push('fecha de nacimiento');
  }

  if (vacio(member.gender ?? member.genero)) pendientes.push('sexo');
  if (vacio(member.email ?? member.correo)) pendientes.push('correo');
  if (vacio(member.address ?? member.direccion)) pendientes.push('dirección');

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
