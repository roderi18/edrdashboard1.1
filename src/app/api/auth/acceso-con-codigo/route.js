import 'server-only';

import { limiteSuperado } from 'src/server/limite-intentos';
import { COLECCIONES } from 'src/config/esquema-firestore.mjs';
import { leerSecretos, registrarFalloDeCodigo } from 'src/server/secretos-acceso';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import {
  codigoVigente,
  codigoCoincide,
  codigoBloqueado,
  numeroDeCodigoMiembro,
  INTENTOS_CODIGO_UN_USO,
  marcarDebeCambiarClave,
  BLOQUEO_CODIGO_UN_USO_MS,
  buscarPerfilesPorNumeroMiembro,
} from 'src/server/claves-miembro';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// Entrar con el codigo que dio el Coordinador.
//
// El miembro no va a ninguna pantalla especial: escribe su numero y, donde va la
// contraseña, el codigo. El inicio de sesion prueba primero su contraseña de
// siempre —que sigue siendo valida— y solo si falla pregunta aqui.
//
// Lo que se devuelve no es una sesion cualquiera: viene con `debeCambiarClave`
// puesto, asi que el guardia le lleva a "Crea tu contraseña" y no le deja pasar
// de ahi. El codigo muere cuando guarda la nueva (lo hace `/api/auth/clave-
// miembro`) o cuando vence, al dia.
// ----------------------------------------------------------------------

const COLECCION = COLECCIONES.usuariosRoles;

// El mismo mensaje para "no existe", "vencio" y "no es": distinguirlos serviria
// sobre todo para adivinar a base de probar.
const NO_VALE = 'Ese código no es válido o ya venció. Pídele otro a tu Coordinador.';

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json({ error: 'El servidor no puede validar códigos ahora mismo.' }, { status: 503 });
    }

    const { numeroUsuario, codigo } = await req.json();

    if (!numeroDeCodigoMiembro(numeroUsuario) || !codigo) {
      return Response.json({ error: NO_VALE }, { status: 400 });
    }

    // Dos limites, porque hay dos abusos distintos. Por IP, contra quien recorre
    // numeros probando codigos. Por numero, porque cinco fallos AGOTAN el codigo
    // del miembro: sin esto, un desconocido puede tumbar de una tacada todas las
    // recuperaciones en curso, incluidas las ya dictadas por telefono.
    const frenado =
      limiteSuperado(req, { grupo: 'codigo-ip', maximo: 10, ventanaMs: 60 * 1000 }) ??
      limiteSuperado(req, {
        grupo: 'codigo-miembro',
        identificador: numeroDeCodigoMiembro(numeroUsuario),
        porOrigen: false,
        maximo: 6,
        ventanaMs: 60 * 60 * 1000,
      });

    if (frenado) return frenado;

    const documentos = await buscarPerfilesPorNumeroMiembro(numeroUsuario);
    // El codigo ya no vive en el perfil sino en `secretos_acceso`, que el
    // cliente no puede leer. Cada candidato viaja con el suyo al lado.
    const candidatos = await Promise.all(
      documentos.map(async (documento) => ({
        documento,
        registro: (await leerSecretos(documento.id, documento)).codigoRestablecimiento,
      }))
    );
    // Un codigo congelado por fallos se trata como si no hubiera: misma respuesta, y
    // sin contar nada mas (quien tantea no gana intentos ni informacion).
    const pendientes = candidatos.filter(
      ({ registro }) => codigoVigente(registro) && !codigoBloqueado(registro)
    );

    if (!pendientes.length) {
      return Response.json({ error: NO_VALE }, { status: 400 });
    }

    const acertado = pendientes.find(({ registro }) => codigoCoincide(codigo, registro));

    if (!acertado) {
      // Fallar cuesta: tras unos cuantos intentos el codigo se congela un rato.
      // Cada fallo se cuenta en una transaccion (atomico, y compartido entre
      // instancias): contarlo con leer-sumar-escribir lo dejaba esquivar con
      // peticiones en paralelo.
      await Promise.all(
        pendientes.map(({ documento, registro }) =>
          registrarFalloDeCodigo(documento.id, {
            registroDeRespaldo: registro,
            maximo: INTENTOS_CODIGO_UN_USO,
            bloqueoMs: BLOQUEO_CODIGO_UN_USO_MS,
          })
        )
      );

      return Response.json({ error: NO_VALE }, { status: 400 });
    }

    const { documento } = acertado;
    const { uid } = acertado.registro;

    if (!uid) return Response.json({ error: NO_VALE }, { status: 400 });

    const marca = {
      debeCambiarClave: true,
      // Cuando se le puso la marca. `/api/auth/estado-clave` compara esta fecha
      // con la del ultimo cambio de contraseña para saber si ya eligio una: sin
      // refrescarla, a quien cambio la suya alguna vez le habria retirado la
      // marca y le habria dejado entrar al panel sin crear ninguna.
      claveTemporalEn: new Date().toISOString(),
    };

    // A los dos documentos que puede tener el miembro: la sesion lee el que va
    // por uid, y el codigo suele vivir en el que va por su id de miembro.
    //
    // El de uid solo si YA existe: crearlo aqui dejaria un documento con la
    // marca y nada mas, y la sesion —que lo prefiere— entraria sin rol ni
    // codigo de miembro.
    const porUid = await getAdminDb().collection(COLECCION).doc(String(uid)).get();

    await Promise.all([
      documento.ref.set(marca, { merge: true }),
      ...(porUid.exists && porUid.id !== documento.id
        ? [porUid.ref.set(marca, { merge: true })]
        : []),
    ]);

    // La marca tambien en los claims: con ella el servidor le niega todo lo que
    // no sea elegir su contraseña. En el navegador sola no bastaba —el guarda es
    // de pantalla— y con este token se llegaba a cualquier ruta de la API.
    await marcarDebeCambiarClave(uid, true);

    // Un token de un solo uso para abrir la sesion en el navegador. Caduca en
    // una hora y no lleva permisos por si mismo: los saca del perfil, como
    // cualquier otra sesion de ese miembro.
    const token = await getAdminAuth().createCustomToken(String(uid));

    return Response.json({ token });
  } catch (error) {
    console.error('[acceso-con-codigo] no se pudo validar el código', error);

    return Response.json({ error: 'No pudimos validar el código.' }, { status: 500 });
  }
}
