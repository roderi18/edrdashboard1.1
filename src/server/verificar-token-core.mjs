// ----------------------------------------------------------------------
// ¿Sigue valiendo este token de sesión?
//
// Qué se rompía: las rutas de la API comprobaban solo la firma del token
// (`verifyIdToken`). Un token ya emitido seguía valiendo hasta una hora aunque
// se hubieran revocado las sesiones (cambio de contraseña, cierre forzado) o la
// cuenta se hubiera deshabilitado: justo lo que se quería cortar. Aquí vive la
// comparación pura; `verificar-token.js` la usa con la cuenta real.
// ----------------------------------------------------------------------

// El "primer acceso" encadena tres pasos con el MISMO token: elegir contraseña
// (que revoca las sesiones anteriores), guardar el correo y comprobar el estado.
// Sin una gracia, los dos últimos recibirían 401 con la sesión recién creada.
export const GRACIA_PRIMER_ACCESO_MS = 10 * 60 * 1000;

/**
 * `decodificado.iat` está en SEGUNDOS; `tokensValidAfterTime` es una fecha
 * (UTC string). Un token emitido antes de esa fecha está revocado.
 *
 * `graciaPrimerAcceso` solo perdona la revocación de un token que nació del
 * código de un solo uso (lleva `debeCambiarClave`) y solo durante diez minutos:
 * una sesión robada normal no tiene esa marca y se corta al instante.
 */
export const tokenRevocado = (
  decodificado,
  cuenta,
  { graciaPrimerAcceso = false, ahora = Date.now() } = {}
) => {
  if (!cuenta) return false;
  if (cuenta.disabled === true) return true;

  const desde = cuenta.tokensValidAfterTime
    ? new Date(cuenta.tokensValidAfterTime).getTime()
    : 0;
  const emitido = Number(decodificado?.iat || 0) * 1000;
  const revocado = Number.isFinite(desde) && desde > 0 && emitido > 0 && emitido < desde;

  if (!revocado) return false;

  if (
    graciaPrimerAcceso &&
    decodificado?.debeCambiarClave === true &&
    ahora - desde < GRACIA_PRIMER_ACCESO_MS
  ) {
    return false;
  }

  return true;
};
