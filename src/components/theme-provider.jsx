'use client';

import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';

// Paleta y componentes Material UI del dashboard ERRD/errd-registro.
const theme = createTheme({
  palette: {
    primary: { light: '#7A9BD4', main: '#1F4FA6', dark: '#183E82', contrastText: '#FFFFFF' },
    background: { default: '#F4F6FA', paper: '#FFFFFF' },
    success: { main: '#168558' },
  },
  typography: { fontFamily: 'Arial, Helvetica, sans-serif', h3: { fontWeight: 800 }, h4: { fontWeight: 800 }, h5: { fontWeight: 750 } },
  shape: { borderRadius: 12 },
  components: {
    MuiCard: { styleOverrides: { root: { border: '1px solid #E2E8F0', boxShadow: '0 8px 26px rgba(20, 47, 85, .06)' } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { textTransform: 'none', fontWeight: 700, borderRadius: 9 } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
  },
});

export function AppThemeProvider({ children }) {
  return <ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider>;
}
