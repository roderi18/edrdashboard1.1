// ----------------------------------------------------------------------
// NADIE GESTIONA SU PROPIA COMPRA.
//
// Con varios roles de administración, una misma persona puede comprar en la
// tienda como miembro y ser, a la vez, Administradora de Gestión de Tienda: se
// aprobaría, se marcaría como pagada o se despacharía a sí misma. Su compra la
// gestiona otro administrador de tienda o el Administrador Global. El Global sí
// puede con la suya: reina sobre todo y alguien tiene que poder cerrarla.
//
// Vale con la orden de Firestore (`usuarioId`, `miembroId`) y con la de la
// pantalla (`customer.id`, `customer.memberId`).
// ----------------------------------------------------------------------

const texto = (valor) => String(valor ?? '').trim();

export function esCompraPropia(orden = {}, usuario = {}) {
  const idsDeLaOrden = [orden?.usuarioId, orden?.customer?.id].map(texto).filter(Boolean);
  const miembrosDeLaOrden = [orden?.miembroId, orden?.customer?.memberId].map(texto).filter(Boolean);
  const idsDelUsuario = [usuario?.uid, usuario?.id].map(texto).filter(Boolean);
  const miembrosDelUsuario = [usuario?.idMiembros, usuario?.memberId, usuario?.codigoMiembro]
    .map(texto)
    .filter(Boolean);

  return (
    idsDeLaOrden.some((id) => idsDelUsuario.includes(id)) ||
    miembrosDeLaOrden.some((id) => miembrosDelUsuario.includes(id))
  );
}

/** ¿Puede gestionar esta orden? Todo administrador, salvo con la suya (menos el Global). */
export const puedeGestionarEstaOrden = (orden, usuario, { esAdministradorGlobal = false } = {}) =>
  esAdministradorGlobal || !esCompraPropia(orden, usuario);

export const MENSAJE_COMPRA_PROPIA =
  'Es tu propia compra: la gestiona otro administrador de la tienda o el Administrador Global.';
