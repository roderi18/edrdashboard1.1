import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

import { ROLES } from 'src/auth/permissions/roles';
import { deriveUserClaims } from 'src/auth/permissions/user-claims';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// REPARTIR LOS CARGOS DE ADMINISTRACION DE LA PLATAFORMA.
//
// Va en el SERVIDOR y no en el navegador por dos razones:
//
//   1. `usuarios_roles` es `allow write: if false` en firestore.rules —lo es a
//      proposito, porque antes cualquiera podia reescribir el suyo y concederse el
//      rol—. La pantalla de administradores guardaba con `setDoc` desde el
//      cliente, asi que la escritura moria en las reglas: se guardaba en pantalla
//      y no se guardaba en ningun sitio.
//   2. Las tres reglas de abajo tienen que decidirse donde no se puedan saltar.
//      Dar el rol de administrador global es la llave de todo; comprobarlo solo en
//      el navegador no es comprobarlo.
//
// Las reglas:
//
//   - Solo el Administrador Global reparte. Ni el Funcional ni la Oficina
//     Nacional, que entran a esta pantalla pero no nombran a quien manda.
//   - Solo se reparten los CUATRO cargos de administracion. Los organizacionales
//     se ponen en la ficha del miembro y en las directivas, donde se ve sobre que
//     entidad se ponen.
//   - NUNCA se queda la organizacion sin Administrador Global. Es la unica cuenta
//     que puede volver a repartir cargos: si se va la ultima, no queda nadie que
//     pueda nombrar a la siguiente y la plataforma se cierra por dentro.
// ----------------------------------------------------------------------

const COLECCION_USUARIOS_ROLES = 'usuarios_roles';

// Los mismos cuatro de `src/utils/admin-role-label.js`. Se repiten aqui —y no se
// importan de un modulo de cliente— para que la regla del servidor no dependa de
// codigo de navegador; el test compara las dos listas para que no se separen.
const ROLES_DE_ADMINISTRACION = [
  ROLES.ADMINISTRADOR_GLOBAL,
  ROLES.ADMINISTRADOR_FUNCIONAL,
  ROLES.ADMINISTRADOR_TIENDA,
  ROLES.OFICINA_NACIONAL,
];

// QUITAR el cargo es el mismo cambio que darlo, con `usuario_comun` de destino, y
// por eso entra por esta misma puerta: asi la regla de no quedarse sin
// Administrador Global se comprueba una sola vez y en un solo sitio. Si "quitar
// administrador" tuviera su propio camino, seria el camino por el que se escaparia.
const DESTINOS_VALIDOS = [...ROLES_DE_ADMINISTRACION, ROLES.USUARIO_COMUN];

const jsonError = (message, status) => Response.json({ error: message }, { status });

const getBearerToken = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
};

const normalizar = (valor) =>
  String(valor ?? '')
    .trim()
    .toLowerCase();

const leerAsignacion = async (db, docId) => {
  if (!docId) return null;

  const snap = await db.collection(COLECCION_USUARIOS_ROLES).doc(String(docId)).get();

  return snap.exists ? snap.data() : null;
};

/**
 * ¿Cuantos Administradores Globales quedarian sin contar a este?
 *
 * Se cuenta por el campo `rolId`, que es el del catalogo. El valor heredado
 * (`rol: 'administrador'`) NO cuenta aqui a proposito: si contara, una cuenta
 * antigua sin `rolId` daria via libre para quitarle el cargo al ultimo
 * administrador de verdad.
 */
const otrosAdministradoresGlobales = async (db, docIdExcluido) => {
  const snap = await db
    .collection(COLECCION_USUARIOS_ROLES)
    .where('rolId', '==', ROLES.ADMINISTRADOR_GLOBAL)
    .get();

  return snap.docs.filter((documento) => String(documento.id) !== String(docIdExcluido)).length;
};

export async function POST(req) {
  if (!isAdminConfigured()) {
    return jsonError('El servidor no tiene configurado FIREBASE_SERVICE_ACCOUNT.', 503);
  }

  const auth = getAdminAuth();
  const db = getAdminDb();

  // 1) Quien llama.
  const token = getBearerToken(req);

  if (!token) return jsonError('Falta el token de autorización.', 401);

  let quienLlama;

  try {
    quienLlama = await auth.verifyIdToken(token);
  } catch {
    return jsonError('Token inválido o expirado.', 401);
  }

  // 2) Solo el Administrador Global. Se acepta el claim o su documento, igual que
  //    en `set-user-claims`: los claims se emiten al guardar el rol, asi que la
  //    primera cuenta no tendria ninguno y se quedaria fuera de su propia llave.
  const suAsignacion = await leerAsignacion(db, quienLlama.uid);
  const suRol = normalizar(quienLlama.rol || suAsignacion?.rolId || '');

  if (suRol !== ROLES.ADMINISTRADOR_GLOBAL) {
    return jsonError('Solo el Administrador Global reparte cargos de administración.', 403);
  }

  let cuerpo;

  try {
    cuerpo = await req.json();
  } catch {
    return jsonError('Cuerpo inválido.', 400);
  }

  const {
    uidUsuario,
    correo = '',
    nombre = '',
    rolId,
    rolNombre = '',
    alcance = {},
    restricciones = {},
    cargos = null,
  } = cuerpo || {};

  if (!uidUsuario) return jsonError('Se requiere uidUsuario del objetivo.', 400);

  const cargoNuevo = normalizar(rolId);

  // 3) Solo los cuatro, o quitarlo.
  if (!DESTINOS_VALIDOS.includes(cargoNuevo)) {
    return jsonError(
      'Desde Administradores solo se asignan los cargos de administración de la plataforma.',
      422
    );
  }

  // 4) Que no se quede en cero.
  const asignacionActual = await leerAsignacion(db, uidUsuario);
  const cargoActual = normalizar(asignacionActual?.rolId);

  if (cargoActual === ROLES.ADMINISTRADOR_GLOBAL && cargoNuevo !== ROLES.ADMINISTRADOR_GLOBAL) {
    const quedan = await otrosAdministradoresGlobales(db, uidUsuario);

    if (quedan === 0) {
      return jsonError(
        'Es el único Administrador Global: nombra a otro antes de cambiarle el cargo. Sin ninguno, nadie podría volver a repartir cargos.',
        409
      );
    }
  }

  // 5) Escribir.
  const ahora = new Date().toISOString();
  const payload = {
    uidUsuario: String(uidUsuario),
    correo,
    nombre,
    rolId: cargoNuevo,
    rolNombre,
    alcance,
    restricciones,
    ...(Array.isArray(cargos) ? { cargos } : {}),
    activo: true,
    // El campo heredado se alinea con el cargo: varias pantallas y las propias
    // reglas caen a `rol` cuando no hay claim, y dejarlo desalineado hacia que la
    // persona apareciera con un cargo en un sitio y otro en el de al lado.
    rol: cargoNuevo === ROLES.ADMINISTRADOR_GLOBAL ? 'administrador' : cargoNuevo,
    asignadoPor: quienLlama.uid || quienLlama.email || 'sistema',
    asignadoEn: ahora,
    actualizadoEn: ahora,
  };

  await db
    .collection(COLECCION_USUARIOS_ROLES)
    .doc(String(uidUsuario))
    .set(payload, { merge: true });

  // 6) Los claims, para que la sesion del objetivo refleje el cargo nuevo. Si
  //    falla, la asignacion ya esta guardada: se sincroniza al volver a entrar.
  let claims = null;

  try {
    const authUid = await auth
      .getUser(String(uidUsuario))
      .then((registro) => registro.uid)
      .catch(async () => {
        if (!correo) return '';

        return auth
          .getUserByEmail(correo)
          .then((registro) => registro.uid)
          .catch(() => '');
      });

    if (authUid) {
      claims = deriveUserClaims({
        rolId: cargoNuevo,
        alcance,
        idMiembros: asignacionActual?.idMiembros ?? asignacionActual?.memberId,
      });

      await auth.setCustomUserClaims(authUid, claims);
    }
  } catch (error) {
    console.warn('[asignar-rol-administracion] no se pudieron emitir los claims', error);
  }

  return Response.json({ ok: true, asignacion: payload, claims });
}
