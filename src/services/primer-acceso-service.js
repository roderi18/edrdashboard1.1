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

export const cabecerasConToken = async () => {
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
  const respuesta = await fetch('/api/auth/clave-miembro/', {
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
  const respuesta = await fetch('/api/auth/correo-cuenta-miembro/', {
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

/**
 * Codigo de un solo uso que el coordinador le dicta al miembro.
 *
 * No le cambia la contraseña: mientras no use el codigo, sigue entrando con la
 * que tenia. El codigo solo le deja elegir una nueva sin iniciar sesion.
 */
export async function generarCodigoRestablecimientoMiembro({ idMiembros, codigoMiembro, correo }) {
  const respuesta = await fetch('/api/auth/codigo-restablecimiento/', {
    method: 'POST',
    headers: await cabecerasConToken(),
    body: JSON.stringify({ idMiembros, codigoMiembro, correo }),
  });
  const resultado = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new ErrorPrimerAcceso(resultado?.error || 'No pudimos generar el código.');
  }

  return resultado;
}

/**
 * Cambia el codigo del Coordinador por un acceso de una sola pasada.
 *
 * Va sin token a proposito: quien lo usa es justo quien no puede entrar. Y
 * devuelve vacio en vez de reventar, porque quien llama ya tiene un error mejor
 * que contar —el de la contraseña— si esto tampoco cuela.
 */
export async function accederConCodigoDeCoordinador({ numeroUsuario, codigo }) {
  const respuesta = await fetch('/api/auth/acceso-con-codigo/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numeroUsuario, codigo }),
  }).catch(() => null);

  if (!respuesta?.ok) return '';

  const resultado = await respuesta.json().catch(() => ({}));

  return resultado?.token || '';
}

/**
 * ¿Ya hay un codigo vivo para ese miembro?
 *
 * La ficha lo pregunta antes de ofrecer el boton: el otro coordinador pudo
 * generar uno hace un rato y generar otro lo anularia.
 */
export async function consultarCodigoRestablecimiento({ idMiembros, codigoMiembro, correo }) {
  const respuesta = await fetch('/api/auth/codigo-restablecimiento/', {
    method: 'PUT',
    headers: await cabecerasConToken(),
    body: JSON.stringify({ idMiembros, codigoMiembro, correo }),
  }).catch(() => null);

  return respuesta?.ok ? respuesta.json().catch(() => ({ vigente: false })) : { vigente: false };
}

/**
 * Su peticion de ayuda al Coordinador queda atendida: ya pudo entrar.
 *
 * No molesta a nadie si no habia ninguna, y su fallo no puede estorbar el inicio
 * de sesion, asi que se llama sin esperar respuesta.
 */
export async function marcarRecuperacionAtendida() {
  const respuesta = await fetch('/api/notificaciones/recuperacion-atendida/', {
    method: 'POST',
    headers: await cabecerasConToken(),
  }).catch(() => null);

  return respuesta?.ok ? respuesta.json().catch(() => null) : null;
}

/**
 * Revisa si el miembro sigue debiendo cambiar su clave.
 *
 * Se llama al entrar: si la cambio por fuera —con el enlace que Firebase manda
 * al correo—, la marca se queda puesta y volveria a la pantalla de primer
 * acceso aunque ya tenga una clave suya.
 */
export async function revisarEstadoClave() {
  const respuesta = await fetch('/api/auth/estado-clave/', {
    method: 'POST',
    headers: await cabecerasConToken(),
  });

  return respuesta.ok ? respuesta.json() : { debeCambiarClave: null };
}
