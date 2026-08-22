'use client';

import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { findAdminProfileByLoginValue } from 'src/utils/admin-profile';
import { normalizeMemberUsername } from 'src/utils/member-auth-credentials';

import { PasswordIcon } from 'src/assets/icons';

import { Form, Field } from 'src/components/hook-form';

import { getErrorMessage } from '../../utils';
import { FormHead } from '../../components/form-head';
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

const getRowsFromApi = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
};

const findMemberByUsername = async (username) => {
  const normalizedUsername = normalizeMemberUsername(username);
  const res = await fetch('/api/members/');

  if (!res.ok) {
    throw new Error('No se pudo consultar la informacion del miembro.');
  }

  const data = await res.json();

  return getRowsFromApi(data).find(
    (member) => normalizeMemberUsername(member.codigoMiembro) === normalizedUsername
  );
};

// ----------------------------------------------------------------------

export function FirebaseResetPasswordView({ mode = 'member' }) {
  const isAdminMode = mode === 'admin';
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

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
        setSuccessMessage(
          `Te enviamos un enlace para restablecer tu contraseña a ${admin.data.correo}.`
        );
        return;
      }

      const member = await findMemberByUsername(loginValue);

      if (!member) {
        setErrorMessage('No encontramos un miembro con ese usuario.');
        return;
      }

      if (!member.correo) {
        setErrorMessage('Este usuario no tiene correo asignado.');
        return;
      }

      await sendPasswordResetEmail({ email: member.correo });

      setSuccessMessage(`Te enviamos un enlace para restablecer tu contraseña a ${member.correo}.`);
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

      const member = await findMemberByUsername(getLoginValue(data));

      if (!member) {
        setErrorMessage('No encontramos un miembro con ese usuario.');
        return;
      }

      setSuccessMessage(
        'Solicitud de recuperacion enviada. Tu coordinador recibira el aviso para ayudarte.'
      );
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.message || 'No se pudo enviar la solicitud de recuperacion.');
    }
  });

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
                ayuda a tu coordinador cuando no tengas acceso al email registrado.
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip size="small" variant="outlined" label="Enlace por correo" />
                {!isAdminMode && (
                  <Chip size="small" variant="outlined" label="Ayuda del coordinador" />
                )}
                {/* <Chip size="small" variant="outlined" label="Paso a paso" /> */}
              </Stack>
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
              placeholder="10002"
              slotProps={{
                inputLabel: { shrink: true },
                // El prefijo se pinta dentro del campo, apagado: el miembro solo
                // escribe su numero y ve el codigo entero, como en su carnet.
                input: {
                  startAdornment: (
                    <InputAdornment position="start" disableTypography>
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
              Solicitar recuperacion a mi Coordinador
            </Button>
          )}

          <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Si envias el enlace por correo, revisa tambien spam y promociones antes de intentar de
            nuevo.
          </Typography>
        </Box>
      </Form>

      <FormReturnLink
        href={isAdminMode ? paths.auth.firebase.adminSignIn : paths.auth.firebase.signIn}
      />
    </>
  );
}
