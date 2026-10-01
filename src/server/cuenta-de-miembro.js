import 'server-only';

import { randomBytes } from 'crypto';

import { buildDefaultMemberPermissions } from 'src/utils/member-default-permissions';

import { buscarMiembroPorId } from 'src/server/miembros-directorio';
import { getAdminDb, getAdminAuth } from 'src/server/firebase-admin';
import { resolverRolesPorAsignaciones } from 'src/catalogs/directiva-roles';
import { puedeGestionarAMiembro } from 'src/server/alcance-gestion-miembros';
import {
  correoInternoDe,
  normalizarCodigo,
  numeroDeCodigoMiembro,
  CAMPO_BUSQUEDA_NUMERO,
} from 'src/server/claves-miembro';

// ----------------------------------------------------------------------
// LA CUENTA DE ACCESO DE UN MIEMBRO. Una sola pieza para crearla, la use el alta
// del miembro (`/api/auth/crear-cuenta-miembro`) o la pida "Restablecer
// contraseña" cuando falta.
//
// TODO MIEMBRO DEBE TENER CUENTA. Solo se creaba al darlo de alta desde la ficha
// o la importación: el que llegaba al padrón por otro camino (cargado en la API
// .NET, o un alta cuya cuenta falló) se quedaba sin ella, y su coordinador
// chocaba con "Ese miembro todavía no tiene cuenta de acceso" al querer darle
// un código. Ahora, si falta, se crea en ese momento (`crearCuentaSiFalta`).
//
// La contraseña inicial es aleatoria y NO SE DEVUELVE (ver la ruta de alta): se
// entra la primera vez con el código de un solo uso.
// ----------------------------------------------------------------------

const COLECCION = 'usuarios_roles';

// Larga y aleatoria porque nadie la va a teclear: solo tiene que ser imposible
// de adivinar mientras el miembro no elija la suya.
const claveAleatoria = () => randomBytes(32).toString('base64url');

export class CuentaYaExiste extends Error {}

/** Crea la cuenta y su perfil. Lanza `CuentaYaExiste` si el correo interno ya está tomado. */
export async function crearCuentaDeMiembro({
  codigoMiembro,
  firstName,
  lastName,
  destId,
  memberId,
}) {
  const username = normalizarCodigo(codigoMiembro);

  if (!username) throw new Error('No se puede crear la cuenta sin código de miembro.');

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
    if (error?.code === 'auth/email-already-exists') throw new CuentaYaExiste();
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
  const referenciaPerfil = db.collection(COLECCION).doc(String(memberId || username));

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
      referenciaPerfil.set(perfil, { merge: true }),
      // Tambien bajo el uid: es lo que las reglas miran para saber que esta
      // dado de alta (`esUsuarioDelSistema`). Sin este documento, la cuenta
      // nace sin poder leer nada.
      db.collection(COLECCION).doc(cuenta.uid).set(perfil, { merge: true }),
    ]);
  } catch (error) {
    // Una cuenta sin perfil no puede entrar a ningun sitio y ademas bloquea el
    // correo interno para siempre: mejor deshacerla.
    await auth.deleteUser(cuenta.uid).catch((fallo) => {
      console.warn('[cuenta-de-miembro] no se pudo deshacer la cuenta a medias', fallo);
    });

    throw error;
  }

  return { cuenta, referenciaPerfil, correo, username };
}

/**
 * Si el miembro no tiene cuenta, la crea con sus datos DEL PADRÓN (nunca con lo
 * que mande el navegador: el destacamento fija su alcance). Solo si quien lo
 * pide puede gestionar a ese miembro, la misma comprobación que para darle un
 * código. Devuelve `{ cuenta, perfil }` como `buscarAccesoMiembro`, o null.
 */
export async function crearCuentaSiFalta({ solicitante, idMiembros, codigoMiembro }) {
  if (!idMiembros || !solicitante) return null;

  const { permitido } = await puedeGestionarAMiembro({
    solicitante,
    idMiembros,
    uidObjetivo: null,
    resolverRoles: resolverRolesPorAsignaciones,
  });

  if (!permitido) return null;

  const miembro = await buscarMiembroPorId(idMiembros);
  const codigo = String(miembro?.codigoMiembro || '').trim();

  if (!miembro || !codigo) return null;

  // El código que llega tiene que ser el suyo: si no, se le abriría la cuenta a
  // otro número.
  if (codigoMiembro && numeroDeCodigoMiembro(codigoMiembro) !== numeroDeCodigoMiembro(codigo)) {
    return null;
  }

  try {
    const { cuenta, referenciaPerfil } = await crearCuentaDeMiembro({
      codigoMiembro: codigo,
      firstName: miembro.nombres,
      lastName: miembro.apellidos,
      destId: miembro.idDestacamento,
      memberId: miembro.idMiembros ?? idMiembros,
    });

    return { cuenta, perfil: await referenciaPerfil.get() };
  } catch (error) {
    // Otra pestaña la creó a la vez: no hay nada que hacer aquí.
    if (error instanceof CuentaYaExiste) return null;
    throw error;
  }
}
