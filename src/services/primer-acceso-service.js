import { AUTH } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// Escrituras del primer acceso. Viven aparte de la vista porque son lo que
// `proponerCambio` ejecuta DESPUES de registrar el cambio en Historial: quien
// llama aqui es la puerta, nunca un formulario.
//
// La clave y el correo de acceso los cambia el SERVIDOR con el Admin SDK: es el
// unico que puede comparar contra las huellas de las claves anteriores y el
// unico que escribe en `usuarios_roles`.
// ----------------------------------------------------------------------

class ErrorPrimerAcceso extends Error {
  constructor(mensaje, datos = {}) {
    super(mensaje);
    this.name = 'ErrorPrimerAcceso';
    Object.assign(this, datos);
  }
}

const cabecerasConToken = async () => {
  const usuario = AUTH?.currentUser;

  if (!usuario) {
    throw new ErrorPrimerAcceso('Tu sesión expiró. Vuelve a entrar.');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await usuario.getIdToken()}`,
  };
};

/** Cambia la clave del miembro que tiene la sesion abierta. */
export async function cambiarClaveMiembro({ clave }) {
  const respuesta = await fetch('/api/auth/clave-miembro', {
    method: 'POST',
    headers: await cabecerasConToken(),
    body: JSON.stringify({ clave }),
  });
  const resultado = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new ErrorPrimerAcceso(resultado?.error || 'No pudimos cambiar la contraseña.', {
      repetida: Boolean(resultado?.repetida),
    });
  }

  return resultado;
}

/**
 * Deja el correo del miembro como el de su cuenta. Desde ese momento sirve para
 * entrar y para recuperar la clave; el numero de miembro sigue sirviendo.
 */
export async function guardarCorreoDeAcceso({ idMiembros, codigoMiembro, correo }) {
  const respuesta = await fetch('/api/auth/correo-cuenta-miembro', {
    method: 'POST',
    headers: await cabecerasConToken(),
    body: JSON.stringify({ idMiembros, codigoMiembro, correo }),
  });
  const resultado = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new ErrorPrimerAcceso(resultado?.error || 'No pudimos guardar el correo.');
  }

  return resultado;
}

/** Clave temporal de ocho caracteres que el coordinador le dicta al miembro. */
export async function generarClaveTemporalMiembro({ idMiembros, codigoMiembro }) {
  const respuesta = await fetch('/api/auth/clave-temporal-miembro', {
    method: 'POST',
    headers: await cabecerasConToken(),
    body: JSON.stringify({ idMiembros, codigoMiembro }),
  });
  const resultado = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new ErrorPrimerAcceso(resultado?.error || 'No pudimos restablecer la contraseña.');
  }

  return resultado;
}
