import { useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';

import { toast } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';
import { signOut as jwtSignOut } from 'src/auth/components/context/jwt/action';
import { signOut as amplifySignOut } from 'src/auth/components/context/amplify/action';
import { signOut as supabaseSignOut } from 'src/auth/components/context/supabase/action';
import { signOut as firebaseSignOut } from 'src/auth/components/context/firebase/action';

// ----------------------------------------------------------------------

const signOut =
  (CONFIG.auth.method === 'supabase' && supabaseSignOut) ||
  (CONFIG.auth.method === 'firebase' && firebaseSignOut) ||
  (CONFIG.auth.method === 'amplify' && amplifySignOut) ||
  jwtSignOut;

const signInPath =
  (CONFIG.auth.method === 'supabase' && paths.auth.supabase.signIn) ||
  (CONFIG.auth.method === 'firebase' && paths.auth.firebase.signIn) ||
  (CONFIG.auth.method === 'amplify' && paths.auth.amplify.signIn) ||
  (CONFIG.auth.method === 'auth0' && paths.auth.auth0.signIn) ||
  paths.auth.jwt.signIn;

export function SignOutButton({ onClose, sx, ...other }) {
  const router = useRouter();

  const { checkUserSession } = useAuthContext();

  const { logout: signOutAuth0 } = useAuth0();

  const handleLogout = useCallback(async () => {
    const confirmed = window.confirm('¿Realmente quieres cerrar sesión?');

    if (!confirmed) {
      return;
    }

    try {
      await signOut();
      await checkUserSession?.();

      onClose?.();
      router.replace(signInPath);
    } catch (error) {
      console.error(error);
      toast.error('Unable to logout!');
    }
  }, [checkUserSession, onClose, router]);

  const handleLogoutAuth0 = useCallback(async () => {
    const confirmed = window.confirm('¿Realmente quieres cerrar sesión?');

    if (!confirmed) {
      return;
    }

    try {
      await signOutAuth0();

      onClose?.();
      router.replace(signInPath);
    } catch (error) {
      console.error(error);
      toast.error('Unable to logout!');
    }
  }, [onClose, router, signOutAuth0]);

  return (
    <Button
      fullWidth
      variant="soft"
      size="large"
      color="error"
      onClick={CONFIG.auth.method === 'auth0' ? handleLogoutAuth0 : handleLogout}
      sx={sx}
      {...other}
    >
      Cerrar sesión
    </Button>
  );
}
