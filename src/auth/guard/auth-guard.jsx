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

  const { authenticated, loading } = useAuthContext();

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

    setIsChecking(false);
  };

  useEffect(() => {
    checkPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, loading, pathname]);

  if (isChecking || loading) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
