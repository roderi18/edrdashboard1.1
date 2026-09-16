// ----------------------------------------------------------------------
// COMO CAMBIA UN EDITOR SU CONTENIDO.
//
// Siempre con una COPIA: el contenido de partida puede ser el valor de fabrica,
// el mismo objeto que pinta la portada. Tocarlo en su sitio cambiaria la portada
// de quien edita sin haber publicado nada.
//
// Poner un campo en `undefined` lo QUITA: asi un campo opcional (el fondo, el
// boton) vuelve a su valor de siempre en lugar de guardarse vacio.
// ----------------------------------------------------------------------

export const conCampo = (contenido, campo, valor) => {
  const copia = { ...contenido };

  if (valor === undefined) {
    delete copia[campo];
  } else {
    copia[campo] = valor;
  }

  return copia;
};

/** `cambiar('titulo', 'Nuevo')` → llama a `onCambiar` con la copia. */
export const cambiadorDe = (contenido, onCambiar) => (campo, valor) =>
  onCambiar(conCampo(contenido, campo, valor));
