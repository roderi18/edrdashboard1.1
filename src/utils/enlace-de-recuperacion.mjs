import { MEMBER_AUTH_DOMAIN } from './member-auth-credentials.js';

// ----------------------------------------------------------------------
// ¿A qué correo sale el enlace de "Olvidé mi contraseña"?
//
// Al DE LA CUENTA, y solo a ese. El enlace de Firebase cambia la clave de la
// cuenta que tenga esa dirección: mandarlo al de la ficha le cambiaba la clave a
// OTRA PERSONA (le pasó al administrador, que pidió recuperar la de un miembro y
// terminó cambiando la suya).
//
// Antes, además, se exigía que el correo de la ficha fuera el mismo que el de la
// cuenta, y si no se negaba con "el correo de tu ficha no es el de tu cuenta de
// acceso". Pero la ficha del padrón casi nunca lo lleva: EDR-10049 tenía la ficha
// sin correo y una cuenta con el suyo propio, y no había forma de que le llegara
// el enlace. La ficha no decide nada aquí: la cuenta ya es la del miembro (se
// encuentra por el uid de su perfil), así que su correo es a donde debe ir.
// ----------------------------------------------------------------------

// El mismo mensaje para "no existe ese número" y "existe pero no tiene correo
// propio": distinguirlos es confirmarle a un desconocido quién está dado de alta.
export const SIN_CORREO_PROPIO =
  'No podemos enviarte un enlace: tu cuenta no tiene un correo propio verificado. Usa el botón de abajo para pedirle ayuda a tu Coordinador.';

const normalizarCorreo = (correo) =>
  String(correo ?? '')
    .trim()
    .toLowerCase();

/** `{ puedeEnviar, correo }` o `{ puedeEnviar: false, error }`. */
export const correoDelEnlace = (correoCuenta) => {
  const correo = normalizarCorreo(correoCuenta);

  // El correo interno (`<codigo>@exploradores.app`) no es un buzón: el enlace se
  // perdería sin que nadie lo leyera.
  if (!correo || correo.endsWith(`@${MEMBER_AUTH_DOMAIN}`)) {
    return { puedeEnviar: false, error: SIN_CORREO_PROPIO };
  }

  return { puedeEnviar: true, correo };
};
