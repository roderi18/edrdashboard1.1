// ----------------------------------------------------------------------

const MuiDialog = {
  // ▼▼▼▼▼▼▼▼ 🎨 STYLE ▼▼▼▼▼▼▼▼
  styleOverrides: {
    paper: {
      variants: [
        {
          // A pantalla completa el titulo y el boton de cerrar quedaban debajo
          // de la hora (la pagina se pinta detras de la barra de estado).
          props: (props) => props.fullScreen,
          style: { paddingTop: 'env(safe-area-inset-top)' },
        },
        {
          props: (props) => !props.fullScreen,
          style: ({ theme }) => ({
            margin: theme.spacing(2),
            boxShadow: theme.vars.customShadows.dialog,
            borderRadius: Number(theme.shape.borderRadius) * 2,
          }),
        },
      ],
    },
  },
};

const MuiDialogTitle = {
  // ▼▼▼▼▼▼▼▼ 🎨 STYLE ▼▼▼▼▼▼▼▼
  styleOverrides: {
    root: ({ theme }) => ({
      padding: theme.spacing(3),
    }),
  },
};

const MuiDialogContent = {
  // ▼▼▼▼▼▼▼▼ 🎨 STYLE ▼▼▼▼▼▼▼▼
  styleOverrides: {
    root: ({ theme }) => ({
      padding: theme.spacing(0, 3),
    }),
    dividers: ({ theme }) => ({
      borderTop: 0,
      borderBottomStyle: 'dashed',
      paddingBottom: theme.spacing(3),
    }),
  },
};

const MuiDialogActions = {
  // ▼▼▼▼▼▼▼▼ ⚙️ PROPS ▼▼▼▼▼▼▼▼
  defaultProps: {
    disableSpacing: true,
  },
  // ▼▼▼▼▼▼▼▼ 🎨 STYLE ▼▼▼▼▼▼▼▼
  styleOverrides: {
    root: ({ theme }) => ({
      padding: theme.spacing(3),
      '& > :not(:first-of-type)': {
        marginLeft: theme.spacing(1.5),
      },
    }),
  },
};

/* **********************************************************************
 * 🚀 Export
 * **********************************************************************/
export const dialog = {
  MuiDialog,
  MuiDialogTitle,
  MuiDialogContent,
  MuiDialogActions,
};
