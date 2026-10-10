// ----------------------------------------------------------------------
// IMÁN DE LOS TEXTOS EN LOS LIENZOS ONERRD (certificado y factura).
//
// Un texto que se arrastra cerca de otro se alinea con él en vertical: cuando
// su borde izquierdo, su centro o su borde derecho queda a menos de `IMAN_X`
// del borde o el centro de la otra caja. Así quedan en columna, uno debajo
// de otro, sin afinar a ojo. Solo cuentan los textos vecinos (a menos de
// `CERCA_Y` de alto): antes el lienzo se pegaba al centro de la HOJA desde
// cualquier sitio, y un texto cerca del medio saltaba solo y no se podía
// dejar donde se quería. Con Alt el lienzo no lo llama (libre).
//
// Todo en % de la página: x y ancho del ancho, y del alto.
// ----------------------------------------------------------------------

export const IMAN_X = 0.8; // ~5 pt en una carta
export const CERCA_Y = 12;

// `campo`: el que se mueve (su ancho); `x`, `y`: dónde caería. Devuelve
// { x: dónde queda su centro, guia: la línea con la que se alinea } o null.
export const imantarTextoOnerrd = (campo, x, y, campos = []) => {
  const medio = campo.ancho / 2;
  const propios = [-medio, 0, medio];
  let mejor = null;
  campos.forEach((otro) => {
    if (otro.id === campo.id || !otro.visible || Math.abs(otro.y - y) > CERCA_Y) return;
    [otro.x - otro.ancho / 2, otro.x, otro.x + otro.ancho / 2].forEach((linea) => {
      propios.forEach((desde) => {
        const distancia = Math.abs(x + desde - linea);
        if (distancia <= IMAN_X && (!mejor || distancia < mejor.distancia)) {
          mejor = { distancia, x: linea - desde, guia: linea };
        }
      });
    });
  });
  return mejor && { x: mejor.x, guia: mejor.guia };
};
