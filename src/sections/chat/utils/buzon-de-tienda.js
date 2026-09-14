import { isAdminGlobal, rolesQueEjerce } from 'src/utils/org-level-access';
import {
  ID_TIENDA_VIRTUAL,
  contactoTiendaVirtual,
  CARGOS_DEL_BUZON_DE_TIENDA,
} from 'src/utils/chat-tienda-virtual.mjs';

// ----------------------------------------------------------------------
// El buzon de la Tienda en el navegador, sin React: asi lo prueban los tests con
// el codigo real. El gancho que lo usa esta en `hooks/use-buzon-de-tienda.js`.
// ----------------------------------------------------------------------

export const BANDEJA_TIENDA = 'tienda';

/**
 * ¿Se le enseña a esta sesion el selector "Mis chats / Chats de la Tienda"?
 *
 * Solo decide lo que se VE. No protege nada: el servidor vuelve a comprobar el
 * cargo en cada peticion antes de dejar actuar como la Tienda. Se pregunta por
 * TODOS los cargos que ejerce, no solo por el principal.
 */
export const sesionPuedeAtenderBuzonDeTienda = (user) =>
  Boolean(user) &&
  (isAdminGlobal(user) ||
    rolesQueEjerce(user).some((codigo) => CARGOS_DEL_BUZON_DE_TIENDA.includes(codigo)));

/**
 * Quien soy en el chat AHORA: la persona, o la Tienda si esta en su buzon.
 *
 * Todo el chat decide con esto que mensajes son "mios" (a la derecha), con que
 * `idMiembros` pide cada cosa y a nombre de quien escribe. En el buzon es la
 * Tienda, asi que sus mensajes salen como propios y cada peticion va a su nombre.
 */
export const identidadEnElChat = (contactoPropio, enBuzon) =>
  enBuzon
    ? {
        ...contactoTiendaVirtual(),
        role: 'tienda',
        email: '',
        correo: '',
        estatusMiembro: 'activo',
        idMiembros: ID_TIENDA_VIRTUAL,
      }
    : contactoPropio;
