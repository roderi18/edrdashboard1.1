// ----------------------------------------------------------------------
// RESUMEN DEL PROGRESO DE ASCENSO (tarjeta de la raíz de /edit/awards).
//
// La tarjeta tiene que decir lo MISMO que la tabla de debajo: el total de un
// programa son sus adiestramientos (hojas del árbol de `_awards`, no carpetas,
// como `getTotalAwards`) y lo completado son los `completado` de su rama en el
// estado guardado (como `getCompletedAwards`). Si se contara distinto, la tarjeta
// y la fila del mismo programa enseñarían dos cifras para lo mismo.
// ----------------------------------------------------------------------

// Rama del estado guardado que corresponde a cada programa raíz.
const RAMA_DE_PROGRAMA = {
  'sistema-de-ascenso': 'sistemaAscenso',
  'academia-ministerial': 'academia',
};

const contarHojas = (idRaiz, arbol) => {
  const carpetas = new Set([idRaiz]);
  let crecio = true;
  // Por pasadas y no recursivo: el árbol del Sistema de Ascenso tiene miles de
  // nodos y así no depende del orden en que vienen.
  while (crecio) {
    crecio = false;
    arbol.forEach((nodo) => {
      if (nodo?.type === 'folder' && carpetas.has(nodo.parentId) && !carpetas.has(nodo.id)) {
        carpetas.add(nodo.id);
        crecio = true;
      }
    });
  }

  return arbol.filter((nodo) => nodo?.type !== 'folder' && carpetas.has(nodo?.parentId)).length;
};

const contarCompletados = (rama) => {
  if (!rama || typeof rama !== 'object') return 0;

  return Object.values(rama).reduce(
    (suma, valor) =>
      suma +
      (valor === 'completado' ? 1 : typeof valor === 'object' ? contarCompletados(valor) : 0),
    0
  );
};

const porcentaje = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

/**
 * `arbol`: `_awards`. `estado`: el `status` del caché de progreso del miembro.
 * Devuelve los programas raíz con sus cifras, el total general y el programa
 * en que se sigue avanzando (`siguiente`, `null` si ya están todos completos).
 */
export function resumirProgresoDeAscenso(arbol = [], estado = {}) {
  const nodos = Array.isArray(arbol) ? arbol : [];

  const programas = nodos
    .filter((nodo) => nodo?.type === 'folder' && nodo.parentId == null)
    .map((nodo) => {
      const total = contarHojas(nodo.id, nodos);
      // Nunca más completados que adiestramientos: un estado viejo de un premio
      // que ya no está en el catálogo pasaría del 100 %.
      const completados = Math.min(contarCompletados(estado?.[RAMA_DE_PROGRAMA[nodo.id]]), total);

      return {
        id: nodo.id,
        nombre: nodo.name,
        dirigidoA: nodo.target || '',
        total,
        completados,
        pendientes: total - completados,
        porcentaje: porcentaje(completados, total),
        completo: total > 0 && completados >= total,
      };
    });

  const total = programas.reduce((suma, programa) => suma + programa.total, 0);
  const completados = programas.reduce((suma, programa) => suma + programa.completados, 0);

  // El siguiente paso es el programa sin terminar MÁS avanzado: es el que antes
  // se cierra. Con empate, el primero en el orden de la tabla.
  const siguiente =
    programas
      .filter((programa) => programa.total > 0 && !programa.completo)
      .reduce(
        (mejor, programa) => (!mejor || programa.porcentaje > mejor.porcentaje ? programa : mejor),
        null
      ) ?? null;

  return {
    programas,
    total,
    completados,
    porcentaje: porcentaje(completados, total),
    programasCompletos: programas.filter((programa) => programa.completo).length,
    siguiente,
  };
}
