'use client';

import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { findAdminProfileByLoginValue } from 'src/utils/admin-profile';

import { PasswordIcon } from 'src/assets/icons';

import { Form, Field } from 'src/components/hook-form';

import { getErrorMessage } from '../../utils';
import { FormHead } from '../../components/form-head';
import { EmailSentPanel } from '../../components/email-sent-panel';
import { FormReturnLink } from '../../components/form-return-link';
import { sendPasswordResetEmail } from '../../components/context/firebase';

// ----------------------------------------------------------------------

const DEFAULT_PREFIX = 'EDR-';

const expectedResetErrorCodes = [
  'auth/invalid-email',
  'auth/user-not-found',
  'auth/invalid-credential',
];

export const ResetPasswordSchema = z.object({
  userNumber: z.string().optional(),
  loginValue: z.string().optional(),
});

// Todo lo que hace falta para recuperar lo resuelve el servidor: quien es el
// miembro, si su cuenta tiene un correo propio al que mandarle el enlace y a que
// coordinadores avisar. Esta pantalla no tiene sesion, asi que antes se
// descargaba el padron entero para averiguarlo aqui —y eso obligaba a dejar
// `/api/members/` abierta a cualquiera—.
const pedirRecuperacion = async ({ accion, numeroUsuario }) => {
  const respuesta = await fetch('/api/auth/recuperacion/', {
    // No es un cambio de la ficha de nadie: es la propia recuperacion de acceso,
    // que no pasa por Historial. Va por POST para no llevar el numero en la
    // direccion, donde acabaria en los registros del servidor.
    // eslint-disable-next-line no-restricted-syntax
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, numeroUsuario }),
  });
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(datos?.error || 'No pudimos atender la solicitud.');
  }

  return datos;
};

// ----------------------------------------------------------------------

export function FirebaseResetPasswordView({ mode = 'member' }) {
  const isAdminMode = mode === 'admin';
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  // A donde salio el enlace. Con esto la pantalla pasa a ser la misma "Revisa tu
  // correo" que la de verificacion: los dos casos se viven igual.
  const [correoEnviado, setCorreoEnviado] = useState('');

  const methods = useForm({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: isAdminMode ? { loginValue: '' } : { userNumber: '' },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const getLoginValue = (data) => {
    if (isAdminMode) return data.loginValue?.trim();

    const userNumber = String(data.userNumber || '').replace(/\D/g, '');

    return `${DEFAULT_PREFIX}${userNumber}`;
  };

  // Al servidor solo va el numero: el prefijo lo resuelve el, que es quien tiene
  // el padron.
  const getUserNumber = (data) => String(data.userNumber || '').replace(/\D/g, '');

  const handleSendEmailLink = handleSubmit(async (data) => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);

      const loginValue = getLoginValue(data);

      if (isAdminMode) {
        const admin = await findAdminProfileByLoginValue(loginValue);

        if (!admin) {
          setErrorMessage('No encontramos un administrador con ese usuario o correo.');
          return;
        }

        if (!admin.data?.correo) {
          setErrorMessage('No existe ningun correo asignado para este administrador.');
          return;
        }

        await sendPasswordResetEmail({ email: admin.data.correo });
        setCorreoEnviado(admin.data.correo);
        return;
      }

      const resultado = await pedirRecuperacion({
        accion: 'enlace',
        numeroUsuario: getUserNumber(data),
      });

      if (!resultado.puedeEnviar) {
        setErrorMessage(resultado.error);
        return;
      }

      // El servidor ya comprobo que ese correo es EL DE LA CUENTA. Mandarlo a
      // ciegas al de la ficha le cambiaba la clave a quien tuviera esa direccion
      // registrada: le paso al administrador, que pidio recuperar la de un
      // miembro y termino cambiando la suya.
      await sendPasswordResetEmail({ email: resultado.correo });

      setCorreoEnviado(resultado.correo);
    } catch (error) {
      if (!expectedResetErrorCodes.includes(error?.code)) {
        console.error(error);
      }

      setErrorMessage(getErrorMessage(error));
    }
  });

  const handleRequestCoordinator = handleSubmit(async (data) => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);

      // Se avisa a los DOS coordinadores del destacamento: el titular y su
      // asistente. Cualquiera de los dos puede ayudarle, y saber a quien acudir
      // ahorra el paso de preguntar. A quien hay que avisar lo resuelve el
      // servidor: aqui solo vuelven sus nombres.
      const { enviadas, coordinadores, aviso } = await pedirRecuperacion({
        accion: 'coordinador',
        numeroUsuario: getUserNumber(data),
      });

      if (aviso) {
        setErrorMessage(aviso);
        return;
      }

      if (!coordinadores.length) return;

      const nombres = coordinadores.map((coordinador) => coordinador.nombre);
      const listaNombres =
        nombres.length > 1
          ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
          : nombres[0];

      setSuccessMessage(
        enviadas
          ? `Solicitud enviada a ${listaNombres}. Recibirán el aviso para ayudarte a recuperar tu contraseña.`
          : `Tus coordinadores son ${listaNombres}, pero todavía no tienen cuenta para recibir el aviso. Contáctalos directamente.`
      );
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.message || 'No se pudo enviar la solicitud de recuperacion.');
    }
  });

  if (correoEnviado) {
    return (
      <EmailSentPanel
        description={`Te enviamos un enlace para restablecer tu contraseña a ${correoEnviado}. \nÁbrelo y elige una nueva.`}
        onResend={() => sendPasswordResetEmail({ email: correoEnviado })}
        returnHref={isAdminMode ? paths.auth.firebase.adminSignIn : paths.auth.firebase.signIn}
      />
    );
  }

  return (
    <>
      <FormHead
        icon={<PasswordIcon />}
        title="¿Olvidaste tu contraseña?"
        description={
          isAdminMode
            ? 'Ingresa tu usuario o correo de administrador para recuperar el acceso a tu cuenta.'
            : 'Ingresa tu usuario de miembro para recuperar el acceso a tu cuenta.'
        }
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {!!successMessage && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
          {successMessage}
        </Alert>
      )}

      <Form methods={methods}>
        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: (theme) => `1px solid ${theme.vars.palette.divider}`,
              bgcolor: 'background.neutral',
            }}
          >
            <Stack spacing={1.25}>
              <Typography variant="subtitle2">Que puedes hacer desde aqui</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Puedes pedir el enlace de recuperacion por correo o, si eres miembro, solicitar
                ayuda a tu coordinador cuando no tengas acceso al email registrado. El te dara un
                codigo que se escribe en el campo de contraseña del inicio de sesion.
              </Typography>
            </Stack>
          </Box>

          {isAdminMode ? (
            <Field.Text
              autoFocus
              name="loginValue"
              label="Usuario o correo electronico"
              placeholder="admin001 o correo@correo.com"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          ) : (
            <Field.Text
              autoFocus
              name="userNumber"
              label="Código de usuario"
              placeholder="10999"
              slotProps={{
                inputLabel: { shrink: true },
                // El prefijo se pinta dentro del campo, apagado: el miembro solo
                // escribe su numero y ve el codigo entero, como en su carnet.
                input: {
                  startAdornment: (
                    <InputAdornment position="start" disableTypography sx={{ mr: 0 }}>
                      <Box component="span" sx={{ color: 'text.disabled' }}>
                        {DEFAULT_PREFIX}
                      </Box>
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}

          <Button
            fullWidth
            size="large"
            type="button"
            variant="contained"
            loading={isSubmitting}
            loadingIndicator="Enviando solicitud..."
            onClick={handleSendEmailLink}
            sx={{ minHeight: 54, borderRadius: 1.8 }}
          >
            Enviar enlace a mi correo
          </Button>

          {!isAdminMode && (
            <Button
              fullWidth
              size="large"
              type="button"
              color="inherit"
              variant="outlined"
              loading={isSubmitting}
              loadingIndicator="Enviando solicitud..."
              onClick={handleRequestCoordinator}
              sx={{ minHeight: 54, borderRadius: 1.8 }}
            >
              Solicitar recuperación a mi Coordinador
            </Button>
          )}

          <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Si envias el enlace por correo, revisa tambien spam y promociones antes de intentar de
            nuevo.
          </Typography>
        </Box>
      </Form >

      <FormReturnLink
        href={isAdminMode ? paths.auth.firebase.adminSignIn : paths.auth.firebase.signIn}
      />
    </>
  );
}
