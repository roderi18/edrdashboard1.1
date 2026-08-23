import 'server-only';

import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import {
  codigoVigente,
  codigoCoincide,
  numeroDeCodigoMiembro,
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
// miembro`) o cuando vence, a la hora.
// ----------------------------------------------------------------------

const COLECCION = 'usuarios_roles';

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

    const documentos = await buscarPerfilesPorNumeroMiembro(numeroUsuario);
    const pendientes = documentos.filter((documento) =>
      codigoVigente(documento.data()?.codigoRestablecimiento)
    );

    if (!pendientes.length) {
      return Response.json({ error: NO_VALE }, { status: 400 });
    }

    const documento = pendientes.find((candidato) =>
      codigoCoincide(codigo, candidato.data().codigoRestablecimiento)
    );

    if (!documento) {
      // Fallar cuesta: el codigo se agota tras unos cuantos intentos.
      await Promise.all(
        pendientes.map((candidato) =>
          candidato.ref.set(
            {
              codigoRestablecimiento: {
                ...candidato.data().codigoRestablecimiento,
                intentos: Number(candidato.data().codigoRestablecimiento?.intentos || 0) + 1,
              },
            },
            { merge: true }
          )
        )
      );

      return Response.json({ error: NO_VALE }, { status: 400 });
    }

    const { uid } = documento.data().codigoRestablecimiento;

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
