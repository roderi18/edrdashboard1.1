import { buildMemberAuthEmail, normalizeMemberUsername } from './member-auth-credentials';

// ----------------------------------------------------------------------
// De lo que escribe el miembro al correo interno con el que entra.
//
// El prefijo del codigo depende de la provincia de su iglesia (SD, STG, LR...),
// asi que ya no se puede componer a ciegas como se hacia antes anteponiendo
// "DO-SD-". Con el numero basta: se busca a quien lo tenga y se usa SU codigo
// completo. Asi el miembro no necesita saberse el prefijo.
// ----------------------------------------------------------------------

const soloDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

// El numero es la parte final del codigo: en `SD-10001` es 10001, y en los
// codigos antiguos `DO-SD-111111039` es 111111039.
export const numeroDeCodigoMiembro = (codigo) => {
  const partes = String(codigo ?? '').split('-');

  return soloDigitos(partes[partes.length - 1]);
};

/**
 * Correos con los que ese numero puede entrar, en orden.
 *
 * Son dos porque la cuenta puede tener cualquiera de los dos: el interno
 * (`<codigo>@exploradores.app`), con el que se crea, o el personal del miembro,
 * si se registro para poder recuperar la clave por correo. Se prueban ambos y
 * asi nadie se queda fuera mientras conviven.
 */
export async function resolverCorreosDeMiembroPorNumero(numeroEscrito) {
  const numero = soloDigitos(numeroEscrito);

  if (!numero) return [];

  try {
    const res = await fetch('/api/members/');

    if (!res.ok) return [];

    const cuerpo = await res.json();
    const miembros = cuerpo?.data || cuerpo || [];

    const miembro = (Array.isArray(miembros) ? miembros : []).find(
      (candidato) =>
        numeroDeCodigoMiembro(candidato?.codigoMiembro || candidato?.memberId) === numero
    );

    if (!miembro) return [];

    const codigo = miembro?.codigoMiembro || miembro?.memberId || '';
    const correoPersonal = String(miembro?.correo || miembro?.email || '').trim();
    const correoInterno = codigo ? buildMemberAuthEmail(normalizeMemberUsername(codigo)) : '';

    // Se le pregunta al servidor con cual entra de verdad: la cuenta usa el
    // interno hasta que registra uno propio, y probar el que no es gasta un
    // intento fallido —Firebase acaba bloqueando por exceso— y hace que el
    // primer intento parezca fallar.
    const correoDeLaCuenta = await fetch('/api/auth/correo-acceso', {
      // No cambia nada: es una consulta. Va por POST para no llevar el correo
      // en la direccion, donde acabaria en los registros del servidor.
      // eslint-disable-next-line no-restricted-syntax
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idMiembros: miembro?.idMiembros ?? miembro?.id ?? null,
        codigoMiembro: codigo,
        correo: correoPersonal,
      }),
    })
      .then((respuesta) => respuesta.json())
      .then((datos) => String(datos?.correo || '').trim())
      .catch(() => '');

    // El resto quedan de reserva, por si el servidor no pudo responder.
    return [...new Set([correoDeLaCuenta, correoInterno, correoPersonal])].filter(Boolean);
  } catch {
    return [];
  }
}

export async function resolverCorreoDeMiembroPorNumero(numeroEscrito) {
  const [correo = ''] = await resolverCorreosDeMiembroPorNumero(numeroEscrito);

  return correo;
}
