// ----------------------------------------------------------------------
// HTML seguro para textos que se pintan con `dangerouslySetInnerHTML`.
//
// Qué se rompía: el título de una notificación se inyectaba tal cual en el
// panel de avisos. Las notificaciones las escribe cualquier cuenta con sesión
// (las reglas de Firestore dejan crear avisos para otras personas), así que un
// miembro podía dejarle a un Administrador Global un título con
// `<img src=x onerror=...>` y ese código corría dentro de la sesión del
// administrador.
//
// Aquí solo sobreviven las etiquetas de formato más simples y SIN atributos;
// todo lo demás se escapa y se ve como texto. No depende del DOM, así que
// funciona igual en el servidor y en `node --test`.
// ----------------------------------------------------------------------

const ETIQUETAS_PERMITIDAS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'p']);

// `<b>`, `</b>`, `<br>`, `<br/>`: sin atributos de ningún tipo.
const ETIQUETA_SIMPLE = /^<(\/?)([a-z][a-z0-9]*)\s*(\/?)>$/i;

// `&` que no es ya una entidad (`&amp;`, `&#39;`): esas se respetan.
const AMPERSAND_SUELTO = /&(?!(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi;

const escaparTexto = (texto) =>
  texto
    .replace(AMPERSAND_SUELTO, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Devuelve `valor` convertido a HTML que se puede inyectar sin riesgo. */
export const htmlSeguro = (valor) => {
  const texto = String(valor ?? '');

  return texto
    .split(/(<[^<>]*>)/)
    .map((trozo) => {
      if (!trozo) return '';

      const coincidencia = trozo.match(ETIQUETA_SIMPLE);

      if (coincidencia && ETIQUETAS_PERMITIDAS.has(coincidencia[2].toLowerCase())) {
        // Se reescribe la etiqueta en lugar de copiarla: lo que se emite lo
        // decide esta función, no lo que traía el texto.
        const nombre = coincidencia[2].toLowerCase();

        if (nombre === 'br') return '<br>';

        return coincidencia[1] ? `</${nombre}>` : `<${nombre}>`;
      }

      return escaparTexto(trozo);
    })
    .join('');
};
