// ----------------------------------------------------------------------
// EL PASTOR NO PASA LISTA.
//
// El Pastor del destacamento ocupa una casilla de su directiva, pero no es uno
// de los muchachos: no se le pasa asistencia, y salia en la lista como uno mas
// —con su fila, su "Sin registro" y contando en el total de la reunion—, asi que
// cada reunion aparecia con un ausente que nunca iba a estar.
//
// Se identifica por su POSICION en la directiva (`destacamento-pastor`), no por
// el nombre del cargo ni por el numero del padron: la posicion es lo unico que
// no cambia entre el catalogo, la API .NET y lo que se guarda en Firestore.
// ----------------------------------------------------------------------

export const POSICION_PASTOR_DESTACAMENTO = 'destacamento-pastor';

/**
 * Los numeros de miembro de quienes son Pastor en esa directiva.
 *
 * Se cuentan las asignaciones sin `activo`: las que escribio el formulario del
 * Pastor antes de que ese campo existiera no lo traen, y pedir `activo === true`
 * dejaba fuera justo a los pastores mas antiguos. Solo se descarta lo que esta
 * marcado como inactivo a proposito.
 */
export const idsDePastores = (asignaciones = []) =>
  new Set(
    (Array.isArray(asignaciones) ? asignaciones : [])
      .filter(
        (asignacion) =>
          String(asignacion?.idPosicionDirectiva ?? '') === POSICION_PASTOR_DESTACAMENTO &&
          asignacion?.activo !== false
      )
      .map((asignacion) => String(asignacion?.idMiembro ?? ''))
      .filter(Boolean)
  );

/** La lista de asistencia sin los pastores. */
export const sinLosPastores = (miembros = [], pastores = new Set(), idDelMiembro) =>
  (Array.isArray(miembros) ? miembros : []).filter(
    (miembro) => !pastores.has(String(idDelMiembro(miembro)))
  );
