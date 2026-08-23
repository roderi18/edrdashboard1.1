'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { EmailInboxIcon } from 'src/assets/icons';

import { FormHead } from './form-head';
import { FormReturnLink } from './form-return-link';

// ----------------------------------------------------------------------
// "Te enviamos un correo". La misma pantalla para verificar el correo y para
// recuperar la contraseña: los dos casos son lo mismo para quien los usa —ir al
// buzon y abrir un enlace—, y verlos iguales es lo que los hace entendibles.
// ----------------------------------------------------------------------

export const SEGUNDOS_REENVIO = 60;

export function EmailSentPanel({
  title = 'Revisa tu correo',
  description,
  onResend,
  resendLabel = 'Reenviar correo',
  returnHref,
  children,
}) {
  const [segundos, setSegundos] = useState(SEGUNDOS_REENVIO);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [reenviando, setReenviando] = useState(false);

  useEffect(() => {
    if (segundos <= 0) return undefined;

    const reloj = window.setTimeout(() => setSegundos((actual) => actual - 1), 1000);

    return () => window.clearTimeout(reloj);
  }, [segundos]);

  const reenviar = async () => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setReenviando(true);

      await onResend();

      setSuccessMessage('Te reenviamos el correo.');
      setSegundos(SEGUNDOS_REENVIO);
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.message || 'No se pudo reenviar el correo. Inténtalo de nuevo.');
    } finally {
      setReenviando(false);
    }
  };

  return (
    <>
      <FormHead icon={<EmailInboxIcon />} title={title} description={description} />

      <Typography
        variant="body2"
        sx={{ mt: -1, mb: 3, color: 'text.secondary', textAlign: 'center' }}
      >
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

      {children}

      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
        {!!onResend && (
          <Button
            color="inherit"
            variant="outlined"
            loading={reenviando}
            disabled={segundos > 0}
            onClick={reenviar}
            loadingIndicator="Reenviando..."
          >
            {segundos > 0 ? `Reenviar en ${segundos}s` : resendLabel}
          </Button>
        )}

        <FormReturnLink href={returnHref} sx={{ mt: 0 }} />
      </Box>
    </>
  );
}
