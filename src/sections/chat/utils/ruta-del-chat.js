import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// LA DIRECCION DEL CHAT, SIN PERDER LA BANDEJA.
//
// Cada sitio que abria una conversacion escribia `?id=<conversacion>` a mano. Con
// el buzon de la Tienda eso sacaba al administrador de "Chats de la Tienda" en
// cuanto pulsaba una conversacion o enviaba el primer mensaje: la direccion nueva
// ya no llevaba `bandeja=tienda`, y la respuesta salia a su nombre.
//
// `bandeja` es la clave del buzon abierto (`tienda`, `oficina`). `enBuzon` es la
// forma de antes, cuando solo existia la Tienda, y sigue significando la Tienda.
// ----------------------------------------------------------------------

export const rutaDelChat = ({ id = '', bandeja = '', enBuzon = false } = {}) => {
  const params = new URLSearchParams();
  const clave = bandeja || (enBuzon ? 'tienda' : '');

  if (id) params.set('id', String(id));
  if (clave) params.set('bandeja', clave);

  const consulta = params.toString();

  return consulta ? `${paths.dashboard.chat}?${consulta}` : paths.dashboard.chat;
};

// ----------------------------------------------------------------------
// CAMBIAR DE CONVERSACIÓN SIN IR AL SERVIDOR.
//
// Qué se rompía: `router.push('/dashboard/chat?id=…')` pedía la página otra vez al
// servidor aunque solo cambiara `?id=`: desde el clic hasta ver la conversación
// pasaba 1 s o más, con los mensajes ya precargados esperando. Dentro del chat
// basta con cambiar la dirección con `history.pushState`, que el App Router
// sincroniza con `useSearchParams` sin ninguna petición: la conversación cambia en
// el mismo clic, como en WhatsApp. Fuera del chat se navega como siempre.
// ----------------------------------------------------------------------

const sinBarraFinal = (ruta) => String(ruta).replace(/\/+$/, '');

export const irAlChat = (router, opciones = {}, { reemplazar = false } = {}) => {
  const ruta = rutaDelChat(opciones);

  if (
    typeof window !== 'undefined' &&
    sinBarraFinal(window.location.pathname) === sinBarraFinal(paths.dashboard.chat)
  ) {
    // Se conserva la forma de la ruta actual (con o sin barra final): solo cambia
    // la consulta.
    const destino = `${window.location.pathname}${new URL(ruta, window.location.origin).search}`;

    window.history[reemplazar ? 'replaceState' : 'pushState'](null, '', destino);
    return;
  }

  router[reemplazar ? 'replace' : 'push'](ruta);
};
