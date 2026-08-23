'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Alert from '@mui/material/Alert';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { AUTH } from 'src/lib/firebase';
import { CONFIG } from 'src/global-config';

import { useAuthContext } from '../../hooks';
import { EmailSentPanel } from '../../components/email-sent-panel';
import { resendEmailVerification } from '../../components/context/firebase';

// ----------------------------------------------------------------------

// Cada cuanto se le pregunta a Firebase si ya pulso el enlace. El correo se abre
// en otra pestaña o en el telefono, asi que nadie vuelve aqui a avisar.
const CHECK_INTERVAL_MS = 4000;

export function FirebaseVerifyView() {
  const router = useRouter();
  const { checkUserSession } = useAuthContext();
  const [verificado, setVerificado] = useState(false);
  const [sinSesion, setSinSesion] = useState(false);
  const correo = AUTH?.currentUser?.email || '';
  const entrandoRef = useRef(false);

  const entrarAlPanel = useCallback(async () => {
    if (entrandoRef.current) return;

    entrandoRef.current = true;

    await checkUserSession?.().catch(() => null);
    router.replace(CONFIG.auth.redirectPath);
  }, [checkUserSession, router]);

  // Se pregunta en bucle y tambien al volver a la pestaña, que es cuando suele
  // acabar de pulsar el enlace.
  useEffect(() => {
    let cancelado = false;

    const revisar = async () => {
      const usuario = AUTH?.currentUser;

      if (cancelado) return;

      // Sin sesion no hay a quien preguntar: le paso al abrir el enlace en una
      // ventana que la cerro.
      if (!usuario) {
        setSinSesion(true);
        return;
      }

      await usuario.reload().catch(() => null);

      if (cancelado || !usuario.emailVerified) return;

      setVerificado(true);
      entrarAlPanel();
    };

    const reloj = setInterval(revisar, CHECK_INTERVAL_MS);

    window.addEventListener('focus', revisar);
    revisar();

    return () => {
      cancelado = true;
      clearInterval(reloj);
      window.removeEventListener('focus', revisar);
    };
  }, [entrarAlPanel]);

  return (
    <EmailSentPanel
      title={verificado ? 'Correo verificado' : 'Revisa tu correo'}
      description={
        verificado
          ? 'Listo. Te estamos llevando a tu panel.'
          : `Te enviamos un enlace de verificación${correo ? ` a ${correo}` : ''}. \nÁbrelo para confirmar que el correo es tuyo; esta pantalla lo detecta sola.`
      }
      onResend={
        sinSesion
          ? null
          : () => resendEmailVerification({ destino: paths.auth.firebase.verify })
      }
      returnHref={`${paths.auth.firebase.signIn}?forceSignOut=1`}
    >
      {sinSesion && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Tu sesión se cerró. Si ya abriste el enlace, entra de nuevo y tu correo quedará
          verificado.
        </Alert>
      )}
    </EmailSentPanel>
  );
}
