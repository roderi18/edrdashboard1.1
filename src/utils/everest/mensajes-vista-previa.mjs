// ----------------------------------------------------------------------
// LO QUE SE DICEN EL DESIGNER Y SU VISTA PREVIA.
//
// La vista previa va en un `<iframe>` y no pintada al lado, por una razon: los
// estilos de la portada cambian con el ancho de la VENTANA (xs, md, lg), no con
// el del recuadro. Encoger un recuadro en un monitor seguiria enseñando el diseño
// de escritorio; un iframe de 375 px es, para la portada, un telefono de verdad.
//
// Entre los dos solo pasan tres mensajes:
//
//   - La vista previa avisa de que esta LISTA para recibir contenido.
//   - El Designer le manda el CONTENIDO del bloque que se esta editando.
//   - La vista previa le dice su ALTO, para que el recuadro no corte ni sobre.
//
// Cada mensaje lleva quien lo manda, y quien lo recibe comprueba que venga de la
// misma aplicacion (`origin`). Sin eso, cualquier pagina que abriera el Designer
// en un iframe propio podria meterle contenido a la vista previa.
// ----------------------------------------------------------------------

export const FUENTE_DESIGNER = 'everest-designer';
export const FUENTE_VISTA_PREVIA = 'everest-vista-previa';

export const TIPOS_DE_MENSAJE = Object.freeze({
  lista: 'lista',
  contenido: 'contenido',
  alto: 'alto',
});

export const mensajeLista = () => ({ fuente: FUENTE_VISTA_PREVIA, tipo: TIPOS_DE_MENSAJE.lista });

export const mensajeAlto = (alto) => ({
  fuente: FUENTE_VISTA_PREVIA,
  tipo: TIPOS_DE_MENSAJE.alto,
  alto: Math.max(0, Math.ceil(Number(alto) || 0)),
});

export const mensajeContenido = (idBloque, contenido) => ({
  fuente: FUENTE_DESIGNER,
  tipo: TIPOS_DE_MENSAJE.contenido,
  idBloque,
  contenido,
});

const esObjeto = (valor) => Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);

/**
 * El mensaje, si viene de la misma aplicacion y de quien se espera; si no, `null`.
 *
 * @param evento        El `MessageEvent` recibido.
 * @param origenPropio  `window.location.origin` de quien recibe.
 * @param fuente        `FUENTE_DESIGNER` o `FUENTE_VISTA_PREVIA`.
 */
export function mensajeValido(evento, origenPropio, fuente) {
  if (!evento || evento.origin !== origenPropio) return null;

  const datos = evento.data;

  if (!esObjeto(datos) || datos.fuente !== fuente) return null;
  if (!Object.values(TIPOS_DE_MENSAJE).includes(datos.tipo)) return null;

  return datos;
}
