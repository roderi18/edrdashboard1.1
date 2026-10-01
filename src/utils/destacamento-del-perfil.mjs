// ----------------------------------------------------------------------
// EL DESTACAMENTO DEBAJO DEL NOMBRE, EN EL PERFIL (`/dashboard/user`).
//
// Ahí salía "CTO", el cargo del usuario de ejemplo de la plantilla. Va el
// destacamento de la persona con su nombre y su número ("Tribu de Judá 18"); si
// no tiene número, solo el nombre. La sesión no lleva el destacamento, así que
// se busca por la ficha del miembro (`idDestacamento`) en el listado.
//
// Sin React ni Firebase, para poder probarlo con `node --test`.
// ----------------------------------------------------------------------

const limpio = (valor) => String(valor ?? '').trim();

/** "Tribu de Judá 18" / "Tribu de Judá" / "" si no hay nombre ni número. */
export const etiquetaDeDestacamento = (destacamento) => {
  const nombre = limpio(destacamento?.name ?? destacamento?.nombre);
  const numero = limpio(destacamento?.destNumber ?? destacamento?.numero);

  // El nombre ya puede llevar el número ("Destacamento 18"): no repetirlo.
  if (nombre && numero && !nombre.split(/\s+/).includes(numero)) return `${nombre} ${numero}`;

  return nombre || numero;
};

/** La etiqueta del destacamento del miembro, o '' si no se encuentra. */
export const destacamentoDelMiembro = ({ idMiembros, miembros = [], destacamentos = [] } = {}) => {
  const miembro = (Array.isArray(miembros) ? miembros : []).find(
    (candidato) => limpio(candidato?.id ?? candidato?.idMiembros) === limpio(idMiembros)
  );
  const idDestacamento = limpio(miembro?.idDestacamento);

  if (!idMiembros || !idDestacamento) return '';

  const destacamento = (Array.isArray(destacamentos) ? destacamentos : []).find(
    (candidato) => limpio(candidato?.id ?? candidato?.idDestacamento) === idDestacamento
  );

  return destacamento ? etiquetaDeDestacamento(destacamento) : '';
};
