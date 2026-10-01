// ----------------------------------------------------------------------
// "MARCAR COMO NO LEÍDO", COMO EN WHATSAPP.
//
// Qué faltaba: una conversación abierta quedaba leída para siempre y no había
// forma de dejarla pendiente para contestarla luego. Marcarla como no leída pone
// SU contador (el de quien lo pide: la persona o el buzón que atiende) en 1 si
// estaba a 0; si ya tenía mensajes sin leer se respetan, no se pisan. Los
// contadores de los demás participantes no se tocan: es una marca personal.
// ----------------------------------------------------------------------

/**
 * @param noLeidosPorIdMiembros  El mapa de la conversación.
 * @param idMiembros             Quien la marca (persona o buzón).
 * @returns El mapa nuevo, o `null` si no hay nada que cambiar.
 */
export function conNoLeidoMarcado(noLeidosPorIdMiembros, idMiembros) {
  const clave = String(idMiembros ?? '');

  if (!clave) return null;

  const actual = Number(noLeidosPorIdMiembros?.[clave] ?? 0);

  if (actual > 0) return null;

  return { ...(noLeidosPorIdMiembros ?? {}), [clave]: 1 };
}
