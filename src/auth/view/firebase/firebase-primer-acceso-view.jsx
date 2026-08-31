'use client';

import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { useRef, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { MEMBER_AUTH_DOMAIN } from 'src/utils/member-auth-credentials';

import { AUTH } from 'src/lib/firebase';
import { CONFIG } from 'src/global-config';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';
import {
  cabecerasConToken,
  revisarEstadoClave,
  cambiarClaveMiembro,
  guardarCorreoDeAcceso,
} from 'src/services/primer-acceso-service';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';
import { SplashScreen } from 'src/components/loading-screen';

import { useAuthContext } from '../../hooks';
import { FormHead } from '../../components/form-head';
import {
  signOut,
  signInWithPassword,
  resendEmailVerification,
} from '../../components/context/firebase';

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
  const { user, loading, authenticated, checkUserSession } = useAuthContext();
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
  // El correo llego a la cuenta: solo entonces tiene sentido pedir que lo
  // verifique, porque el enlace va a la direccion de la cuenta.
  const correoEnLaCuentaRef = useRef(false);
  // Cambio ya hecho en esta visita: a partir de ahi la pantalla se queda para
  // que le de tiempo a leer el aviso del correo, sin que el guardia la eche.
  const [claveCambiada, setClaveCambiada] = useState(false);

  // AQUI MANDA EL TOKEN, NO EL PERFIL.
  //
  // Esta pantalla esperaba a que se resolviera la sesion ENTERA para saber si
  // tocaba pedir la clave. Esa resolucion pasa por el padron, y cuando el padron
  // no contesta el perfil se queda en nada: la sesion existe en Firebase, pero
  // la aplicacion no tiene `user`. La pantalla se quedaba entonces esperando
  // para siempre algo que ya no iba a llegar, diciendo ademas que la contraseña
  // habia quedado guardada cuando todavia no se habia tocado.
  //
  // La marca de "todavia no tiene contraseña propia" es un permiso del token,
  // puesto por el servidor. Se lee de ahi: es la fuente de verdad, no hace falta
  // red, y no depende de que el padron este de buenas. `null` mientras no se ha
  // podido leer, para no decidir nada a ciegas.
  const [marcaDelToken, setMarcaDelToken] = useState(null);

  useEffect(() => {
    let vigente = true;

    const leerMarca = async () => {
      const cuenta = AUTH?.currentUser;

      if (!cuenta) {
        if (vigente) setMarcaDelToken(null);
        return;
      }

      const resultado = await cuenta.getIdTokenResult().catch(() => null);

      if (vigente && resultado) setMarcaDelToken(resultado.claims?.debeCambiarClave === true);
    };

    leerMarca();

    return () => {
      vigente = false;
    };
  }, [loading, authenticated]);

  /** Lo que dice el token; y si aun no se sabe, lo que diga el perfil. */
  const debeCambiarla = marcaDelToken ?? user?.debeCambiarClave === true;

  // Esta pantalla no cuelga de AuthGuard, asi que se vigila sola. Sin sesion no
  // hay nada que cambiar —se va al inicio de sesion— y quien ya eligio su clave
  // no tiene por que volver a verla.
  const puedeMostrarse = debeCambiarla === true || claveCambiada;

  // Solo se pregunta una vez por visita.
  const estadoRevisadoRef = useRef(false);

  // NINGUNA espera es infinita. Esta pantalla esperaba callada a que llegara el
  // perfil, asi que cuando la resolucion de la sesion se atascaba —el padron
  // tardando, por ejemplo— se quedaba girando para siempre y no habia forma de
  // saber si estaba trabajando o rota. Pasado el tope se dice, y se puede
  // reintentar.
  const [esperaLarga, setEsperaLarga] = useState(false);

  useEffect(() => {
    if (!loading && puedeMostrarse) {
      setEsperaLarga(false);
      return undefined;
    }

    const aviso = setTimeout(() => setEsperaLarga(true), 15000);

    return () => clearTimeout(aviso);
  }, [loading, puedeMostrarse]);

  useEffect(() => {
    if (loading || claveCambiada) return;

    // Recien iniciada la sesion hay un instante en que la aplicacion todavia no
    // ha resuelto el perfil. Se pregunta tambien a Firebase, que ya sabe quien
    // acaba de entrar: sin esto, el primer acceso rebotaba al inicio de sesion y
    // solo funcionaba al segundo intento.
    if (!authenticated && !AUTH?.currentUser) {
      router.replace(paths.auth.firebase.signIn);
      return;
    }

    // Sin el token leido y sin perfil no se sabe nada: se espera. Basta con
    // cualquiera de los dos, y el token llega sin pasar por la red.
    if (marcaDelToken === null && !user) return;

    if (debeCambiarla !== true) {
      router.replace(CONFIG.auth.redirectPath);
      return;
    }

    // La marca dice que debe cambiarla, pero pudo cambiarla POR FUERA, con el
    // enlace que Firebase manda al correo. El servidor lo sabe —al cambiarla,
    // Firebase invalida las sesiones anteriores— y retira la marca. Se pregunta
    // aqui, que es donde importa, y no en cada inicio de sesion.
    if (estadoRevisadoRef.current) return;

    estadoRevisadoRef.current = true;

    revisarEstadoClave()
      .then(async (estado) => {
        if (estado?.debeCambiarClave !== false) return;

        await checkUserSession?.();
        router.replace(CONFIG.auth.redirectPath);
      })
      .catch(() => null);
  }, [loading, authenticated, user, marcaDelToken, debeCambiarla, claveCambiada, router, checkUserSession]);

  // El boton "atras" del navegador no puede devolverle al panel —la sesion sigue
  // con la clave publica y el guardia le traeria de vuelta aqui, en bucle—, asi
  // que retroceder sale al inicio de sesion y cierra la sesion.
  //
  // Se anade una entrada propia al historial para poder atrapar ese "atras" sin
  // que se vea de paso la pantalla anterior. Solo cuando la pantalla se queda:
  // hacerlo antes deja al router sin poder redirigir a quien no pinta nada aqui.
  useEffect(() => {
    if (typeof window === 'undefined' || !puedeMostrarse) return undefined;

    window.history.pushState(null, '', window.location.href);

    const alRetroceder = () => {
      // Solo si el "atras" deja al usuario en esta misma pantalla. Durante una
      // navegacion normal el destino es otro y aqui no hay nada que hacer.
      if (!window.location.pathname.startsWith(paths.auth.firebase.primerAcceso)) return;

      window.location.replace(`${paths.auth.firebase.signIn}?forceSignOut=1`);
    };

    window.addEventListener('popstate', alRetroceder);

    return () => window.removeEventListener('popstate', alRetroceder);
  }, [puedeMostrarse]);

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
      // La comparacion la hace el servidor con su propia sesion: traerse el
      // padron entero al navegador para buscar un correo obligaba a dejar
      // `/api/members/` abierta, y de ahi salia todo el directorio.
      const { enUso } = await fetch('/api/auth/correo-disponible/', {
        // No cambia nada: es una consulta. Va por POST para no llevar el correo
        // en la direccion, donde acabaria en los registros del servidor.
        // eslint-disable-next-line no-restricted-syntax
        method: 'POST',
        headers: await cabecerasConToken(),
        body: JSON.stringify({ correo: buscado }),
      }).then((respuesta) => respuesta.json());

      return Boolean(enUso);
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
        aplicar: async () => {
          // La clave la cambia el servidor: es el unico que puede compararla con
          // las anteriores, y asi no hay que pedirle que vuelva a entrar.
          await cambiarClaveMiembro({ clave: datos.claveNueva });

          if (!datos.correo) return;

          // El correo pasa a ser el de la cuenta: desde ese momento sirve para
          // entrar y para recuperar la clave. El numero sigue sirviendo.
          try {
            await guardarCorreoDeAcceso({
              idMiembros: user?.idMiembros ?? null,
              codigoMiembro: codigo || codigoMiembro,
              correo: datos.correo,
            });

            correoEnLaCuentaRef.current = true;
          } catch (errorCorreo) {
            // La clave ya se cambio: el correo no puede tumbar el resto.
            setAvisoCorreo(
              `${errorCorreo.message} Tu contraseña sí se cambió; puedes añadirlo más tarde desde tu perfil.`
            );
          }
        },
      });

      setClaveCambiada(true);

      if (!datos.correo || !correoEnLaCuentaRef.current) {
        // Se vuelve a entrar con la clave que acaba de elegir. Hace falta: al
        // guardarla, el servidor le retira la marca de "todavia no tiene
        // contraseña" y tira las sesiones anteriores —por si alguien habia
        // entrado con la inicial—. El token que quedaba en el navegador es de
        // esos, y con el la aplicacion respondia 403 a todo.
        // Volver a entrar es OBLIGATORIO: al guardar la clave, el servidor tira
        // las sesiones anteriores, y la que tiene el navegador es una de esas.
        // Si esto falla y se sigue adelante, la sesion queda zombi: la clave
        // esta guardada, pero el token ya no vale y nada termina de resolverse
        // —el usuario se queda mirando "Verificando tu acceso" sin que nadie le
        // diga que paso—. Se dice, y se le manda a entrar con su clave nueva.
        const volvioAEntrar = await signInWithPassword({
          email: correoDeAcceso || correoDelMiembro,
          password: datos.claveNueva,
        }).catch((errorEntrada) => {
          console.error('[primer acceso] no se pudo volver a entrar', errorEntrada);

          return null;
        });

        if (!volvioAEntrar) {
          setErrorMessage(
            'Tu contraseña quedó guardada, pero no pudimos volver a abrir tu sesión. Entra de nuevo con tu nueva contraseña.'
          );
          setClaveCambiada(false);
          router.replace(paths.auth.firebase.signIn);
          return;
        }

        await checkUserSession?.();
        router.replace(CONFIG.auth.redirectPath);
        return;
      }

      await checkUserSession?.();

      // Se vuelve a entrar con lo que acaba de elegir: cambiar el correo de la
      // cuenta invalida la sesion anterior, y el enlace de verificacion se pide
      // con la sesion.
      await signInWithPassword({ email: datos.correo, password: datos.claveNueva }).catch(
        () => null
      );

      try {
        // El enlace va SIEMPRE a la direccion de la cuenta. Si no es la que
        // acaba de escribir, saldria hacia el correo interno —que no existe— y
        // el miembro se quedaria esperando un correo que nadie recibio.
        await AUTH?.currentUser?.reload().catch(() => null);

        const correoDeLaCuenta = String(AUTH?.currentUser?.email || '').toLowerCase();

        if (correoDeLaCuenta !== datos.correo.trim().toLowerCase()) {
          throw new Error('Tu cuenta todavía no tiene ese correo.');
        }

        await resendEmailVerification({ destino: paths.auth.firebase.verify });
        router.replace(paths.auth.firebase.verify);
      } catch (errorEnvio) {
        console.error(errorEnvio);
        setAvisoCorreo(
          `${datos.correo} quedó como tu correo, pero no pudimos enviarte el enlace de verificación. Podrás pedirlo más tarde desde tu perfil.`
        );
      }
    } catch (error) {
      // Lo previsto —una clave repetida, un correo ya usado— se le dice al
      // miembro en su propio campo; llevarlo tambien a la consola solo levanta
      // el panel de errores como si algo se hubiera roto.
      if (error?.name !== 'ErrorPrimerAcceso') {
        console.error(error);
      }

      if (error?.repetida) {
        methods.setError('claveNueva', { type: 'manual', message: error.message });
      }

      setErrorMessage(error?.message || 'No pudimos cambiar la contraseña.');
    }
  });

  if (loading || !puedeMostrarse) {
    if (esperaLarga) {
      return (
        <Box sx={{ textAlign: 'center', px: 2 }}>
          <Typography variant="h6">Esto está tardando más de lo normal</Typography>

          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
            {claveCambiada
              ? 'Tu contraseña quedó guardada. Lo que no llega es el resto de tu sesión, casi siempre por una conexión lenta.'
              : 'Tu sesión está abierta, pero no terminamos de traer tu perfil. No se ha cambiado ninguna contraseña.'}
          </Typography>

          <Box sx={{ mt: 3, gap: 1.5, display: 'flex', justifyContent: 'center' }}>
            <Button variant="contained" onClick={() => window.location.reload()}>
              Reintentar
            </Button>

            {/* Nunca sin salida: se cierra la sesion a medias y se entra limpio. */}
            <Button
              variant="outlined"
              onClick={async () => {
                await signOut().catch(() => null);
                window.location.assign(paths.auth.firebase.signIn);
              }}
            >
              Entrar de nuevo
            </Button>
          </Box>
        </Box>
      );
    }

    return (
      <SplashScreen
        portal={false}
        title="Verificando tu acceso"
        description="Estamos preparando tu sesión para llevarte al panel correcto."
      />
    );
  }

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
        description="Por seguridad, crea una contraseña personal para continuar. Será la que uses para entrar de ahora en adelante."
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

          {/* Salir sin crear la contraseña. La sesion no puede quedarse abierta
              —el guardia la devolveria aqui en bucle—, asi que volver cierra la
              sesion, igual que el boton "atras" del navegador. */}
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="always"
            onClick={() => window.location.replace(`${paths.auth.firebase.signIn}?forceSignOut=1`)}
            sx={{ mx: 'auto', color: 'text.secondary' }}
          >
            Volver a inicio de sesión
          </Link>
        </Box>
      </Form>
    </>
  );
}
