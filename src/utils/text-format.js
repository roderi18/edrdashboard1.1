// ----------------------------------------------------------------------

/**
 * Pone en mayuscula la primera letra de cada palabra.
 *
 * Se apoya en `\p{L}` con la bandera unicode y NO en `\b\w`, que fue como estaba:
 * `\w` solo cubre ASCII, asi que una vocal con tilde o una eñe contaban como
 * frontera de palabra y la letra siguiente se tomaba por un comienzo. De ahi
 * salian "GuilléN", "PeñA" o "RamíRez".
 *
 * Se capitaliza al principio del texto, tras un espacio y tras un punto —el
 * punto hace falta para las siglas de los nombres de iglesia, "A.D."—, pero no
 * dentro de la palabra, que es donde viven las tildes.
 */
export function capitalizeWords(text = '') {
  return String(text)
    .toLocaleLowerCase()
    .replace(
      /(^|[\s.])(\p{L})/gu,
      (coincidencia, separador, letra) => separador + letra.toLocaleUpperCase()
    );
}

/**
 * Nombre de iglesia listo para mostrar, con el prefijo "Iglesia" UNA sola vez.
 *
 * El prefijo se ponia siempre desde la plantilla, sin mirar el nombre, y las
 * iglesias que ya se llaman "Iglesia Aposento Alto, A.D." salian como "Iglesia
 * Iglesia Aposento Alto, A.D.".
 */
export function formatChurchName(nombre = '') {
  const limpio = capitalizeWords(String(nombre || '').trim());

  if (!limpio) return 'Iglesia desconocida';

  // Se compara sin tildes ni mayusculas por si el nombre viene como "IGLESIA" o
  // "iglesía".
  const empiezaPorIglesia = /^iglesia\b/i.test(
    limpio.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  return empiezaPorIglesia ? limpio : `Iglesia ${limpio}`;
}
