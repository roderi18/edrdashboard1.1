import { varAlpha } from 'minimal-shared/utils';

// Todo sale del tema (paleta, sombras, tipografía): los hex sueltos de la
// maqueta no seguían al modo oscuro ni a los colores de la casa.
export const numero = (valor) => new Intl.NumberFormat('es-DO').format(valor || 0);

export const caja = {
  bgcolor: 'background.paper',
  border: (theme) => `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 2,
  boxShadow: (theme) => theme.vars.customShadows.card,
};

export const titulo = { typography: 'subtitle2', color: 'text.primary' };

/** Fondo suave del color de la paleta (`primary`, `success`…). */
export const fondoSuave =
  (color, opacidad = 0.08) =>
  (theme) =>
    varAlpha(theme.vars.palette[color].mainChannel, opacidad);

export const selector = { flex: '1 1 130px', minWidth: 120 };
