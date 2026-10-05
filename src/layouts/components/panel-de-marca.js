// ----------------------------------------------------------------------
// LOS PANELES DE LA DERECHA, DEL COLOR DE LA BARRA LATERAL.
//
// La barra lateral y la cabecera son navy (mobiliario de marca), pero los dos
// paneles que se abren a la derecha —Configuración y el de la cuenta (Inicio,
// Mi cuenta, Mi perfil...)— salían blancos: tres piezas de la misma casa en dos
// colores. Ahora siguen al mismo interruptor "Barra y cabecera → En blanco":
// apagado, navy con el mismo fade que la barra; encendido, blancos como la
// plantilla.
//
// Sobre navy el contenido se pinta con el esquema OSCURO del tema (atributo
// `data-color-scheme`), para que textos, tarjetas e iconos se lean sin tener que
// repintar cada pieza a mano.
// ----------------------------------------------------------------------

/** Props del papel del panel: el esquema oscuro cuando va en navy. */
export const propsDelPanelDeMarca = (enBlanco) =>
  enBlanco ? {} : { 'data-color-scheme': 'dark' };

/** Fondo del panel: el de la barra lateral, o nada (el de siempre) en blanco. */
export const fondoDelPanelDeMarca = (theme, enBlanco) => {
  if (enBlanco) return {};
  const { navy, navyLight } = theme.vars.palette.brand;
  return {
    bgcolor: navy,
    backgroundImage: `linear-gradient(180deg, ${navy} 0%, ${navy} 60%, ${navyLight} 100%)`,
    color: theme.vars.palette.common.white,
    backdropFilter: 'none',
  };
};
