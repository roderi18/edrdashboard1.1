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

// CUANTOS SALTOS DE CONFIANZA HAY DETRAS DEL CLIENTE.
//
// En App Hosting (Cloud Run detras del balanceador de Google) la lista termina en
// `<ip del cliente>, <ip del balanceador>`: un salto de confianza. Si el
// despliegue cambia, se ajusta con `PROXIES_DE_CONFIANZA` sin tocar codigo.
export const saltosDeConfianza = () => {
  const valor = Number(process.env.PROXIES_DE_CONFIANZA ?? 1);

  return Number.isInteger(valor) && valor >= 0 ? valor : 1;
};

/**
 * De donde viene la llamada. Solo se fia de lo que añaden los proxys propios:
 * `x-real-ip` y `x-nf-client-connection-ip` los puede poner cualquiera.
 */
export const ipDelCliente = (req) =>
  ipDeLaLista(req?.headers?.get?.('x-forwarded-for'), saltosDeConfianza()) || 'desconocido';
