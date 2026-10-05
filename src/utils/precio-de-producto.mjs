// ----------------------------------------------------------------------
// CAMBIAR EL PRECIO DE UN PRODUCTO DESDE FUERA DE SU FICHA.
//
// El precio de un combo se ve en el banner de la portada y se cobra en la
// tienda. Antes el editor visual del Designer dejaba escribir encima del precio
// del banner: la portada decía RD$800 y el carrito cobraba RD$3,500. Ahora el
// precio vive en un solo sitio, el producto, y el Designer lo cambia ahí
// (`actualizarPrecioProductoFirestore`): el banner, "Inscribirme", el carrito y
// el cobro lo leen del mismo campo.
//
// Un producto tiene tres precios: el de lista y el de miembro registrado o no.
// Los dos últimos siguen al de lista solo si eran iguales a él (o no tenían): si
// la tienda les puso uno distinto a mano, se respeta.
// ----------------------------------------------------------------------

export const PRECIO_MAXIMO = 10_000_000;

/** El precio escrito, en número válido; `null` si no lo es. */
export const precioValido = (valor) => {
  const texto = String(valor ?? '')
    .replace(/RD\$|\$|\s|,/gi, '')
    .trim();

  if (!texto) return null;

  const numero = Number(texto);

  if (!Number.isFinite(numero) || numero < 0 || numero > PRECIO_MAXIMO) return null;

  return Math.round(numero * 100) / 100;
};

/** Los campos que cambian en el documento del producto (`precio`, y los que lo siguen). */
export const camposDelNuevoPrecio = (documento = {}, nuevo) => {
  const anterior = Number(documento.precio ?? 0);
  const sigue = (campo) => {
    const valor = Number(documento[campo] ?? 0);

    return !valor || valor === anterior;
  };

  return {
    precio: nuevo,
    ...(sigue('precioRegistrado') && { precioRegistrado: nuevo }),
    ...(sigue('precioNoRegistrado') && { precioNoRegistrado: nuevo }),
  };
};
