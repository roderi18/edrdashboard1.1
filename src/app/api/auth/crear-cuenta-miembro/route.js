import 'server-only';

import { randomBytes } from 'crypto';

import { buildDefaultMemberPermissions } from 'src/utils/member-default-permissions';

import { limiteSuperado } from 'src/server/limite-intentos';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import {
  correoInternoDe,
  normalizarCodigo,
  numeroDeCodigoMiembro,
  CAMPO_BUSQUEDA_NUMERO,
  identificarSolicitante,
} from 'src/server/claves-miembro';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// La cuenta de acceso de un miembro nuevo.
//
// ANTES la creaba el navegador y la contraseña inicial era el codigo del miembro
// en mayusculas (`EDR-10002`). Como los codigos son correlativos, cualquiera
// podia recorrer `EDR-10001`, `EDR-10002`... y entrar como todo el que aun no
// hubiera cambiado la suya. Y una vez dentro no estaba encerrado en "Crea tu
// contraseña" —ese guarda es de navegador—: podia fijar el la definitiva y
// dejar fuera al miembro de verdad.
//
// Ahora la contraseña inicial es aleatoria y NO SE DEVUELVE: no la ve ni quien
// crea al miembro. Para entrar la primera vez, su coordinador le genera un
// codigo de un solo uso desde su ficha, igual que para cualquier recuperacion.
// ----------------------------------------------------------------------

const COLECCION = 'usuarios_roles';

// Larga y aleatoria porque nadie la va a teclear: solo tiene que ser imposible
// de adivinar mientras el miembro no elija la suya.
const claveAleatoria = () => randomBytes(32).toString('base64url');

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json(
        { error: 'El servidor no puede crear cuentas ahora mismo.' },
        { status: 503 }
      );
    }

    const frenado = limiteSuperado(req, {
      grupo: 'crear-cuenta',
      maximo: 60,
      ventanaMs: 60 * 1000,
    });

    if (frenado) return frenado;

    const solicitante = await identificarSolicitante(req);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e inténtalo de nuevo.' }, { status: 401 });
    }

    if (!solicitante.puedeCrearMiembros) {
      return Response.json({ error: 'Tu rol no puede crear cuentas de acceso.' }, { status: 403 });
    }

    const { codigoMiembro, firstName, lastName, destId, memberId } = await req.json();
    const username = normalizarCodigo(codigoMiembro);

    if (!username) {
      return Response.json(
        { error: 'No se puede crear la cuenta sin código de miembro.' },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();
    const db = getAdminDb();
    const correo = correoInternoDe(username);
    const displayName = `${firstName || ''} ${lastName || ''}`.trim() || codigoMiembro;

    let cuenta;

    try {
      cuenta = await auth.createUser({
        email: correo,
        emailVerified: false,
        password: claveAleatoria(),
        displayName,
      });
    } catch (error) {
      if (error?.code === 'auth/email-already-exists') {
        return Response.json(
          { error: 'Ese miembro ya tiene cuenta de acceso.', yaExistia: true },
          { status: 409 }
        );
      }

      throw error;
    }

    // La marca viaja en el token, no solo en Firestore: asi el SERVIDOR puede
    // negarle todo lo que no sea elegir su contraseña. Cuando la elige,
    // `/api/auth/clave-miembro` la retira.
    await auth.setCustomUserClaims(cuenta.uid, { debeCambiarClave: true });

    const creadoEn = new Date().toISOString();
    const perfil = {
      idMiembros: memberId ? Number(memberId) : null,
      codigoMiembro,
      uid: cuenta.uid,
      correo,
      nombre: displayName,
      rol: 'miembro',
      estado: 'activo',
      debeCambiarClave: true,
      // Por donde se le encuentra cuando escribe solo su numero para entrar.
      [CAMPO_BUSQUEDA_NUMERO]: numeroDeCodigoMiembro(codigoMiembro),
      alcance: {
        modo: 'destacamento',
        destacamentos: destId ? [Number(destId)] : [],
        regiones: [],
        secciones: [],
      },
      permisos: buildDefaultMemberPermissions(),
      creadoEn,
      actualizadoEn: creadoEn,
    };

    try {
      await Promise.all([
        db.collection('users').doc(cuenta.uid).set(
          {
            uid: cuenta.uid,
            email: correo,
            username,
            codigoMiembro,
            displayName,
            firstName: firstName || '',
            lastName: lastName || '',
            idMiembros: memberId ? Number(memberId) : null,
            idDestacamento: destId ? Number(destId) : null,
            authMode: 'member-code',
            createdAt: creadoEn,
          },
          { merge: true }
        ),
        db.collection(COLECCION).doc(String(memberId || username)).set(perfil, { merge: true }),
        // Tambien bajo el uid: es lo que las reglas miran para saber que esta
        // dado de alta (`esUsuarioDelSistema`). Sin este documento, la cuenta
        // nace sin poder leer nada.
        db.collection(COLECCION).doc(cuenta.uid).set(perfil, { merge: true }),
      ]);
    } catch (error) {
      // Una cuenta sin perfil no puede entrar a ningun sitio y ademas bloquea el
      // correo interno para siempre: mejor deshacerla.
      await auth.deleteUser(cuenta.uid).catch((fallo) => {
        console.warn('[crear-cuenta-miembro] no se pudo deshacer la cuenta a medias', fallo);
      });

      throw error;
    }

    // La contraseña NO sale de aqui, a proposito.
    return Response.json({ uid: cuenta.uid, emailFake: correo, username });
  } catch (error) {
    console.error('[crear-cuenta-miembro] no se pudo crear', error);

    return Response.json({ error: 'No pudimos crear la cuenta de acceso.' }, { status: 500 });
  }
}
