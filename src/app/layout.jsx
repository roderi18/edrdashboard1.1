import 'src/global.css';

import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';

import { I18nProvider } from 'src/locales/i18n-provider';
import { fallbackLng, LocalizationProvider } from 'src/locales';
import { themeConfig, ThemeProvider, primary as primaryColor } from 'src/theme';

import { Snackbar } from 'src/components/snackbar';
import { defaultSettings, SettingsProvider } from 'src/components/settings';

// ----------------------------------------------------------------------
// Membresía ONERRD 2027: el MISMO tema y los mismos proveedores que el
// dashboard y errd-registro (colores, tipografía, fechas en español, avisos),
// sin sesión ni menús: es una página pública.
// ----------------------------------------------------------------------

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: primaryColor.main,
};

export const metadata = {
  title: 'Membresía ONERRD 2027 | Exploradores del Rey',
  description:
    'Registra tu destacamento, paga en línea y recibe el certificado oficial de la membresía 2027 de la Oficina Nacional de Exploradores del Rey.',
};

export default function RootLayout({ children }) {
  return (
    <html lang={fallbackLng} suppressHydrationWarning>
      <body>
        <InitColorSchemeScript
          modeStorageKey={themeConfig.modeStorageKey}
          attribute={themeConfig.cssVariables.colorSchemeSelector}
          defaultMode="system"
        />
        <I18nProvider lang={fallbackLng}>
          <SettingsProvider defaultSettings={{ ...defaultSettings, mode: 'system' }}>
            <LocalizationProvider>
              <AppRouterCacheProvider options={{ key: 'css' }}>
                <ThemeProvider modeStorageKey={themeConfig.modeStorageKey} defaultMode="system">
                  <Snackbar />
                  {children}
                </ThemeProvider>
              </AppRouterCacheProvider>
            </LocalizationProvider>
          </SettingsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
