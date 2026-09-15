import { isAdminGlobal, rolesQueEjerce } from 'src/utils/org-level-access';
import { buzonPorClave, contactoDeBuzon, BUZONES_COMPARTIDOS } from 'src/utils/chat-buzones.mjs';

// ----------------------------------------------------------------------
// LOS BUZONES COMPARTIDOS EN EL NAVEGADOR, sin React: asi los prueban los tests
// con el codigo real. El gancho que los usa esta en `hooks/use-buzones-del-chat.js`
// y las pestañas, en `chat-bandejas.jsx`.
//
// Todo sale de la lista de `src/utils/chat-buzones.mjs`: añadir un buzon alli
// lo añade aqui, con sus permisos, sin tocar la pantalla.
// ----------------------------------------------------------------------

/**
 * ¿Se le enseña a esta sesion la bandeja de ese buzon?
 *
 * Solo decide lo que se VE. No protege nada: el servidor vuelve a comprobar el
 * cargo en cada peticion antes de dejar actuar como el buzon. Se pregunta por
 * TODOS los cargos que ejerce, no solo por el principal.
 */
export const sesionPuedeAtenderBuzon = (user, buzon) =>
  Boolean(user && buzon) &&
  ((buzon.cargos.includes('administrador_global') && isAdminGlobal(user)) ||
    rolesQueEjerce(user).some((codigo) => buzon.cargos.includes(codigo)));

/** Los buzones que atiende esta sesion, en el orden de la lista. */
export const buzonesQueAtiende = (user) =>
  BUZONES_COMPARTIDOS.filter((buzon) => sesionPuedeAtenderBuzon(user, buzon));

/**
 * La bandeja abierta: la de la direccion (`?bandeja=oficina`) si esta sesion la
 * atiende; si no, ninguna. Pedir por la direccion una bandeja ajena no la abre.
 */
export const bandejaAbierta = (user, clave) => {
  const buzon = buzonPorClave(clave);

  return buzon && sesionPuedeAtenderBuzon(user, buzon) ? buzon : null;
};

/**
 * Quien soy en el chat AHORA: la persona, o el buzon en cuya bandeja esta.
 *
 * Todo el chat decide con esto que mensajes son "mios" (a la derecha), con que
 * `idMiembros` pide cada cosa y a nombre de quien escribe. En una bandeja es el
 * buzon, asi que sus mensajes salen como propios y cada peticion va a su nombre.
 */
export const identidadDeBuzonEnElChat = (contactoPropio, buzon, avatarUrl = '') =>
  buzon
    ? {
        ...contactoDeBuzon(buzon, avatarUrl),
        role: buzon.clave,
        email: '',
        correo: '',
        estatusMiembro: 'activo',
      }
    : contactoPropio;

/**
 * Pone a los buzones de una lista (contactos, participantes) la foto actual.
 *
 * El servidor ya la pone, pero guarda su copia un minuto: sin esto, quien acaba
 * de cambiarla seguia viendo la vieja en la lista y en la conversacion.
 */
export const conAvataresDeBuzones = (personas = [], avatares = new Map()) => {
  if (!avatares?.size || !Array.isArray(personas)) return personas;

  return personas.map((persona) => {
    const buzon = BUZONES_COMPARTIDOS.find(
      (item) => item.idMiembros === Number(persona?.idMiembros ?? persona?.id)
    );
    const avatarUrl = buzon ? avatares.get(buzon.clave) : '';

    return avatarUrl ? { ...persona, avatarUrl } : persona;
  });
};
