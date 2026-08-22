// ----------------------------------------------------------------------
// Un correo, un miembro.
//
// El correo identifica a la persona: con el se recupera la clave y, una vez
// verificado, se entra. Si dos fichas lo comparten, no hay forma de saber a
// quien pertenece la cuenta, asi que se comprueba antes de guardar en todos los
// sitios donde se puede escribir: el alta, la edicion y el perfil del miembro.
// ----------------------------------------------------------------------

const normalizar = (correo) =>
  String(correo ?? '')
    .trim()
    .toLowerCase();

const idDe = (miembro) => String(miembro?.idMiembros ?? miembro?.id ?? '');

const correoDe = (miembro) => normalizar(miembro?.email || miembro?.correo);

/** Miembro que ya tiene ese correo, o null. Se excluye a `idMiembroActual`. */
export const buscarMiembroConCorreo = (miembros, correo, idMiembroActual) => {
  const buscado = normalizar(correo);

  if (!buscado) return null;

  const idActual = String(idMiembroActual ?? '');

  return (
    (Array.isArray(miembros) ? miembros : []).find(
      (miembro) => correoDe(miembro) === buscado && idDe(miembro) !== idActual
    ) || null
  );
};

/** "Ese correo ya lo usa Fulano." */
export const nombreDeMiembro = (miembro) =>
  `${miembro?.firstName || miembro?.nombres || ''} ${miembro?.lastName || miembro?.apellidos || ''}`.trim() ||
  miembro?.memberId ||
  miembro?.codigoMiembro ||
  'otro miembro';
