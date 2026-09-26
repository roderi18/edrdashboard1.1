// ----------------------------------------------------------------------
// TEXTO AZUL LEGIBLE EN LAS DOS PANTALLAS.
//
// En claro, el azul de la casa (`primary.main`, #1F4FA6). En oscuro, el más
// claro de sus azules que sigue siendo azul (`primary.light`, #7A9BD4): el main
// sobre una tarjeta oscura casi no se leía (pasó con los títulos de los
// Oficiales de la Nacional y con "Ver más"). `primary.lighter` ya es casi blanco.
//
// Uso: `sx={(theme) => ({ ...azulLegible(theme), fontWeight: 600 })}`.
// ----------------------------------------------------------------------

export const azulLegible = (theme) => ({
  color: theme.vars.palette.primary.main,
  ...theme.applyStyles('dark', { color: theme.vars.palette.primary.light }),
});
