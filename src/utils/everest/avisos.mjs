// ----------------------------------------------------------------------
// QUE MERECE UN AVISO EN LA CAMPANA AL PUBLICAR (EXPLORA, fase 8).
//
// Solo los comunicados que NO estaban en vivo, reconocidos por su clave.
// Reordenar la lista, corregir una fecha o una errata no es un comunicado nuevo,
// y avisar a toda la organizacion por eso enseñaria a ignorar la campana.
// ----------------------------------------------------------------------

export const comunicadosNuevos = (antes, despues) => {
  const claves = new Set(
    (Array.isArray(antes) ? antes : []).map((comunicado) => comunicado?.clave)
  );

  return (Array.isArray(despues) ? despues : []).filter(
    (comunicado) => comunicado && !claves.has(comunicado.clave)
  );
};
