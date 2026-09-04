import 'src/global.css';

import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';

import { CONFIG } from 'src/global-config';
import { LocalizationProvider } from 'src/locales';
import { I18nProvider } from 'src/locales/i18n-provider';
import { fallbackLng } from 'src/locales/locales-config';
import { background, themeConfig, ThemeProvider, primary as primaryColor } from 'src/theme';

import { Snackbar } from 'src/components/snackbar';
import { ProgressBar } from 'src/components/progress-bar';
import { ServiceWorkerRegister } from 'src/components/pwa';
import { MotionLazy } from 'src/components/animate/motion-lazy';
import { SettingsDrawer, defaultSettings, SettingsProvider } from 'src/components/settings';

import { CheckoutProvider } from 'src/sections/checkout/context';

import { AuthProvider as JwtAuthProvider } from 'src/auth/components/context/jwt';
import { AuthProvider as Auth0AuthProvider } from 'src/auth/components/context/auth0';
import { AuthProvider as AmplifyAuthProvider } from 'src/auth/components/context/amplify';
import { AuthProvider as SupabaseAuthProvider } from 'src/auth/components/context/supabase';
import { AuthProvider as FirebaseAuthProvider } from 'src/auth/components/context/firebase';

// ----------------------------------------------------------------------

const AuthProvider =
  (CONFIG.auth.method === 'amplify' && AmplifyAuthProvider) ||
  (CONFIG.auth.method === 'firebase' && FirebaseAuthProvider) ||
  (CONFIG.auth.method === 'supabase' && SupabaseAuthProvider) ||
  (CONFIG.auth.method === 'auth0' && Auth0AuthProvider) ||
  JwtAuthProvider;

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // LA BARRA DE ESTADO SE TINE CON EL TEMA QUE SE ESTA VIENDO.
  //
  // Era un solo color, asi que la app se ponia oscura y arriba quedaba la
  // franja verde de siempre. Con las dos medidas, el telefono elige la que le
  // toca: el verde de la marca en claro, y el mismo fondo de la app en oscuro
  // para que la franja no se note.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: primaryColor.main },
    { media: '(prefers-color-scheme: dark)', color: background.dark.default },
  ],
};

export const metadata = {
  manifest: '/manifest.webmanifest',
  title: {
    default: CONFIG.appName,
    template: `%s | ${CONFIG.appName}`,
  },
  description: 'Sistema de gestion para Exploradores del Rey.',
  icons: [
    {
      rel: 'icon',
      url: `${CONFIG.assetsDir}/exploradores-del-rey-icono.ico`,
    },
    {
      rel: 'apple-touch-icon',
      url: `${CONFIG.assetsDir}/icon-192x192.png`,
    },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: CONFIG.appName,
  },
};

// ----------------------------------------------------------------------

function getAppConfig() {
  return {
    lang: fallbackLng,
    i18nLang: fallbackLng,
    cookieSettings: undefined,
    dir: defaultSettings.direction,
  };
}

export default function RootLayout({ children }) {
  const appConfig = getAppConfig();

  return (
    <html lang={appConfig.lang} dir={appConfig.dir} suppressHydrationWarning>
      <body>
        <ServiceWorkerRegister />
        <InitColorSchemeScript
          modeStorageKey={themeConfig.modeStorageKey}
          attribute={themeConfig.cssVariables.colorSchemeSelector}
          defaultMode={themeConfig.defaultMode}
        />

        <I18nProvider lang={appConfig.i18nLang}>
          <AuthProvider>
            <SettingsProvider
              defaultSettings={defaultSettings}
              cookieSettings={appConfig.cookieSettings}
            >
              <LocalizationProvider>
                <AppRouterCacheProvider options={{ key: 'css' }}>
                  <ThemeProvider
                    modeStorageKey={themeConfig.modeStorageKey}
                    defaultMode={themeConfig.defaultMode}
                  >
                    <MotionLazy>
                      <CheckoutProvider>
                        <Snackbar />
                        <ProgressBar />
                        <SettingsDrawer defaultSettings={defaultSettings} />
                        {children}
                      </CheckoutProvider>
                    </MotionLazy>
                  </ThemeProvider>
                </AppRouterCacheProvider>
              </LocalizationProvider>
            </SettingsProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
