// La IP real del cliente a partir de `x-forwarded-for` (ver `limite-intentos.js`).
//
// La lista la escriben primero el propio cliente (lo que quiera inventar) y
// despues cada proxy de la infraestructura. Solo se confia en la parte derecha:
// `saltos` es cuantos proxys propios hay DESPUES del cliente.

/** La IP del cliente a partir de `x-forwarded-for`, leyendo desde la derecha. */
export const ipDeLaLista = (lista, saltos = 1) => {
  const partes = String(lista ?? '')
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);

  if (!partes.length) return '';

  return partes[Math.max(0, partes.length - 1 - saltos)];
};
