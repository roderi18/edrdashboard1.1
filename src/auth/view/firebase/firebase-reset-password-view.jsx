'use client';

import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

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

const DEFAULT_PREFIX = 'DO-SD-';

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
    throw new Error('No se pudo consultar la información del miembro.');
  }

  const data = await res.json();

  return getRowsFromApi(data).find(
    (member) => normalizeMemberUsername(member.codigoMiembro) === normalizedUsername
  );
};

// ----------------------------------------------------------------------

export function FirebaseResetPasswordView({ mode = 'member' }) {
  const isAdminMode = mode === 'admin';
  const [prefix, setPrefix] = useState(DEFAULT_PREFIX);
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

  const getLoginValue = (data) => (isAdminMode ? data.loginValue?.trim() : `${prefix}${data.userNumber}`.trim());

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
          setErrorMessage('No existe ningún correo asignado para este administrador.');
          return;
        }

        await sendPasswordResetEmail({ email: admin.data.correo });
        setSuccessMessage(`Te enviamos un enlace para restablecer tu contraseña a ${admin.data.correo}.`);
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

      setSuccessMessage('Solicitud de recuperación enviada a John Doe - Dest. Prueba 18.');
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.message || 'No se pudo enviar la solicitud de recuperación.');
    }
  });

  const renderForm = () => (
    <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
      {isAdminMode ? (
        <Field.Text
          autoFocus
          name="loginValue"
          label="Usuario o correo electrónico"
          placeholder="admin001 o correo@correo.com"
          slotProps={{ inputLabel: { shrink: true } }}
        />
      ) : (
        <Stack direction="row" spacing={1}>
          <TextField
            select
            label="Prefijo"
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
            sx={{ width: 140 }}
            slotProps={{ inputLabel: { shrink: true } }}
          >
            <MenuItem value="DO-SD-">DO-SD-</MenuItem>
          </TextField>

          <Field.Text
            autoFocus
            name="userNumber"
            label="Código de usuario"
            placeholder="111111017"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      )}

      <Button
        fullWidth
        size="large"
        type="button"
        variant="contained"
        loading={isSubmitting}
        loadingIndicator="Enviando solicitud..."
        onClick={handleSendEmailLink}
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
        >
          Solicitar recuperación a mi Coordinador
        </Button>
      )}
    </Box>
  );

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
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      {!!successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      <Form methods={methods}>{renderForm()}</Form>

      <FormReturnLink href={isAdminMode ? paths.auth.firebase.adminSignIn : paths.auth.firebase.signIn} />
    </>
  );
}
