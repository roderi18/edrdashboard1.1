import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// LA DIRECCION DEL CHAT, SIN PERDER LA BANDEJA.
//
// Cada sitio que abria una conversacion escribia `?id=<conversacion>` a mano. Con
// el buzon de la Tienda eso sacaba al administrador de "Chats de la Tienda" en
// cuanto pulsaba una conversacion o enviaba el primer mensaje: la direccion nueva
// ya no llevaba `bandeja=tienda`, y la respuesta salia a su nombre.
// ----------------------------------------------------------------------

export const rutaDelChat = ({ id = '', enBuzon = false } = {}) => {
  const params = new URLSearchParams();

  if (id) params.set('id', String(id));
  if (enBuzon) params.set('bandeja', 'tienda');

  const consulta = params.toString();

  return consulta ? `${paths.dashboard.chat}?${consulta}` : paths.dashboard.chat;
};
