import { useState, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';

import { ConfirmDialog } from 'src/components/custom-dialog';

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
  const [openConfirm, setOpenConfirm] = useState(false);

  const { checkUserSession } = useAuthContext();
  const { logout: signOutAuth0 } = useAuth0();

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error(error);
    } finally {
      try {
        await checkUserSession?.();
      } catch (error) {
        console.error(error);
      }

      onClose?.();
      router.replace(signInPath);
    }
  }, [checkUserSession, onClose, router]);

  const handleLogoutAuth0 = useCallback(async () => {
    try {
      await signOutAuth0();
    } catch (error) {
      console.error(error);
    } finally {
      onClose?.();
      router.replace(signInPath);
    }
  }, [onClose, router, signOutAuth0]);

  const handleConfirmLogout = useCallback(async () => {
    setOpenConfirm(false);

    if (CONFIG.auth.method === 'auth0') {
      await handleLogoutAuth0();
      return;
    }

    await handleLogout();
  }, [handleLogout, handleLogoutAuth0]);

  return (
    <>
      <Button
        fullWidth
        type="button"
        variant="soft"
        size="large"
        color="error"
        onClick={() => setOpenConfirm(true)}
        sx={sx}
        {...other}
      >
        Cerrar sesión
      </Button>

      <ConfirmDialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        title="Cerrar sesión"
        content="¿Realmente quieres cerrar sesión?"
        action={
          <Button variant="contained" color="error" onClick={handleConfirmLogout}>
            Aceptar
          </Button>
        }
      />
    </>
  );
}
