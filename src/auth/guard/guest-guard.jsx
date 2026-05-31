'use client';

import { useState, useEffect } from 'react';
import { safeReturnUrl } from 'minimal-shared/utils';

import { useRouter, useSearchParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';

import { SplashScreen } from 'src/components/loading-screen';

import { useAuthContext } from '../hooks';
import { signOut } from '../components/context/firebase/action';

// ----------------------------------------------------------------------

export function GuestGuard({ children }) {
  const router = useRouter();

  const { loading, authenticated } = useAuthContext();

  const [isChecking, setIsChecking] = useState(true);

  const searchParams = useSearchParams();
  const redirectUrl = safeReturnUrl(searchParams.get('returnTo'), CONFIG.auth.redirectPath);
  const forceSignOut = searchParams.get('forceSignOut') === '1';

  const checkPermissions = async () => {
    if (loading) {
      return;
    }

    if (authenticated && forceSignOut) {
      await signOut();
      setIsChecking(false);
      return;
    }

    if (authenticated) {
      router.replace(redirectUrl);
      return;
    }

    setIsChecking(false);
  };

  useEffect(() => {
    checkPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, forceSignOut, loading]);

  if (isChecking) {
    return (
      <SplashScreen
        portal={false}
        title={forceSignOut ? 'Cerrando sesión anterior' : 'Preparando acceso'}
        description={
          forceSignOut
            ? 'Estamos limpiando la sesión activa para mostrarte el formulario correcto.'
            : 'Estamos validando tu sesión para mostrarte la pantalla adecuada.'
        }
      />
    );
  }

  return <>{children}</>;
}
