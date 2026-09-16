// ----------------------------------------------------------------------
// DE QUE COLOR SE VE UNA MENCION.
//
// La misma al escribirla que al enviarla: antes se pintaba con el color de la
// casa dentro del globo del mensaje y con el color del texto normal en la caja
// de escribir, asi que la misma mencion cambiaba de aspecto al pulsar Enter.
//
// Es un color, con dos versiones por el fondo que tienen debajo. El globo propio
// es celeste claro en los dos temas, asi que ahi el principal se lee siempre. La
// caja de escribir no: vive sobre el fondo del panel, y en tema oscuro el
// principal se apaga ahi hasta no distinguirse del texto normal —es el mismo
// remedio que ya llevaba la tarjeta de producto compartido—.
// ----------------------------------------------------------------------

/** Dentro del globo de un mensaje. */
export const ESTILO_DE_MENCION = { color: 'primary.main', fontWeight: 700 };

/** En la caja de escribir, que tiene el fondo del panel debajo. */
export const ESTILO_DE_MENCION_AL_ESCRIBIR = (theme) => ({
  fontWeight: 700,
  color: theme.vars.palette.primary.main,
  ...theme.applyStyles('dark', { color: theme.vars.palette.primary.light }),
});
