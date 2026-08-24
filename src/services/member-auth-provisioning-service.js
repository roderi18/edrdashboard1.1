import { AUTH } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// La cuenta de acceso de un miembro nuevo.
//
// La crea el SERVIDOR. Antes la creaba este archivo, desde el navegador, con
// `createUserWithEmailAndPassword` y una contraseña inicial que salia del propio
// codigo del miembro (`EDR-10002`). Como los codigos son correlativos, esa clave
// la podia deducir cualquiera: bastaba recorrer numeros para entrar como todo el
// que aun no hubiera elegido la suya.
//
// Ahora la contraseña inicial es aleatoria y no la ve nadie —tampoco quien crea
// al miembro—. Para entrar la primera vez, su coordinador le genera un codigo de
// un solo uso desde la ficha, con el boton "Restablecer contraseña".
// ----------------------------------------------------------------------

class ErrorCuentaMiembro extends Error {
  constructor(mensaje, datos = {}) {
    super(mensaje);
    this.name = 'ErrorCuentaMiembro';
    Object.assign(this, datos);
  }
}

/**
 * Crea la cuenta del miembro.
 *
 * Devuelve `{ uid, emailFake, username }`. Ya NO devuelve `password`: no existe
 * una que se pueda decir.
 */
export const createFirebaseAuthForMember = async ({
  codigoMiembro,
  firstName,
  lastName,
  destId,
  memberId,
}) => {
  const usuario = AUTH?.currentUser;

  if (!usuario) {
    throw new ErrorCuentaMiembro('Tu sesión expiró. Vuelve a entrar.');
  }

  const respuesta = await fetch('/api/auth/crear-cuenta-miembro/', {
    // Crea la cuenta de acceso, no cambia la ficha de nadie: no pasa por
    // Historial.
    // eslint-disable-next-line no-restricted-syntax
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await usuario.getIdToken()}`,
    },
    body: JSON.stringify({ codigoMiembro, firstName, lastName, destId, memberId }),
  });
  const resultado = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new ErrorCuentaMiembro(resultado?.error || 'No pudimos crear la cuenta de acceso.', {
      // Quien llama distingue este caso: que ya existiera no es un fallo del
      // alta del miembro, solo significa que no habia nada que crear.
      code: resultado?.yaExistia ? 'auth/email-already-in-use' : undefined,
    });
  }

  return resultado;
};
