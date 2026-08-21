'use client';

import { useState, useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter, usePathname } from 'src/routes/hooks';

import { SplashScreen } from 'src/components/loading-screen';

import { useAuthContext } from '../hooks';

// ----------------------------------------------------------------------

const getRedirectPath = (pathname) =>
  pathname.startsWith(paths.dashboard.admin.root)
    ? paths.auth.firebase.adminSignIn
    : paths.auth.firebase.signIn;

export function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, authenticated, loading } = useAuthContext();

  const [isChecking, setIsChecking] = useState(true);

  const checkPermissions = () => {
    if (loading) {
      return;
    }

    if (!authenticated) {
      const redirectPath = new URLSearchParams({ returnTo: pathname }).toString();
      const signInPath = getRedirectPath(pathname);

      router.replace(`${signInPath}?${redirectPath}`);
      return;
    }

    // La clave inicial sale del codigo de miembro, asi que la sabe cualquiera que
    // vea el codigo. Mientras no la cambie, la sesion no pasa de aqui: dejarle
    // entrar "solo un momento" es dejarle entrar con una clave publica.
    if (user?.debeCambiarClave && pathname !== paths.auth.firebase.primerAcceso) {
      router.replace(paths.auth.firebase.primerAcceso);
      return;
    }

    setIsChecking(false);
  };

  useEffect(() => {
    checkPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, loading, pathname, user?.debeCambiarClave]);

  if (isChecking || loading) {
    return (
      <SplashScreen
        portal={false}
        title="Verificando tu acceso"
        description="Estamos preparando tu sesión para llevarte al panel correcto."
      />
    );
  }

  return <>{children}</>;
}
