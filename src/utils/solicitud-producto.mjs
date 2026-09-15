import { ROLES } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// SOLICITAR UN PRODUCTO AGOTADO.
//
// Con el inventario en 0, "Comprar ahora" quedaba gris y la persona se iba sin
// poder decir que lo necesitaba: la tienda no se enteraba de que habia demanda
// hasta que alguien preguntaba por el chat. Ahora el boton dice "Solicitar
// producto" y deja una orden en estado SOLICITADA que ven quienes reponen.
//
// Una solicitud NO es una compra: no descuenta inventario —no hay que
// descontar—, no genera recibo —no se ha cobrado nada— y cancelarla tampoco
// devuelve existencias.
// ----------------------------------------------------------------------

/** El estado en Firestore y su valor en la interfaz. */
export const ESTADO_SOLICITADA = 'solicitada';
export const ESTADO_UI_SOLICITADO = 'requested';

/**
 * Quienes atienden las solicitudes: la Tienda Virtual —su Administrador de
 * Gestion y el Administrador Global, que la atienden juntos— y la Oficina
 * Nacional, que aprueba la reposicion.
 */
export const ROLES_QUE_ATIENDEN_SOLICITUDES = [
  ROLES.ADMINISTRADOR_GLOBAL,
  ROLES.ADMINISTRADOR_TIENDA,
  ROLES.OFICINA_NACIONAL,
];

/** Lo que se le enseña a quien solicita, en el carrito y en su aviso. */
export const AVISO_SOLICITUD_ENVIADA = 'Se notificó a Tienda Virtual y Oficina Nacional.';

/** Sin existencias. Un valor que no es numero cuenta como 0. */
export const productoAgotado = (producto = {}) => {
  const disponibles = Number(producto?.available ?? producto?.disponibles ?? 0);

  return !Number.isFinite(disponibles) || disponibles <= 0;
};

/** Si alguno de los cargos de un perfil de Firestore atiende solicitudes. */
export const perfilAtiendeSolicitudes = (cargos = []) => {
  const roles = new Set(ROLES_QUE_ATIENDEN_SOLICITUDES.map((rol) => String(rol).toLowerCase()));

  return cargos.some((cargo) =>
    roles.has(
      String(cargo ?? '')
        .trim()
        .toLowerCase()
    )
  );
};
