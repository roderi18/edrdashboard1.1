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

export async function resolverCorreoDeMiembroPorNumero(numeroEscrito) {
  const numero = soloDigitos(numeroEscrito);

  if (!numero) return '';

  try {
    const res = await fetch('/api/members/');

    if (!res.ok) return '';

    const cuerpo = await res.json();
    const miembros = cuerpo?.data || cuerpo || [];

    const miembro = (Array.isArray(miembros) ? miembros : []).find(
      (candidato) =>
        numeroDeCodigoMiembro(candidato?.codigoMiembro || candidato?.memberId) === numero
    );

    const codigo = miembro?.codigoMiembro || miembro?.memberId || '';

    return codigo ? buildMemberAuthEmail(normalizeMemberUsername(codigo)) : '';
  } catch {
    return '';
  }
}
