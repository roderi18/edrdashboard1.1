// ----------------------------------------------------------------------
// UN APELLIDO CON PARTICULA ES UN APELLIDO, NO DOS PALABRAS.
//
// Donde el nombre se abrevia —"Roderi Daniel Peña Rosario" -> "Roderi Peña"— se
// cogia la PRIMERA palabra de los apellidos. Con los apellidos compuestos de
// aqui eso deja la particula sola: "Fausto Del Rosario Peralta" salia como
// "Fausto Del", que no identifica a nadie y encima se lee como una frase
// cortada. Lo mismo con "De los Santos", "De la Cruz" o "De Jesús".
//
// La regla: mientras la ultima palabra tomada sea una particula, se sigue
// tomando la siguiente. Asi "Del" arrastra "Rosario", y "De los" arrastra
// "Santos", pero "Peña Rosario" se queda en "Peña".
//
// Vive suelto en `utils` a proposito: lo usan el organigrama (cliente), las
// notificaciones (servicio) y el directorio del padron (servidor), y antes cada
// uno tenia su propia version —dos de ellas sin particulas—.
// ----------------------------------------------------------------------

// Las que en la practica aparecen en el padron dominicano, mas las de apellidos
// extranjeros que ya hay registrados.
export const PARTICULAS_APELLIDO = [
  'de',
  'del',
  'la',
  'las',
  'los',
  'da',
  'das',
  'do',
  'dos',
  'di',
  'san',
  'santa',
  'van',
  'von',
];

const partirPalabras = (valor) =>
  String(valor ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const esParticula = (palabra) => PARTICULAS_APELLIDO.includes(String(palabra).toLowerCase());

/**
 * El primer apellido de una lista de palabras, con las particulas que lo
 * acompañan. `['De', 'los', 'Santos', 'Perez']` -> `'De los Santos'`.
 */
export const primerApellidoDePalabras = (palabras = []) => {
  if (!palabras.length) return '';

  const apellido = [palabras[0]];
  let indice = 1;

  while (indice < palabras.length && esParticula(apellido[apellido.length - 1])) {
    apellido.push(palabras[indice]);
    indice += 1;
  }

  return apellido.join(' ');
};

/** Lo mismo, partiendo de la cadena: `'Del Rosario Peralta'` -> `'Del Rosario'`. */
export const primerApellidoDeTexto = (apellidos) =>
  primerApellidoDePalabras(partirPalabras(apellidos));

/** El primer NOMBRE. Los nombres no llevan particula: basta la primera palabra. */
export const primerNombreDeTexto = (nombres) => partirPalabras(nombres)[0] || '';
