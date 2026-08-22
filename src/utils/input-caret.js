// ----------------------------------------------------------------------
// Cursor en los campos que reescriben lo tecleado.
//
// Varios campos limpian y capitalizan el texto en cada pulsacion y lo devuelven
// al formulario: React vuelve a pintar el input con un valor nuevo y el
// navegador deja el cursor AL FINAL. Escribiendo en medio —por ejemplo dentro de
// un parentesis, "Este Oriental I (Tiburones D|)"— la siguiente letra salia
// fuera: "(Tiburones D)e".
//
// La posicion correcta no es la que tenia el cursor, sino la que ocupa ese mismo
// punto YA FORMATEADO: si el formato borro un caracter anterior, el cursor tiene
// que retroceder con el.
// ----------------------------------------------------------------------

export const calcularPosicionCursor = ({ valor, posicion, formatear }) => {
  const corte = Number.isInteger(posicion) ? posicion : String(valor ?? '').length;

  if (typeof formatear !== 'function') return corte;

  return formatear(String(valor ?? '').slice(0, corte)).length;
};

export const colocarCursor = (input, posicion) => {
  if (!input || typeof input.setSelectionRange !== 'function') return;

  // Despues del repintado: hacerlo ahora mismo no sirve, React todavia no ha
  // escrito el valor nuevo en el input.
  requestAnimationFrame(() => {
    try {
      input.setSelectionRange(posicion, posicion);
    } catch {
      // Hay inputs (email, number) que no admiten seleccion: se deja como este.
    }
  });
};
