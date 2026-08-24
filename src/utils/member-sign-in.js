// ----------------------------------------------------------------------
// De lo que escribe el miembro al correo con el que entra.
//
// El prefijo del codigo depende de la provincia de su iglesia (SD, STG, LR...),
// asi que no se puede componer a ciegas: hay que saber cual es SU codigo. Y
// ademas la cuenta puede estar con el correo interno (`<codigo>@exploradores.app`,
// el que se le pone al crearla) o con el personal, si registro uno.
//
// Las dos cosas las resuelve el servidor. Antes las resolvia esta funcion
// descargando el padron ENTERO en el navegador —y como esta pantalla no tiene
// sesion, eso obligaba a dejar `/api/members/` abierta a cualquiera: nombres,
// correos, telefonos y fechas de nacimiento de todos los miembros, menores
// incluidos—. Ahora solo sale de aqui el numero que se acaba de teclear.
// ----------------------------------------------------------------------

const soloDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

// El numero es la parte final del codigo: en `SD-10001` es 10001, y en los
// codigos antiguos `DO-SD-111111039` es 111111039.
export const numeroDeCodigoMiembro = (codigo) => {
  const partes = String(codigo ?? '').split('-');

  return soloDigitos(partes[partes.length - 1]);
};

/**
 * El correo con el que ese numero inicia sesion.
 *
 * Devuelve una lista porque quien llama tiene una reserva propia —el correo
 * compuesto con el prefijo por defecto— para cuando el servidor no puede
 * responder. Cuando responde, su respuesta es la buena y va primero.
 */
export async function resolverCorreosDeMiembroPorNumero(numeroEscrito) {
  const numero = soloDigitos(numeroEscrito);

  if (!numero) return [];

  try {
    const correo = await fetch('/api/auth/correo-acceso/', {
      // No cambia nada: es una consulta. Va por POST para no llevar el numero
      // en la direccion, donde acabaria en los registros del servidor.
      // eslint-disable-next-line no-restricted-syntax
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numeroUsuario: numero }),
    })
      .then((respuesta) => respuesta.json())
      .then((datos) => String(datos?.correo || '').trim());

    return correo ? [correo] : [];
  } catch {
    return [];
  }
}

export async function resolverCorreoDeMiembroPorNumero(numeroEscrito) {
  const [correo = ''] = await resolverCorreosDeMiembroPorNumero(numeroEscrito);

  return correo;
}
