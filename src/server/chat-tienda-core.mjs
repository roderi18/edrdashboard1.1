import { BUZON_TIENDA } from '../utils/chat-buzones.mjs';
import {
  crearAutenticadorDeBuzon,
  crearEmisorDeTokenDeBuzon,
  crearProveedorDeTokenDeBuzon,
} from './chat-buzones-core.mjs';

// ----------------------------------------------------------------------
// RESPONDER COMO TIENDA VIRTUAL, DESDE EL SERVIDOR.
//
// La logica —y el porque— esta ahora en `chat-buzones-core.mjs`, que sirve a
// todos los buzones compartidos. Aqui quedan los nombres de la Tienda, atados a
// su buzon, para quien ya los usaba.
// ----------------------------------------------------------------------

export const crearEmisorDeTokenDeTienda = (opciones = {}) =>
  crearEmisorDeTokenDeBuzon({ ...opciones, buzon: BUZON_TIENDA });

export const crearProveedorDeTokenDeTienda = crearProveedorDeTokenDeBuzon;

export const crearAutenticadorDeBuzonDeTienda = ({ obtenerTokenDeTienda, ...opciones } = {}) =>
  crearAutenticadorDeBuzon({
    ...opciones,
    buzon: BUZON_TIENDA,
    obtenerTokenDeBuzon: obtenerTokenDeTienda,
  });
