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
