// ----------------------------------------------------------------------
// CONTENIDO Y DISEÑO DE UN BLOQUE, VALIDADOS JUNTOS.
//
// Lo usan la portada, el estado del Designer, las versiones y las campañas: los
// cuatro tienen que decidir lo mismo sobre lo mismo. Vive aparte para que esos
// modulos no se importen en circulo.
// ----------------------------------------------------------------------

import { sanearDiseno } from './diseno.mjs';

/** El diseño de fabrica: vacio y congelado, para que nadie lo toque al pintar. */
export const DISENO_DE_FABRICA = Object.freeze({});

const sanearSinRomper = (bloque, contenido) => {
  try {
    return bloque.sanear(contenido);
  } catch {
    return null;
  }
};

/** `{ contenido, diseno }` limpios, o `null` si alguno de los dos no vale. */
export function sanearPublicacion(bloque, { contenido, diseno } = {}) {
  if (!bloque || bloque.externo) return null;

  const limpio = sanearSinRomper(bloque, contenido);
  const disenoLimpio = sanearDiseno(bloque.id, diseno);

  return limpio === null || disenoLimpio === null
    ? null
    : { contenido: limpio, diseno: disenoLimpio };
}
