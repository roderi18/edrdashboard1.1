// ----------------------------------------------------------------------
// DESTACAMENTOS REPETIDOS EN EL PADRÓN: hay números que salen dos veces (p. ej.
// "Destacamento 280" y "Destacamento 280 · Leones de Judá"). En la lista del
// formulario se veían los dos y la gente no sabía cuál elegir. Por número
// queda uno solo: el actualizado, que es el que tiene nombre; si los dos lo
// tienen (o ninguno), el más reciente (id mayor). Los que no tienen número no
// se juntan: no hay con qué saber que son el mismo.
// ----------------------------------------------------------------------

const tieneNombre = (d) => {
  const n = String(d?.nombre ?? '').trim();
  return Boolean(n) && !/^desconocid/i.test(n) && !/^destacamento\s*\d*$/i.test(n);
};

const mejor = (a, b) => {
  if (tieneNombre(a) !== tieneNombre(b)) return tieneNombre(a) ? a : b;
  return Number(b.id) > Number(a.id) ? b : a;
};

/** La lista sin números repetidos, en el mismo orden que venía. */
export function destacamentosSinDuplicados(lista = []) {
  const elegido = new Map();
  lista.forEach((d) => {
    const numero = String(d?.numero ?? '').trim();
    if (!numero) return;
    const actual = elegido.get(numero);
    elegido.set(numero, actual ? mejor(actual, d) : d);
  });
  return lista.filter((d) => {
    const numero = String(d?.numero ?? '').trim();
    return !numero || elegido.get(numero) === d;
  });
}

/** El que queda en la lista para un destacamento (aunque sea el repetido que se quitó). */
export function destacamentoQueQueda(lista, id) {
  const original = lista.find((d) => String(d.id) === String(id));
  if (!original) return null;
  const numero = String(original.numero ?? '').trim();
  if (!numero) return original;
  return destacamentosSinDuplicados(lista.filter((d) => String(d.numero ?? '').trim() === numero))[0];
}
