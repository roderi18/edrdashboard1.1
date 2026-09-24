import { varAlpha } from 'minimal-shared/utils';

// ----------------------------------------------------------------------

const MuiDrawer = {
  // ▼▼▼▼▼▼▼▼ 🎨 STYLE ▼▼▼▼▼▼▼▼
  styleOverrides: {
    paper: {
      variants: [
        {
          // Con la pagina detras de la barra de estado, el menu y los paneles
          // laterales empezaban debajo de la hora y su primera fila no se tocaba.
          props: (props) =>
            props.variant === 'temporary' && ['left', 'right'].includes(props.anchor ?? 'left'),
          style: { paddingTop: 'env(safe-area-inset-top)' },
        },
        {
          props: (props) => props.variant === 'temporary' && props.anchor === 'left',
          style: ({ theme }) => ({
            ...theme.mixins.paperStyles(theme),
            boxShadow: `40px 40px 80px -8px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.24)}`,
            ...theme.applyStyles('dark', {
              boxShadow: `40px 40px 80px -8px  ${varAlpha(theme.vars.palette.common.blackChannel, 0.24)}`,
            }),
          }),
        },
        {
          props: (props) => props.variant === 'temporary' && props.anchor === 'right',
          style: ({ theme }) => ({
            ...theme.mixins.paperStyles(theme),
            boxShadow: `-40px 40px 80px -8px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.24)}`,
            ...theme.applyStyles('dark', {
              boxShadow: `-40px 40px 80px -8px ${varAlpha(theme.vars.palette.common.blackChannel, 0.24)}`,
            }),
          }),
        },
      ],
    },
  },
};

/* **********************************************************************
 * 🚀 Export
 * **********************************************************************/
export const drawer = {
  MuiDrawer,
};
