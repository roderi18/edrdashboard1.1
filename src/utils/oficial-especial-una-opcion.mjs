// ----------------------------------------------------------------------
// "OFICIAL ESPECIAL" ES UNA SOLA OPCIÓN EN "CARGO NACIONAL".
//
// El catálogo tiene veinte casillas de Oficial Especial (cada una con su
// asignación), y el desplegable de la ficha las ofrecía todas: veinte
// "Oficial Especial" iguales, y React avisaba de claves repetidas porque el
// nombre es la clave de cada opción. Ahora es una sola opción; qué casilla le
// toca a la persona se decide al guardar:
//
//  1. Si ya es Oficial Especial, conserva la suya (no se mueve de casilla).
//  2. Si no, la primera casilla que el organigrama ya dibuja y está vacía.
//  3. Si no hay ninguna vacía, la siguiente que falte crear (hasta veinte),
//     igual que "Asignar miembros" en la Jerarquía.
// ----------------------------------------------------------------------

import { esOficialEspecial } from './cargos-compatibles.mjs';

// El valor de la opción única. No es una casilla: se traduce al guardar.
export const OPCION_OFICIAL_ESPECIAL = 'nacional-oficial-especial';

export const MAXIMO_OFICIALES_ESPECIALES = 20;

const texto = (valor) => String(valor ?? '').trim();

/** El valor que enseña el desplegable para una casilla guardada. */
export const valorEnElDesplegable = (idPosicionDirectiva) =>
  esOficialEspecial(idPosicionDirectiva) ? OPCION_OFICIAL_ESPECIAL : texto(idPosicionDirectiva);

/**
 * Deja una sola opción de Oficial Especial en la lista del desplegable, en el
 * lugar de la primera. `etiqueta` es el nombre a enseñar (su título, si tiene).
 */
export const unaSolaOpcionDeOficial = (opciones = [], { etiqueta = '' } = {}) => {
  let yaEsta = false;

  return opciones.flatMap((opcion) => {
    if (!esOficialEspecial(opcion?.value)) return [opcion];
    if (yaEsta) return [];

    yaEsta = true;

    return [
      {
        ...opcion,
        value: OPCION_OFICIAL_ESPECIAL,
        idPosicionDirectiva: OPCION_OFICIAL_ESPECIAL,
        label: etiqueta || 'Oficial Especial',
      },
    ];
  });
};

/**
 * La casilla que ocupa la persona al elegir "Oficial Especial".
 *
 * @param idMiembro     Quién.
 * @param asignaciones  Las asignaciones ACTIVAS del Consejo Nacional.
 * @param casillasCreadas Los nodos que el organigrama dibuja hoy
 *                      (`oficial-especial-1`, …), en su orden.
 * @returns { idPosicionDirectiva, nodoACrear } o null si ya hay veinte ocupadas.
 *          `nodoACrear` es el nodo que hay que añadir al organigrama, o ''.
 */
export const casillaParaOficialEspecial = ({
  idMiembro,
  asignaciones = [],
  casillasCreadas = [],
} = {}) => {
  const activas = asignaciones.filter(
    (asignacion) =>
      asignacion?.activo !== false && esOficialEspecial(asignacion?.idPosicionDirectiva)
  );
  const propia = activas.find((asignacion) => texto(asignacion.idMiembro) === texto(idMiembro));

  if (propia) return { idPosicionDirectiva: texto(propia.idPosicionDirectiva), nodoACrear: '' };

  const ocupadas = new Set(activas.map((asignacion) => texto(asignacion.idPosicionDirectiva)));
  const libreCreada = casillasCreadas.find((nodo) => !ocupadas.has(`nacional-${texto(nodo)}`));

  if (libreCreada) {
    return { idPosicionDirectiva: `nacional-${texto(libreCreada)}`, nodoACrear: '' };
  }

  const creadas = new Set(casillasCreadas.map(texto));
  const numeroNuevo = Array.from({ length: MAXIMO_OFICIALES_ESPECIALES }, (_, i) => i + 1).find(
    (numero) =>
      !creadas.has(`oficial-especial-${numero}`) &&
      !ocupadas.has(`nacional-oficial-especial-${numero}`)
  );

  if (!numeroNuevo) return null;

  return {
    idPosicionDirectiva: `nacional-oficial-especial-${numeroNuevo}`,
    nodoACrear: `oficial-especial-${numeroNuevo}`,
  };
};

/** Los nodos que el organigrama dibuja hoy, según su diseño guardado. */
export const casillasDelDiseno = (diseno = null) => {
  const lista = diseno?.customNodeLists?.oficialesEspeciales;

  if (Array.isArray(lista))
    return lista.map(texto).filter(Boolean).slice(0, MAXIMO_OFICIALES_ESPECIALES);

  const cantidad = Math.min(
    MAXIMO_OFICIALES_ESPECIALES,
    Math.max(1, Number(diseno?.customNodeCounts?.oficialesEspeciales) || 1)
  );

  return Array.from({ length: cantidad }, (_, i) => `oficial-especial-${i + 1}`);
};
