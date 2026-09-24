import { createHash } from 'crypto';

// ----------------------------------------------------------------------
// RESPUESTAS JSON CON ETAG: LO QUE NO CAMBIÓ NO VUELVE A VIAJAR.
//
// Qué se rompía: el padrón, los destacamentos, las secciones, las regiones y las
// iglesias viajaban enteros al navegador en cada petición aunque fueran iguales
// a los de la vez anterior (el padrón pesa megas; en el móvil, con datos, se
// notaba). Ahora cada respuesta lleva su huella (`ETag`); el navegador la
// guarda y la siguiente vez pregunta "¿sigue siendo esta?" (`If-None-Match`).
// Si sí, la respuesta es un 304 vacío y el navegador usa su copia.
//
// `private` + `Vary: Authorization`: el padrón sale acotado al alcance de cada
// cuenta, así que ninguna caché intermedia puede compartirlo entre personas.
// `no-cache` no es "no guardar": es "guardar, pero preguntar siempre antes".
// ----------------------------------------------------------------------

export const huellaDe = (texto) =>
  `W/"${createHash('sha1').update(texto).digest('base64url')}"`;

export function responderConEtag(request, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  const etag = huellaDe(texto);
  const cabeceras = {
    ETag: etag,
    'Cache-Control': 'private, no-cache',
    Vary: 'Authorization',
    'Content-Type': 'application/json; charset=utf-8',
  };

  const pedida = request?.headers?.get?.('if-none-match') || '';
  const coincide = pedida
    .split(',')
    .map((valor) => valor.trim())
    .includes(etag);

  if (coincide) {
    return new Response(null, { status: 304, headers: cabeceras });
  }

  return new Response(texto, { status: 200, headers: cabeceras });
}
