'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { useBoolean } from 'minimal-shared/hooks';
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

import { resolveSignInEmail } from 'src/utils/member-auth-credentials';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

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
const DEFAULT_PREFIX = 'DO-SD-';

export const SignInSchema = z.object({
  userNumber: z.string().min(1, { error: 'El usuario es requerido.' }),
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

  const [prefix, setPrefix] = useState(DEFAULT_PREFIX);
  const [errorMessage, setErrorMessage] = useState(null);

  const methods = useForm({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      userNumber: '',
      password: '',
      rememberEmail: false,
    },
  });

  const {
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    const rememberedUser = window.localStorage.getItem(REMEMBER_EMAIL_KEY);

    if (rememberedUser) {
      setPrefix(DEFAULT_PREFIX);
      setValue('userNumber', rememberedUser.replace(/^do-sd-/i, ''));
      setValue('rememberEmail', true);
    }
  }, [setValue]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const loginValue = `${prefix}${data.userNumber}`.trim();
      const authEmail = resolveSignInEmail(loginValue);

      if (data.rememberEmail) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, loginValue);
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
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
          name="userNumber"
          label="Código de usuario"
          placeholder="111111017"
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>

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
