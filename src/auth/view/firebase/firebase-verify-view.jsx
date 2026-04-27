'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { EmailInboxIcon } from 'src/assets/icons';

import { FormHead } from '../../components/form-head';
import { FormReturnLink } from '../../components/form-return-link';
import { resendEmailVerification } from '../../components/context/firebase';

// ----------------------------------------------------------------------

const RESEND_WAIT_SECONDS = 60;

export function FirebaseVerifyView() {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_WAIT_SECONDS);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const handleResendEmail = async () => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsResending(true);

      await resendEmailVerification();

      setSuccessMessage('Te reenviamos el enlace de verificación.');
      setSecondsLeft(RESEND_WAIT_SECONDS);
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.message || 'No se pudo reenviar el enlace. Inténtalo de nuevo.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <>
      <FormHead
        icon={<EmailInboxIcon />}
        title="Revisa tu correo"
        description={`Te enviamos un enlace de verificación. \nAbre ese enlace para confirmar tu cuenta antes de continuar.`}
      />

      <Typography variant="body2" sx={{ mt: -1, mb: 3, color: 'text.secondary', textAlign: 'center' }}>
        Si no lo ves en tu bandeja de entrada, revisa tu carpeta de spam o correo no deseado.
      </Typography>

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      {!!successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
        <Button
          color="inherit"
          variant="outlined"
          loading={isResending}
          disabled={secondsLeft > 0}
          onClick={handleResendEmail}
          loadingIndicator="Reenviando..."
        >
          {secondsLeft > 0 ? `Reenviar en ${secondsLeft}s` : 'Reenviar correo'}
        </Button>

        <FormReturnLink href={`${paths.auth.firebase.signIn}?forceSignOut=1`} sx={{ mt: 0 }} />
      </Box>
    </>
  );
}
