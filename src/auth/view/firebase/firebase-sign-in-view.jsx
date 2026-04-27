'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';
import { Form, Field, schemaUtils } from 'src/components/hook-form';

import { useAuthContext } from '../../hooks';
import { getErrorMessage } from '../../utils';
import { FormHead } from '../../components/form-head';
import { FormDivider } from '../../components/form-divider';
import { FormSocials } from '../../components/form-socials';
import {
  signInWithGoogle,
  signInWithGithub,
  signInWithTwitter,
  signInWithPassword,
} from '../../components/context/firebase';

// ----------------------------------------------------------------------

const expectedAuthErrorCodes = [
  'auth/invalid-credential',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-email',
];

const REMEMBER_EMAIL_KEY = 'firebase-sign-in-email';

export const SignInSchema = z.object({
  email: schemaUtils.email(),
  password: z
    .string()
    .min(1, { error: 'La contraseña es requerida.' })
    .min(6, { error: 'La contraseña debe tener al menos 6 caracteres.' }),
  rememberEmail: z.boolean(),
});

// ----------------------------------------------------------------------

export function FirebaseSignInView() {
  const router = useRouter();

  const showPassword = useBoolean();

  const { checkUserSession } = useAuthContext();

  const [errorMessage, setErrorMessage] = useState(null);

  const defaultValues = {
    email: '',
    password: '',
    rememberEmail: false,
  };

  const methods = useForm({
    resolver: zodResolver(SignInSchema),
    defaultValues,
  });

  const {
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);

    if (rememberedEmail) {
      setValue('email', rememberedEmail);
      setValue('rememberEmail', true);
    }
  }, [setValue]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (data.rememberEmail) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, data.email);
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      await signInWithPassword({ email: data.email, password: data.password });
      await checkUserSession?.();

      router.replace(paths.dashboard.root);
    } catch (error) {
      if (!expectedAuthErrorCodes.includes(error?.code)) {
        console.error(error);
      }

      const feedbackMessage = getErrorMessage(error);
      setErrorMessage(feedbackMessage);
    }
  });

  const handleSignInWithGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSignInWithGithub = async () => {
    try {
      await signInWithGithub();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSignInWithTwitter = async () => {
    try {
      await signInWithTwitter();
    } catch (error) {
      console.error(error);
    }
  };

  const renderForm = () => (
    <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
      <Field.Text name="email" label="Correo electrónico" slotProps={{ inputLabel: { shrink: true } }} />

      <Box sx={{ gap: 1.5, display: 'flex', flexDirection: 'column' }}>
        <Link
          component={RouterLink}
          href={paths.auth.firebase.resetPassword}
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
        Iniciar sesión
      </Button>
    </Box>
  );

  return (
    <>
      <FormHead
        title="Inicia sesión en tu cuenta"
        description={
          <>
            {`¿No tienes una cuenta? `}
            <Link component={RouterLink} href={paths.auth.firebase.signUp} variant="subtitle2">
              Crear cuenta
            </Link>
          </>
        }
        sx={{ textAlign: { xs: 'center', md: 'left' } }}
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        {renderForm()}
      </Form>

      <FormDivider label="O" />

      <FormSocials
        signInWithGoogle={handleSignInWithGoogle}
        singInWithGithub={handleSignInWithGithub}
        signInWithTwitter={handleSignInWithTwitter}
      />
    </>
  );
}
