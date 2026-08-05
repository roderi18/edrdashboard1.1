'use client';

import * as z from 'zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { CONFIG } from 'src/global-config';
import { isFirebaseConfigured, missingFirebaseConfigKeys } from 'src/lib/firebase';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';
import { RouterLink } from 'src/routes/components';
import { useRouter } from 'src/routes/hooks';
import { paths } from 'src/routes/paths';
import { resolveAdminSignInEmail } from 'src/utils/admin-profile';
import { resolveSignInEmail } from 'src/utils/member-auth-credentials';

import { FormHead } from '../../components/form-head';
import { signInWithGoogle, signInWithPassword } from '../../components/context/firebase';
import { useAuthContext } from '../../hooks';
import { getErrorMessage } from '../../utils';

// ----------------------------------------------------------------------

const DEFAULT_PREFIX = 'DO-SD-';

const SIGN_IN_STORAGE_KEYS = {
  member: 'firebase-sign-in-member',
  admin: 'firebase-sign-in-admin',
};

const SOCIAL_SIGN_IN_OPTIONS = [
  { id: 'google', label: 'Google', icon: 'socials:google', disabled: false, helperText: '' },
  {
    id: 'apple',
    label: 'Apple',
    icon: 'mingcute:apple-fill',
    disabled: true,
    helperText: 'Proximamente',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: 'socials:facebook',
    disabled: true,
    helperText: 'Proximamente',
  },
];

const expectedAuthErrorCodes = [
  'auth/invalid-credential',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-email',
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
  const [socialProviderLoading, setSocialProviderLoading] = useState(null);
  const [rememberedValue, setRememberedValue] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

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
    const storedValue = window.localStorage.getItem(storageKey);

    if (!storedValue) {
      setRememberedValue('');
      return;
    }

    if (isAdminMode) {
      setValue('loginValue', storedValue);
    } else {
      setValue('userNumber', storedValue.replace(/^do-sd-/i, '').replace(/\D/g, ''));
    }

    setValue('rememberEmail', true);
    setRememberedValue(storedValue);
  }, [isAdminMode, setValue, storageKey]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      setErrorMessage(null);
      setIsRedirecting(false);

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
        setRememberedValue(loginValue);
      } else {
        window.localStorage.removeItem(storageKey);
        setRememberedValue('');
      }

      await signInWithPassword({ email: authEmail, password: data.password });
      await checkUserSession?.();

      setIsRedirecting(true);
      router.replace(CONFIG.auth.redirectPath);
    } catch (error) {
      setIsRedirecting(false);

      if (!expectedAuthErrorCodes.includes(error?.code)) {
        console.error(error);
      }

      setErrorMessage(getErrorMessage(error));
    }
  });

  const handleSocialSignIn = async (option) => {
    if (option.disabled) {
      return;
    }

    try {
      setErrorMessage(null);
      setSocialProviderLoading(option.id);

      await signInWithGoogle();
      await checkUserSession?.();

      setIsRedirecting(true);
      router.replace(CONFIG.auth.redirectPath);
    } catch (error) {
      setIsRedirecting(false);

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

  const isSigningIn = isSubmitting || Boolean(socialProviderLoading) || isRedirecting;

  return (
    <>
      <FormHead
        title={isAdminMode ? 'Inicia sesión como administrador' : 'Inicia sesión en tu cuenta'}
        description={
          isAdminMode
            ? 'Usa tu usuario o correo institucional para entrar, administrar accesos y continuar tu jornada sin fricción.'
            : 'Ingresa con tu código de usuario para consultar tu panel, retomar procesos y mantener tu cuenta al día.'
        }
        sx={{ textAlign: { xs: 'center', md: 'left' } }}
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {!isAuthReady && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          El inicio de sesión de Firebase no está disponible en este entorno. Revisa las variables
          publicas de Firebase en Netlify
          {missingFirebaseConfigKeys.length ? `: ${missingFirebaseConfigKeys.join(', ')}.` : '.'}
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
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
              placeholder="111111017"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}

          <Box sx={{ gap: 1.5, display: 'flex', flexDirection: 'column' }}>
            <Link
              component={RouterLink}
              href={
                isAdminMode ? paths.auth.firebase.adminResetPassword : paths.auth.firebase.resetPassword
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
            sx={{ minHeight: 54, borderRadius: 1.8 }}
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
              <Typography variant="body2">
                {isRedirecting ? 'Abriendo tu panel...' : 'Iniciando sesión...'}
              </Typography>
            </Box>
          ) : (
            <>
              <Divider sx={{ color: 'text.disabled', typography: 'caption' }}>
                o continúa con
              </Divider>

              <Box sx={{ gap: 1.5, display: 'flex', justifyContent: 'center' }}>
                {SOCIAL_SIGN_IN_OPTIONS.map((option) => {
                  const button = (
                    <IconButton
                      key={option.id}
                      color="inherit"
                      disabled={option.disabled || socialProviderLoading === option.id}
                      onClick={() => handleSocialSignIn(option)}
                      aria-label={
                        option.disabled
                          ? `${option.label} deshabilitado`
                          : `Iniciar sesión con ${option.label}`
                      }
                      title={
                        option.disabled
                          ? `${option.label} - ${option.helperText}`
                          : `Iniciar sesión con ${option.label}`
                      }
                      sx={{
                        border: (theme) => `1px solid ${theme.vars.palette.divider}`,
                        opacity: option.disabled ? 0.45 : 1,
                      }}
                    >
                      <Iconify width={22} icon={option.icon} />
                    </IconButton>
                  );

                  if (!option.disabled) {
                    return button;
                  }

                  return (
                    <Tooltip key={option.id} title={option.helperText} placement="top">
                      <Box sx={{ display: 'inline-flex' }}>{button}</Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </>
          )}

          {renderModeSwitch()}
        </Box>
      </Form>
    </>
  );
}
