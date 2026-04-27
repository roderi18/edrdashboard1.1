'use client';

import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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

import { getErrorMessage } from '../../utils';
import { FormHead } from '../../components/form-head';
import { FormDivider } from '../../components/form-divider';
import { FormSocials } from '../../components/form-socials';
import { SignUpTerms } from '../../components/sign-up-terms';
import {
  signUp,
  signInWithGithub,
  signInWithGoogle,
  signInWithTwitter,
} from '../../components/context/firebase';

// ----------------------------------------------------------------------

export const SignUpSchema = z.object({
  firstName: z.string().min(1, { error: 'El nombre es requerido.' }),
  lastName: z.string().min(1, { error: 'El apellido es requerido.' }),
  email: schemaUtils.email(),
  password: z
    .string()
    .min(1, { error: 'La contraseña es requerida.' })
    .min(6, { error: 'La contraseña debe tener al menos 6 caracteres.' }),
});

// ----------------------------------------------------------------------

export function FirebaseSignUpView() {
  const router = useRouter();

  const showPassword = useBoolean();

  const [errorMessage, setErrorMessage] = useState(null);

  const defaultValues = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  };

  const methods = useForm({
    resolver: zodResolver(SignUpSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const createRedirectPath = (query) => {
    const queryString = new URLSearchParams({ email: query }).toString();
    return `${paths.auth.firebase.verify}?${queryString}`;
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      await signUp({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });

      const redirectPath = createRedirectPath(data.email);

      router.push(redirectPath);
    } catch (error) {
      console.error(error);
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
      <Box
        sx={{ display: 'flex', gap: { xs: 3, sm: 2 }, flexDirection: { xs: 'column', sm: 'row' } }}
      >
        <Field.Text name="firstName" label="Nombre" slotProps={{ inputLabel: { shrink: true } }} />
        <Field.Text name="lastName" label="Apellido" slotProps={{ inputLabel: { shrink: true } }} />
      </Box>

      <Field.Text name="email" label="Correo electrónico" slotProps={{ inputLabel: { shrink: true } }} />

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
                  <Iconify icon={showPassword.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Button
        fullWidth
        color="inherit"
        size="large"
        type="submit"
        variant="contained"
        loading={isSubmitting}
        loadingIndicator="Creando cuenta..."
      >
        Crear cuenta
      </Button>
    </Box>
  );

  return (
    <>
      <FormHead
        title="Crea tu cuenta gratis"
        description={
          <>
            {`¿Ya tienes una cuenta? `}
            <Link component={RouterLink} href={paths.auth.firebase.signIn} variant="subtitle2">
              Iniciar sesión
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

      <SignUpTerms />

      <FormDivider label="O" />

      <FormSocials
        signInWithGoogle={handleSignInWithGoogle}
        singInWithGithub={handleSignInWithGithub}
        signInWithTwitter={handleSignInWithTwitter}
      />
    </>
  );
}
