// ----------------------------------------------------------------------
// UNA PERSONA, UNA FILA, EN LA LISTA DEL CONSEJO NACIONAL.
//
// Un Oficial Especial puede tener además un cargo de región o de sección (la
// única excepción a "nadie sirve en dos consejos", `cargos-compatibles.mjs`).
// La lista lo pintaba dos veces: "Sub-Director Regional · Región Central" y,
// en otra fila, "Coordinador tecnología · Consejo Ejecutivo". Ahora va una sola
// fila, la de su cargo de región o sección, y debajo de cada columna la línea
// del Oficial Especial (posición, nivel organizacional y estructura).
//
// Se aplica después de filtrar: si el filtro solo encuentra la parte del
// Oficial (p. ej. "Consejo Ejecutivo"), la persona sale igual, en su fila
// unida. La Jerarquía sigue usando las filas sueltas: cada casilla es suya.
// ----------------------------------------------------------------------

const ES_OFICIAL_ESPECIAL = /^nacional-oficial-especial-\d+$/;
const NIVELES_COMPATIBLES = ['regional', 'seccional'];

export const esFilaDeOficialEspecial = (fila = {}) =>
  ES_OFICIAL_ESPECIAL.test(String(fila.nationalXMemberPosition || ''));

const mismaPersona = (a, b) =>
  String(a.memberId ?? '').trim() !== '' && String(a.memberId) === String(b.memberId);

/**
 * `visibles`: las filas ya filtradas y ordenadas. `todas`: todas las de la
 * directiva, para encontrar el cargo de región o sección aunque el filtro lo
 * haya dejado fuera. Devuelve las filas visibles con cada Oficial Especial
 * metido en la de su otro cargo (`adicionales`), sin fila propia.
 */
export function unirOficialesConSuCargo(visibles = [], todas = visibles) {
  // De cada Oficial Especial, la fila de su cargo de región o sección (si tiene).
  const principalDe = new Map();
  const oficialesDe = new Map();

  todas.forEach((oficial) => {
    if (!esFilaDeOficialEspecial(oficial)) return;

    const principal = todas.find(
      (fila) =>
        !esFilaDeOficialEspecial(fila) &&
        NIVELES_COMPATIBLES.includes(fila.level) &&
        mismaPersona(fila, oficial)
    );

    if (!principal) return;

    principalDe.set(oficial.id, principal);
    oficialesDe.set(principal.id, [...(oficialesDe.get(principal.id) ?? []), oficial]);
  });

  const yaPuestas = new Set();
  const resultado = [];

  visibles.forEach((fila) => {
    const base = principalDe.get(fila.id) ?? fila;

    if (yaPuestas.has(base.id)) return;
    yaPuestas.add(base.id);

    const adicionales = oficialesDe.get(base.id) ?? [];

    resultado.push(adicionales.length ? { ...base, adicionales } : base);
  });

  return resultado;
}
