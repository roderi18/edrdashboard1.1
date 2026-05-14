'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { resolveAdminSignInEmail } from 'src/utils/admin-profile';
import { resolveSignInEmail } from 'src/utils/member-auth-credentials';

import { CONFIG } from 'src/global-config';
import { isFirebaseConfigured, missingFirebaseConfigKeys } from 'src/lib/firebase';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from '../../hooks';
import { getErrorMessage } from '../../utils';
import { FormHead } from '../../components/form-head';
import { signInWithGoogle, signInWithPassword } from '../../components/context/firebase';

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

const SOCIAL_SIGN_IN_OPTIONS = [
  { id: 'google', label: 'Google', icon: 'socials:google' },
  { id: 'apple', label: 'Apple', icon: 'mingcute:apple-fill' },
  { id: 'facebook', label: 'Facebook', icon: 'socials:facebook' },
];

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

  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedSocialProvider, setSelectedSocialProvider] = useState(null);
  const [socialProviderLoading, setSocialProviderLoading] = useState(null);
  const selectedSocialOption = SOCIAL_SIGN_IN_OPTIONS.find(
    (option) => option.id === selectedSocialProvider
  );

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
      setValue('userNumber', rememberedValue.replace(/^do-sd-/i, '').replace(/\D/g, ''));
    }

    setValue('rememberEmail', true);
  }, [isAdminMode, setValue, storageKey]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const userNumber = String(data.userNumber || '').replace(/\D/g, '');
      const loginValue = isAdminMode ? data.loginValue.trim() : `${DEFAULT_PREFIX}${userNumber}`;
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

      router.replace(CONFIG.auth.redirectPath);
    } catch (error) {
      if (!expectedAuthErrorCodes.includes(error?.code)) {
        console.error(error);
      }

      setErrorMessage(getErrorMessage(error));
    }
  });

  const handleSocialSignIn = async (option) => {
    if (option.id !== 'google') {
      setSelectedSocialProvider(option.id);
      return;
    }

    try {
      setErrorMessage(null);
      setSocialProviderLoading(option.id);

      await signInWithGoogle();
      await checkUserSession?.();

      router.replace(CONFIG.auth.redirectPath);
    } catch (error) {
      if (!expectedAuthErrorCodes.includes(error?.code)) {
        console.error(error);
      }

      setErrorMessage(getErrorMessage(error));
    } finally {
      setSocialProviderLoading(null);
    }
  };

  const renderModeSwitch = () => {
    const href = isAdminMode ? paths.auth.firebase.signIn : paths.auth.firebase.adminSignIn;
    const label = isAdminMode
      ? 'Volver al inicio de sesión de miembros'
      : 'Iniciar sesión como administrador';

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

  const renderSocialSignInMock = () => (
    <Box sx={{ gap: 3, display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
      <Box
        sx={{
          width: 76,
          height: 76,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'background.neutral',
          border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
        }}
      >
        <Iconify width={34} icon={selectedSocialOption.icon} />
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h5">Iniciar sesión con {selectedSocialOption.label}</Typography>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          Esta es una vista de prueba para revisar el flujo visual. Todavía no conecta con Firebase.
        </Typography>
      </Box>

      <Button fullWidth type="button" color="inherit" size="large" variant="contained">
        Continuar con {selectedSocialOption.label}
      </Button>

      <Button
        fullWidth
        type="button"
        size="large"
        variant="outlined"
        onClick={() => setSelectedSocialProvider(null)}
      >
        Volver al inicio de sesión
      </Button>
    </Box>
  );

  const renderForm = () => {
    if (selectedSocialOption) {
      return renderSocialSignInMock();
    }

    const isSigningIn = isSubmitting || Boolean(socialProviderLoading);

    return (
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
          <Field.Text
            autoFocus
            name="userNumber"
            label="Código de usuario"
            placeholder="111111017"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}

        <Box sx={{ gap: 1.5, display: 'flex', flexDirection: 'column' }}>
          <Link
            component={RouterLink}
            href={
              isAdminMode
                ? paths.auth.firebase.adminResetPassword
                : paths.auth.firebase.resetPassword
            }
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
          disabled={isSigningIn}
          loading={isSubmitting}
          loadingIndicator="Iniciando sesión..."
        >
          {isAdminMode ? 'Entrar como administrador' : 'Iniciar sesión'}
        </Button>

        {isSigningIn ? (
          <Box
            aria-live="polite"
            sx={{
              gap: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            <CircularProgress size={20} color="inherit" />
            <Typography variant="body2">Iniciando sesión...</Typography>
          </Box>
        ) : (
          <Box sx={{ gap: 1.5, display: 'flex', justifyContent: 'center' }}>
            {SOCIAL_SIGN_IN_OPTIONS.map((option) => (
              <IconButton
                key={option.id}
                color="inherit"
                disabled={socialProviderLoading === option.id}
                onClick={() => handleSocialSignIn(option)}
                aria-label={`Iniciar sesión con ${option.label}`}
                title={`Iniciar sesión con ${option.label}`}
              >
                <Iconify width={22} icon={option.icon} />
              </IconButton>
            ))}
          </Box>
        )}

        <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          Para iniciar sesión con estas aplicaciones, primero vincula tu cuenta desde Perfil &gt;
          Seguridad.
        </Typography>

        {renderModeSwitch()}
      </Box>
    );
  };

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
          El inicio de sesión de Firebase no está disponible en este entorno. Revisa las variables
          públicas de Firebase en Netlify
          {missingFirebaseConfigKeys.length ? `: ${missingFirebaseConfigKeys.join(', ')}.` : '.'}
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        {renderForm()}
      </Form>
    </>
  );
}
