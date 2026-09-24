// ----------------------------------------------------------------------
// ARRASTRAR UNA CASILLA SIN LLEVARSE A LAS QUE CUELGAN DE ELLA.
//
// El desplazamiento de una casilla se guarda en el <li> del arbol, y ese <li>
// contiene tambien a sus hijas: mover al Director movia a todo lo que cuelga de
// el. Para mover una sola hay que compensar: sus hijas directas reciben el mismo
// desplazamiento en sentido contrario y se quedan donde estaban.
//
// Con varias marcadas (Ctrl + clic) se mueven exactamente esas. La regla general:
// el desplazamiento propio de cada casilla cambia en
//   d × ([ella se mueve] − [la que la arrastra se mueve])
// y solo las que dan distinto de cero se tocan.
//
// `padreDe`: Map de casilla → la casilla cuyo <li> la arrastra (o nada si no la
// arrastra ninguna, como la raiz o las hijas de la raiz).
// Devuelve { id: factor } con factor +1 o −1.
// ----------------------------------------------------------------------

export const factoresDelArrastre = (marcados = [], padreDe = new Map()) => {
  const seMueve = new Set(marcados);
  const factores = {};
  const sumar = (id, valor) => {
    const total = (factores[id] || 0) + valor;

    if (total) factores[id] = total;
    else delete factores[id];
  };

  seMueve.forEach((id) => {
    if (!seMueve.has(padreDe.get(id))) sumar(id, 1);
  });

  padreDe.forEach((padre, hijo) => {
    if (seMueve.has(padre) && !seMueve.has(hijo)) sumar(hijo, -1);
  });

  return factores;
};
