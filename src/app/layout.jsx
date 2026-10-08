import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';

import { AppThemeProvider } from '@/components/theme-provider';

export const metadata = {
  title: 'Membresía ONERRD 2027',
  description: 'Registro y pago de la membresía anual de destacamentos de Exploradores del Rey.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AppRouterCacheProvider options={{ key: 'css' }}>
          <AppThemeProvider>{children}</AppThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
