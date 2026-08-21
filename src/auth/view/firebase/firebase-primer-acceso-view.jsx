'use client';

import { z as zod } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  sendEmailVerification,
  reauthenticateWithCredential,
} from 'firebase/auth';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { useRouter } from 'src/routes/hooks';

import {
  buildMemberAuthPassword,
  buildMemberAuthPasswordHeredada,
} from 'src/utils/member-auth-credentials';

import { AUTH } from 'src/lib/firebase';
import { CONFIG } from 'src/global-config';
import { marcarClaveCambiada } from 'src/services/primer-acceso-service';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from '../../hooks';
import { FormHead } from '../../components/form-head';

// ----------------------------------------------------------------------
// Primer acceso: cambiar la clave y, si quiere, dejar un correo propio.
//
// La clave inicial se deduce del codigo de miembro, asi que la sabe cualquiera
// que vea el codigo. No es un secreto: es un pase de un solo uso, y hasta que se
// cambie la sesion no pasa de aqui.
//
// El correo es OPCIONAL a proposito: muchos miembros son menores o no tienen
// uno. Quien lo deje podra entrar tambien con el una vez verificado; hasta
// entonces sigue entrando con su numero, que nunca deja de servir.
// ----------------------------------------------------------------------

const MINIMO_CLAVE = 6;

const PrimerAccesoSchema = zod
  .object({
    claveNueva: zod.string().min(MINIMO_CLAVE, {
      error: `La contraseña debe tener al menos ${MINIMO_CLAVE} caracteres.`,
    }),
    claveRepetida: zod.string().min(1, { error: 'Repite la contraseña.' }),
    correo: zod
      .string()
      .trim()
      .refine((valor) => !valor || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor), {
        error: 'Ese correo no parece válido.',
      }),
  })
  .refine((datos) => datos.claveNueva === datos.claveRepetida, {
    error: 'Las contraseñas no coinciden.',
    path: ['claveRepetida'],
  });

export function FirebasePrimerAccesoView() {
  const router = useRouter();
  const { user, checkUserSession } = useAuthContext();
  const mostrarClave = useBoolean();
  const [errorMessage, setErrorMessage] = useState(null);
  const [avisoCorreo, setAvisoCorreo] = useState(null);

  const methods = useForm({
    resolver: zodResolver(PrimerAccesoSchema),
    defaultValues: { claveNueva: '', claveRepetida: '', correo: '' },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (datos) => {
    setErrorMessage(null);
    setAvisoCorreo(null);

    const usuarioAuth = AUTH?.currentUser;

    if (!usuarioAuth) {
      setErrorMessage('Tu sesión expiró. Vuelve a entrar.');
      return;
    }

    const codigo = user?.codigoMiembro || user?.memberId || '';

    try {
      // Firebase exige haber iniciado sesion hace poco para cambiar clave o
      // correo. Se rehace con la clave inicial —la que acaba de usar para
      // entrar— y asi no hay que pedirsela de nuevo.
      // Se prueban las dos formas de la clave inicial: la actual (codigo completo) y
      // la heredada (solo el numero), porque las cuentas antiguas se crearon con esa.
      const clavesIniciales = [
        buildMemberAuthPassword(codigo),
        buildMemberAuthPasswordHeredada(codigo),
      ].filter(Boolean);

      for (const clave of clavesIniciales) {
        // En serie a proposito: en cuanto una vale, no hay que probar la siguiente.
         
        const reautenticado = await reauthenticateWithCredential(
          usuarioAuth,
          EmailAuthProvider.credential(usuarioAuth.email, clave)
        ).catch(() => null);

        if (reautenticado) break;
      }

      await updatePassword(usuarioAuth, datos.claveNueva);

      if (datos.correo) {
        try {
          await updateEmail(usuarioAuth, datos.correo);
          await sendEmailVerification(usuarioAuth);
          setAvisoCorreo(
            `Te enviamos un correo de verificación a ${datos.correo}. Ábrelo para confirmar que es tuyo.`
          );
        } catch (error) {
          setAvisoCorreo(
            error?.code === 'auth/email-already-in-use'
              ? 'Ese correo ya lo usa otra cuenta. Tu contraseña sí se cambió; puedes añadir el correo más tarde desde tu perfil.'
              : 'No pudimos guardar el correo. Tu contraseña sí se cambió; puedes añadirlo más tarde desde tu perfil.'
          );
        }
      }

      // Pasa por la puerta unica: cambiar la clave es un cambio de la ficha de una
      // persona y tiene que quedar en Historial como cualquier otro. Va directo
      // porque nadie tiene que aprobarle a alguien su propia contraseña.
      await proponerCambio({
        ambito: AMBITOS_CAMBIO.miembro,
        entidad: { id: String(user?.idMiembros || codigo), nombre: user?.displayName || codigo },
        cambios: [
          { campo: 'contraseña', antes: 'la inicial del código', despues: 'una propia' },
          ...(datos.correo ? [{ campo: 'correo', antes: '', despues: datos.correo }] : []),
        ],
        usuario: user,
        aplicarDirecto: true,
        descripcion: `${user?.displayName || codigo} cambió su contraseña en su primer acceso.`,
        aplicar: () =>
          marcarClaveCambiada({
            idDocumento: String(user?.idMiembros || codigo),
            correoPersonal: datos.correo || '',
          }),
      });

      await checkUserSession?.();

      // Con correo se espera: si redirige de inmediato, el aviso de "revisa tu
      // bandeja" desaparece antes de que le de tiempo a leerlo.
      if (!datos.correo) {
        router.replace(CONFIG.auth.redirectPath);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.code === 'auth/requires-recent-login'
          ? 'Por seguridad, vuelve a entrar y repite el cambio.'
          : error?.message || 'No pudimos cambiar la contraseña.'
      );
    }
  });

  return (
    <>
      <FormHead
        title="Crea tu contraseña"
        description="Entraste con la contraseña que sale de tu número, y esa la sabe cualquiera que vea tu código. Elige una tuya para seguir."
        sx={{ textAlign: { xs: 'center', md: 'left' } }}
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      {!!avisoCorreo && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {avisoCorreo}{' '}
          <Link
            component="button"
            type="button"
            onClick={() => router.replace(CONFIG.auth.redirectPath)}
          >
            Continuar al panel
          </Link>
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          <Field.Text
            name="claveNueva"
            label="Nueva contraseña"
            type={mostrarClave.value ? 'text' : 'password'}
            slotProps={{
              inputLabel: { shrink: true },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={mostrarClave.onToggle} edge="end">
                      <Iconify
                        icon={mostrarClave.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Field.Text
            name="claveRepetida"
            label="Repite la contraseña"
            type={mostrarClave.value ? 'text' : 'password'}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Divider sx={{ typography: 'caption', color: 'text.disabled' }}>opcional</Divider>

          <Field.Text
            name="correo"
            label="Correo electrónico (opcional)"
            placeholder="tucorreo@ejemplo.com"
            helperText="Si lo dejas, te enviamos un correo para verificarlo y podrás entrar también con él. Si no, sigues entrando con tu número."
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Tu número de miembro no cambia: seguirá sirviendo para entrar.
          </Typography>

          <LoadingButton
            fullWidth
            color="inherit"
            size="large"
            type="submit"
            variant="contained"
            loading={isSubmitting}
            loadingIndicator="Guardando..."
          >
            Guardar y continuar
          </LoadingButton>
        </Box>
      </Form>
    </>
  );
}
