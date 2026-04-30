'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { resolveAdminSignInEmail } from 'src/utils/admin-profile';
import { resolveSignInEmail } from 'src/utils/member-auth-credentials';

import { isFirebaseConfigured } from 'src/lib/firebase';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from '../../hooks';
import { getErrorMessage } from '../../utils';
import { FormHead } from '../../components/form-head';
import { signInWithPassword } from '../../components/context/firebase';

// ----------------------------------------------------------------------

const expectedAuthErrorCodes = [
  'auth/invalid-credential',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-email',
];

const DEFAULT_PREFIX = 'DO-SD-';

const SIGN_IN_STORAGE_KEYS = {
  member: 'firebase-sign-in-member',
  admin: 'firebase-sign-in-admin',
};

export const MemberSignInSchema = z.object({
  userNumber: z.string().min(1, { error: 'El código de usuario es requerido.' }),
  password: z
    .string()
    .min(1, { error: 'La contraseña es requerida.' })
    .min(6, { error: 'La contraseña debe tener al menos 6 caracteres.' }),
  rememberEmail: z.boolean(),
});

export const AdminSignInSchema = z.object({
  loginValue: z.string().min(1, { error: 'El usuario o correo es requerido.' }),
  password: z
    .string()
    .min(1, { error: 'La contraseña es requerida.' })
    .min(6, { error: 'La contraseña debe tener al menos 6 caracteres.' }),
  rememberEmail: z.boolean(),
});

// ----------------------------------------------------------------------

export function FirebaseSignInView({ mode = 'member' }) {
  const router = useRouter();
  const showPassword = useBoolean();
  const { checkUserSession } = useAuthContext();

  const isAdminMode = mode === 'admin';
  const storageKey = SIGN_IN_STORAGE_KEYS[mode] ?? SIGN_IN_STORAGE_KEYS.member;
  const isAuthReady = isFirebaseConfigured;

  const schema = useMemo(
    () => (isAdminMode ? AdminSignInSchema : MemberSignInSchema),
    [isAdminMode]
  );

  const [prefix, setPrefix] = useState(DEFAULT_PREFIX);
  const [errorMessage, setErrorMessage] = useState(null);

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: isAdminMode
      ? { loginValue: '', password: '', rememberEmail: false }
      : { userNumber: '', password: '', rememberEmail: false },
  });

  const {
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    const rememberedValue = window.localStorage.getItem(storageKey);

    if (!rememberedValue) {
      return;
    }

    if (isAdminMode) {
      setValue('loginValue', rememberedValue);
    } else {
      setPrefix(DEFAULT_PREFIX);
      setValue('userNumber', rememberedValue.replace(/^do-sd-/i, ''));
    }

    setValue('rememberEmail', true);
  }, [isAdminMode, setValue, storageKey]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const loginValue = isAdminMode ? data.loginValue.trim() : `${prefix}${data.userNumber}`.trim();
      const authEmail = isAdminMode
        ? await resolveAdminSignInEmail(loginValue)
        : resolveSignInEmail(loginValue);

      if (!authEmail) {
        throw new Error(
          isAdminMode
            ? 'No encontramos ese usuario de administrador.'
            : 'No encontramos ese usuario de miembro.'
        );
      }

      if (data.rememberEmail) {
        window.localStorage.setItem(storageKey, loginValue);
      } else {
        window.localStorage.removeItem(storageKey);
      }

      await signInWithPassword({ email: authEmail, password: data.password });
      await checkUserSession?.();

      router.replace(paths.dashboard.root);
    } catch (error) {
      if (!expectedAuthErrorCodes.includes(error?.code)) {
        console.error(error);
      }

      setErrorMessage(getErrorMessage(error));
    }
  });

  const renderModeSwitch = () => {
    const href = isAdminMode ? paths.auth.firebase.signIn : paths.auth.firebase.adminSignIn;
    const label = isAdminMode ? 'Volver al inicio de sesión de miembros' : 'Iniciar sesión como administrador';

    return (
      <Link
        component={RouterLink}
        href={href}
        variant="body2"
        color="inherit"
        sx={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
      >
        {label}
        <Iconify icon="eva:arrow-ios-forward-fill" width={16} />
      </Link>
    );
  };

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

      <Box sx={{ gap: 1.5, display: 'flex', flexDirection: 'column' }}>
        <Link
          component={RouterLink}
          href={isAdminMode ? paths.auth.firebase.adminResetPassword : paths.auth.firebase.resetPassword}
          variant="body2"
          color="inherit"
          sx={{ alignSelf: 'flex-end' }}
        >
          ¿Olvidaste tu contraseña?
        </Link>

        <Field.Text
          name="password"
          label="Contraseña"
          placeholder="6+ caracteres"
          type={showPassword.value ? 'text' : 'password'}
          slotProps={{
            inputLabel: { shrink: true },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={showPassword.onToggle} edge="end">
                    <Iconify
                      icon={showPassword.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                    />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Field.Checkbox name="rememberEmail" label="Recordar usuario" />

      <Button
        fullWidth
        color="inherit"
        size="large"
        type="submit"
        variant="contained"
        loading={isSubmitting}
        loadingIndicator="Iniciando sesión..."
      >
        {isAdminMode ? 'Entrar como administrador' : 'Iniciar sesión'}
      </Button>

      {renderModeSwitch()}
    </Box>
  );

  return (
    <>
      <FormHead
        title={isAdminMode ? 'Inicia sesión como administrador' : 'Inicia sesión en tu cuenta'}
        sx={{ textAlign: { xs: 'center', md: 'left' } }}
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      {!isAuthReady && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          El inicio de sesión de Firebase no está disponible en este entorno. Revisa las
          variables públicas de Firebase en Netlify.
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        {renderForm()}
      </Form>
    </>
  );
}
