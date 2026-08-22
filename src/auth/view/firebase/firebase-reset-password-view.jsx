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
import { normalizeMemberUsername } from 'src/utils/member-auth-credentials';

import { PasswordIcon } from 'src/assets/icons';
import {
  notificarCoordinadoresRecuperacionClave,
} from 'src/services/solicitudes-cambio-notificaciones-service';

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

// Devuelve el miembro y TODA la lista: los nombres de los coordinadores salen de
// ahi mismo, sin pedir el listado por segunda vez.
const buscarMiembroConLista = async (username) => {
  const normalizedUsername = normalizeMemberUsername(username);
  const res = await fetch('/api/members/');

  if (!res.ok) {
    throw new Error('No se pudo consultar la informacion del miembro.');
  }

  const miembros = getRowsFromApi(await res.json());

  return {
    miembros,
    member: miembros.find(
      (member) => normalizeMemberUsername(member.codigoMiembro) === normalizedUsername
    ),
  };
};

const findMemberByUsername = async (username) => (await buscarMiembroConLista(username)).member;

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
        setErrorMessage(
          'Este usuario no tiene correo asignado. Pídele la recuperación a tu Coordinador con el botón de abajo.'
        );
        return;
      }

      // El enlace de Firebase cambia la clave de la cuenta QUE TENGA ese correo.
      // El de la ficha del miembro casi nunca es el de su cuenta —esta usa
      // `<codigo>@exploradores.app` mientras no verifique uno propio—, y
      // enviarlo a ciegas cambiaba la clave de OTRA persona. Se comprueba antes.
      const comprobacion = await fetch('/api/auth/correo-recuperacion', {
        // No cambia nada: es una consulta. Va por POST para no llevar el correo
        // en la direccion, donde acabaria en los registros del servidor.
        // eslint-disable-next-line no-restricted-syntax
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: loginValue,
          correo: member.correo,
          idMiembros: member.idMiembros ?? member.id ?? null,
        }),
      })
        .then((respuesta) => respuesta.json())
        .catch(() => null);

      if (!comprobacion?.coincide) {
        setErrorMessage(
          comprobacion?.tieneCorreoPropio
            ? 'El correo de tu ficha no es el de tu cuenta de acceso, así que el enlace no te llegaría. Pídele la recuperación a tu Coordinador con el botón de abajo.'
            : 'Tu cuenta está configurada para iniciar sesión con tu código de miembro y no tiene un correo electrónico asociado. Por esta razón, no podemos enviarte un enlace de recuperación. Utiliza el botón de abajo para solicitar ayuda a tu Coordinador.'
        );
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

      const { member, miembros } = await buscarMiembroConLista(getLoginValue(data));

      if (!member) {
        setErrorMessage('No encontramos un miembro con ese usuario.');
        return;
      }

      // Se avisa a los DOS coordinadores del destacamento: el titular y su
      // asistente. Cualquiera de los dos puede ayudarle, y saber a quien acudir
      // ahorra el paso de preguntar.
      const { enviadas, coordinadores } = await notificarCoordinadoresRecuperacionClave({
        member,
        miembros,
        onInfo: (aviso) => setErrorMessage(aviso),
      });

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
