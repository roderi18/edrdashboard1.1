// ----------------------------------------------------------------------
// COMO USA UNA TARJETA DE LA PORTADA SU DISEÑO PUBLICADO.
//
// El diseño llega de EXPLORA Designer (`src/utils/everest/diseno.mjs`) y cada
// ajuste es opcional. La regla de todas estas piezas es la misma: SIN AJUSTE, NO
// SE AÑADE NADA. Devuelven un objeto vacio —que al esparcirse en `sx` no cambia
// ni un pixel— o el valor de siempre que les pasa la tarjeta. Asi una tarjeta sin
// diseño publicado se pinta exactamente como antes.
// ----------------------------------------------------------------------

const hay = (valor) => valor !== undefined && valor !== null && valor !== '';

/** El texto elegido, o el de siempre. Un texto vacio publicado es "quitar ese texto". */
export const textoDelDiseno = (diseno, campo, deSiempre) =>
  typeof diseno?.[campo] === 'string' ? diseno[campo] : deSiempre;

/** Un icono, destino u opcion elegidos, o lo de siempre. */
export const valorDelDiseno = (diseno, campo, deSiempre) =>
  hay(diseno?.[campo]) ? diseno[campo] : deSiempre;

/** Los interruptores de "que se muestra" estan encendidos salvo que se apaguen. */
export const seMuestra = (diseno, campo) => diseno?.[campo] !== false;

/** `{ color }` si hay color elegido. */
export const colorDelDiseno = (diseno, campo, propiedad = 'color') =>
  hay(diseno?.[campo]) ? { [propiedad]: diseno[campo] } : {};

/**
 * El fondo: un color, o un degradado si hay dos tonos. `backgroundImage: 'none'`
 * con un solo tono, para que no asome el degradado de siempre por debajo.
 */
export const fondoDelDiseno = (
  diseno,
  { campo = 'colorFondo', campo2 = 'colorFondo2', angulo = 140 } = {}
) => {
  const primero = diseno?.[campo];
  const segundo = diseno?.[campo2];

  if (!hay(primero) && !hay(segundo)) return {};

  if (hay(primero) && hay(segundo)) {
    return {
      backgroundColor: primero,
      backgroundImage: `linear-gradient(${angulo}deg, ${primero} 0%, ${segundo} 100%)`,
    };
  }

  return { backgroundColor: primero || segundo, backgroundImage: 'none' };
};

/** Tamaño (px) y grosor de letra, si se eligieron. */
export const letraDelDiseno = (diseno, { tamano, peso } = {}) => ({
  ...(tamano && hay(diseno?.[tamano]) ? { fontSize: `${diseno[tamano]}px` } : {}),
  ...(peso && hay(diseno?.[peso]) ? { fontWeight: Number(diseno[peso]) } : {}),
});

/** El redondeo de las esquinas, si se eligio. */
export const radioDelDiseno = (diseno, campo = 'radio') =>
  hay(diseno?.[campo]) ? { borderRadius: `${diseno[campo]}px` } : {};

/** "#0B1B36" → "11 27 54", el canal que necesita `varAlpha` para el velo. */
export const canalDeHex = (hex) => {
  const limpio = String(hex ?? '').replace('#', '');

  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(limpio)) return null;

  return [0, 2, 4].map((inicio) => parseInt(limpio.slice(inicio, inicio + 2), 16)).join(' ');
};

/**
 * Los tonos navy de la tarjeta con el fondo elegido encima: el velo de la foto,
 * el color mientras carga el video y el degradado usan el color del diseño. Sin
 * color elegido, los de siempre.
 */
export const navyDelDiseno = (navy, diseno) => {
  const canal = canalDeHex(diseno?.colorFondo);

  if (!canal) return navy;

  return {
    ...navy,
    canal,
    fondo: diseno.colorFondo,
    claro: diseno.colorFondo2 || diseno.colorFondo,
  };
};

/** "¡Bienvenido, {nombre}!" con el nombre puesto. */
export const conNombre = (plantilla, nombre) => String(plantilla).replaceAll('{nombre}', nombre);
