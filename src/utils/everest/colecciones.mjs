// ----------------------------------------------------------------------
// DONDE GUARDA EVEREST DESIGNER.
//
// Tres colecciones, cada una con un proposito, y separadas a proposito:
//
//   - `everest_publicado/{pantalla}` → lo que ve toda la organizacion. UN
//     documento por pantalla (`principal`) con un mapa `bloques`: la portada lo
//     lee de una sola vez, y un bloque que no esta en el mapa sale del codigo tal
//     como hoy. Lo lee cualquier sesion; lo escribe el Administrador Global.
//   - `everest_borradores/{pantalla}` → lo que se esta editando sin publicar. Va
//     APARTE para que autoguardar cada pocos segundos no despierte las escuchas
//     de toda la organizacion. Solo el Administrador Global.
//   - `everest_versiones/{id}` → una copia de cada publicacion, para volver
//     atras. Solo el Administrador Global.
//   - `everest_analiticas/{pantalla}` → cuantas veces se vio y se pulso cada
//     bloque y cada campaña (fase 8). Suma cualquier sesion, SOLO esos
//     contadores; lo lee el Administrador Global.
//
// Todas tienen su bloque en `firestore.rules` y estan excluidas del comodin del
// final: sin eso, cualquier sesion valida podria reescribir la portada.
// ----------------------------------------------------------------------

export const COLECCIONES_EVEREST = Object.freeze({
  publicado: 'everest_publicado',
  borradores: 'everest_borradores',
  versiones: 'everest_versiones',
  analiticas: 'everest_analiticas',
});

/** Las pantallas que el Designer sabe editar. Por ahora, la portada. */
export const PANTALLAS_EVEREST = Object.freeze({
  principal: 'principal',
});

/** Carpeta de Storage para los medios que se suban desde el Designer. */
export const CARPETA_MEDIOS_EVEREST = 'everest';
