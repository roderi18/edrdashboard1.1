import 'server-only';

import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import {
  claveYaUsada,
  CLAVES_RECORDADAS,
  buscarPerfilMiembro,
  registrarHuellaClave,
  identificarSolicitante,
} from 'src/server/claves-miembro';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// El miembro elige su propia clave.
//
// Se hace en el servidor por dos razones: aqui se puede comprobar contra las
// huellas de sus claves anteriores —que solo el Admin SDK puede leer y
// escribir—, y no hace falta pedirle que vuelva a entrar, como exige Firebase
// para cambiar la clave desde el navegador.
// ----------------------------------------------------------------------

const MINIMO = 6;

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json({ error: 'El servidor no puede cambiar claves ahora mismo.' }, { status: 503 });
    }

    const solicitante = await identificarSolicitante(req);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e intentalo de nuevo.' }, { status: 401 });
    }

    const { clave } = await req.json();
    const claveNueva = String(clave ?? '');

    if (claveNueva.length < MINIMO) {
      return Response.json(
        { error: `La contraseña debe tener al menos ${MINIMO} caracteres.` },
        { status: 400 }
      );
    }

    // Solo la suya: el uid sale del token, no de lo que mande el navegador. No
    // hace falta traer la cuenta para eso —el token ya la identifica—, y pedirla
    // era un viaje entero a Firebase antes de poder hacer nada.
    const perfil = await buscarPerfilMiembro({
      idMiembros: solicitante.idMiembros,
      uid: solicitante.uid,
    });
    const datos = perfil?.data() ?? {};

    if (claveYaUsada(claveNueva, datos.clavesAnteriores)) {
      return Response.json(
        {
          error: `Esa contraseña ya la usaste antes. Elige una distinta de tus últimas ${CLAVES_RECORDADAS}.`,
          repetida: true,
        },
        { status: 409 }
      );
    }

    await getAdminAuth().updateUser(solicitante.uid, { password: claveNueva });

    // Ya tiene contraseña suya: se retira la marca y se tira el codigo del
    // Coordinador, que existia solo para llegar hasta aqui.
    const cierre = {
      debeCambiarClave: false,
      claveCambiadaEn: new Date().toISOString(),
      claveTemporal: false,
      codigoRestablecimiento: null,
    };

    await registrarHuellaClave({
      idMiembros: solicitante.idMiembros,
      uid: solicitante.uid,
      clave: claveNueva,
      extra: cierre,
    });

    // Tambien en el documento que va por uid: es el que lee la sesion, y si se
    // queda con la marca puesta le devuelve a "Crea tu contraseña" en bucle.
    // Solo si ya existe: uno creado aqui, con el cierre y nada mas, dejaria a la
    // sesion sin rol ni codigo de miembro.
    const porUid = await getAdminDb()
      .collection('usuarios_roles')
      .doc(String(solicitante.uid))
      .get();

    if (porUid.exists) {
      await porUid.ref.set(cierre, { merge: true });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[clave-miembro] no se pudo cambiar la clave', error);

    return Response.json({ error: 'No pudimos cambiar la contraseña.' }, { status: 500 });
  }
}

// El navegador pregunta antes de enviar, para avisar en el propio campo.
export async function PUT(req) {
  try {
    if (!isAdminConfigured()) return Response.json({ repetida: false });

    const solicitante = await identificarSolicitante(req);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e intentalo de nuevo.' }, { status: 401 });
    }

    const { clave } = await req.json();
    const perfil = await buscarPerfilMiembro({
      idMiembros: solicitante.idMiembros,
      uid: solicitante.uid,
    });

    return Response.json({
      repetida: claveYaUsada(String(clave ?? ''), perfil?.data()?.clavesAnteriores),
    });
  } catch (error) {
    console.error('[clave-miembro] no se pudo comprobar la clave', error);

    return Response.json({ repetida: false });
  }
}

export async function GET() {
  return Response.json({ clavesRecordadas: CLAVES_RECORDADAS });
}
