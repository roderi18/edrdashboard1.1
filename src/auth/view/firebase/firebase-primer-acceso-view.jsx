'use client';

import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  updatePassword,
  EmailAuthProvider,
  verifyBeforeUpdateEmail,
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

import { MEMBER_AUTH_DOMAIN, clavesInicialesMiembro } from 'src/utils/member-auth-credentials';

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

  // Correo con el que se creo al miembro. El de la sesion puede ser el interno
  // (`...@exploradores.app`), que no es de nadie y no se ofrece.
  const correoDelMiembro = String(user?.email || user?.correo || '').trim();
  const correoInicial = correoDelMiembro.toLowerCase().endsWith(`@${MEMBER_AUTH_DOMAIN}`)
    ? ''
    : correoDelMiembro;

  const [comprobandoCorreo, setComprobandoCorreo] = useState(false);

  // Bienvenida: su nombre, y debajo el codigo con el que acaba de entrar.
  const nombreDeSaludo = String(
    user?.displayName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || ''
  ).trim();
  // Si el perfil todavia no trae el codigo, se saca del correo interno con el
  // que acaba de entrar (`edr-10002@exploradores.app`), que siempre esta.
  const correoDeAcceso = String(AUTH?.currentUser?.email || '').toLowerCase();
  const codigoDelCorreo = correoDeAcceso.endsWith(`@${MEMBER_AUTH_DOMAIN}`)
    ? correoDeAcceso.split('@')[0].toUpperCase()
    : '';
  const codigoMiembro = String(
    user?.codigoMiembro || user?.memberId || codigoDelCorreo || ''
  ).trim();

  const methods = useForm({
    resolver: zodResolver(PrimerAccesoSchema),
    defaultValues: { claveNueva: '', claveRepetida: '', correo: correoInicial },
  });

  const {
    handleSubmit,
    formState: { isSubmitting, dirtyFields },
  } = methods;

  // La ficha del miembro puede llegar despues del primer pintado: se rellena
  // entonces, salvo que ya lo haya tocado a mano.
  useEffect(() => {
    if (!correoInicial || dirtyFields.correo) return;

    methods.setValue('correo', correoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correoInicial]);

  // El correo identifica a la persona: con el se recupera la clave y, una vez
  // verificado, se entra. Si ya es de otro miembro, los dos se quedarian sin
  // forma de distinguirse. Se comprueba contra el listado, que es el que ve el
  // resto de la aplicacion, y se avisa en el propio campo.
  const correoYaEsDeOtro = async (correo) => {
    const buscado = String(correo ?? '')
      .trim()
      .toLowerCase();

    if (!buscado) return false;

    setComprobandoCorreo(true);

    try {
      const res = await fetch('/api/members/');

      if (!res.ok) return false;

      const cuerpo = await res.json();
      const miembros = cuerpo?.data || cuerpo?.Data || cuerpo || [];
      const idActual = String(user?.idMiembros ?? '');

      return (Array.isArray(miembros) ? miembros : []).some((miembro) => {
        const suCorreo = String(miembro?.correo || miembro?.email || '')
          .trim()
          .toLowerCase();

        return suCorreo === buscado && String(miembro?.idMiembros ?? miembro?.id ?? '') !== idActual;
      });
    } catch {
      // Sin listado no se puede afirmar que este repetido: se deja pasar y lo
      // atrapa Firebase con `auth/email-already-in-use`.
      return false;
    } finally {
      setComprobandoCorreo(false);
    }
  };

  const revisarCorreoAlSalir = async (evento) => {
    const correo = evento.target.value;

    methods.clearErrors('correo');

    if (await correoYaEsDeOtro(correo)) {
      methods.setError('correo', {
        type: 'manual',
        message: 'Ese correo ya lo usa otro miembro. Escribe otro o déjalo vacío.',
      });
    }
  };

  const onSubmit = handleSubmit(async (datos) => {
    setErrorMessage(null);
    setAvisoCorreo(null);

    const usuarioAuth = AUTH?.currentUser;

    if (!usuarioAuth) {
      setErrorMessage('Tu sesión expiró. Vuelve a entrar.');
      return;
    }

    const codigo = user?.codigoMiembro || user?.memberId || '';

    // Antes de cambiar nada: si el correo es de otro, no se sigue.
    if (datos.correo && (await correoYaEsDeOtro(datos.correo))) {
      methods.setError('correo', {
        type: 'manual',
        message: 'Ese correo ya lo usa otro miembro. Escribe otro o déjalo vacío.',
      });

      return;
    }

    try {
      // Firebase exige haber iniciado sesion hace poco para cambiar clave o
      // correo. Se rehace con la clave inicial —la que acaba de usar para
      // entrar— y asi no hay que pedirsela de nuevo.
      // Se prueban todas las formas de la clave inicial: la de ahora (codigo en
      // MAYUSCULAS) y las de las cuentas antiguas (en minusculas, y solo el
      // numero). Es una comprobacion interna: no la teclea nadie.
      const clavesIniciales = clavesInicialesMiembro(codigo);

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
          // `updateEmail` esta bloqueado cuando el proyecto tiene activada la
          // proteccion contra enumeracion de correos (lo esta por defecto), y
          // fallaba con `auth/operation-not-allowed`: de ahi el "No pudimos
          // guardar el correo". `verifyBeforeUpdateEmail` es el camino que si
          // admite: manda el enlace al correo nuevo y la cuenta lo adopta cuando
          // se abre, que es justo lo que promete el texto de abajo.
          await verifyBeforeUpdateEmail(usuarioAuth, datos.correo);
          setAvisoCorreo(
            `Te enviamos un correo de verificación a ${datos.correo}. Ábrelo para confirmar que es tuyo; hasta entonces sigues entrando con tu número.`
          );
        } catch (error) {
          console.error('[primer acceso] no se pudo guardar el correo', error);

          const motivos = {
            'auth/email-already-in-use':
              'Ese correo ya lo usa otra cuenta.',
            'auth/invalid-email': 'Ese correo no parece válido.',
            'auth/requires-recent-login':
              'Por seguridad hay que volver a entrar antes de cambiar el correo.',
            'auth/operation-not-allowed':
              'El proyecto no permite cambiar el correo desde aquí.',
            'auth/too-many-requests': 'Demasiados intentos seguidos; espera un momento.',
          };

          setAvisoCorreo(
            `${motivos[error?.code] || 'No pudimos guardar el correo.'} Tu contraseña sí se cambió; puedes añadirlo más tarde desde tu perfil.`
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
      {!!nombreDeSaludo && (
        <Box sx={{ mb: 3, textAlign: { xs: 'center', md: 'left' } }}>
          <Typography variant="h5">Bienvenido, {nombreDeSaludo}</Typography>

          {!!codigoMiembro && (
            <Typography variant="subtitle2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              {codigoMiembro}
            </Typography>
          )}
        </Box>
      )}

      <FormHead
        // title="Crea tu contraseña"
        description="Actualmente estás utilizando una contraseña temporal asociada a tu código de miembro. Por seguridad, crea una contraseña personal para continuar."
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
            onBlur={revisarCorreoAlSalir}
            helperText={
              comprobandoCorreo
                ? 'Comprobando que el correo no esté en uso…'
                : 'Te enviaremos un enlace para verificarlo y, una vez confirmado, también podrás utilizarlo para iniciar sesión. Si prefieres omitirlo, podrás seguir accediendo con tu código de miembro.'
            }
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {/* 
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Tu número de miembro no cambia: seguirá sirviendo para entrar.
          </Typography> */}

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
