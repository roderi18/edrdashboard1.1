// ----------------------------------------------------------------------
// Reglas de la contraseña nueva de un miembro.
//
// Qué se rompía: bastaban 6 caracteres, sin tope y sin comprobar nada más, así
// que `123456` o `exploradores` valían. Una sola pieza para el servidor y para
// la pantalla, para que ambos digan lo mismo.
// ----------------------------------------------------------------------

export const MINIMO_CLAVE = 8;
export const MAXIMO_CLAVE = 128;

// Las que se prueban primero en cualquier ataque, más lo propio de esta
// organización. Comparación sin mayúsculas ni espacios.
const DEMASIADO_COMUNES = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  '11111111',
  '00000000',
  'password',
  'password1',
  'contraseña',
  'contrasena',
  'qwertyui',
  'qwerty123',
  'abcd1234',
  'exploradores',
  'exploradoresdelrey',
  'exploradores1',
  'iloveyou',
]);

/** Devuelve el mensaje de error, o `null` si la contraseña sirve. */
export const validarClaveNueva = (clave, { codigoMiembro = '' } = {}) => {
  const valor = String(clave ?? '');

  if (valor.length < MINIMO_CLAVE) {
    return `La contraseña debe tener al menos ${MINIMO_CLAVE} caracteres.`;
  }

  if (valor.length > MAXIMO_CLAVE) {
    return `La contraseña no puede pasar de ${MAXIMO_CLAVE} caracteres.`;
  }

  const normalizada = valor.toLowerCase().replace(/\s+/g, '');

  if (DEMASIADO_COMUNES.has(normalizada) || /^(.)\1+$/.test(normalizada)) {
    return 'Esa contraseña es demasiado común. Elige otra.';
  }

  // El codigo del miembro es correlativo y lo sabe cualquiera que lo vea.
  const numero = String(codigoMiembro ?? '').replace(/\D/g, '');

  if (numero && normalizada.includes(numero)) {
    return 'La contraseña no puede contener tu código de miembro.';
  }

  return null;
};
