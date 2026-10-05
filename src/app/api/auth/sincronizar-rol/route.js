import { rolesDeAdministracionDe } from 'src/utils/roles-de-administracion.mjs';

import { verificarTokenDeSesion } from 'src/server/verificar-token';
import { ROLES_QUE_NO_SALEN_DE_UNA_CASILLA } from 'src/catalogs/directiva-roles';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import { ACCIONES_DE_SEGURIDAD, registrarEventoDeSeguridad } from 'src/server/auditoria-seguridad';
import {
  leerAsignacionesDe,
  resolverAccesoPorCargo,
  escribirAccesoPorCargo,
  COLECCION_USUARIOS_ROLES,
} from 'src/server/rol-por-cargo';

import { puedeUsarSelectorDeRol } from 'src/auth/permissions/admin-role-switch-policy';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// EL SERVIDOR SE ENTERA DEL CARGO.
//
// La sesion calcula el rol de cada persona a partir de sus casillas en la
// directiva, pero eso vivia SOLO en el navegador: en Firestore la mayoria de las
// cuentas no tenian `rolId`, y las reglas de Storage —que preguntan por el
// documento `usuarios_roles/<uid>`— no encontraban ni el documento. De ahi que
// un Lider de Grupo viera el boton de subir la foto de un miembro de su
// destacamento y el servidor se la rechazara.
//
// Esta ruta escribe lo que la aplicacion ya sabe, en el sitio donde las reglas
// lo buscan. NO concede nada nuevo: el rol sale de las asignaciones reales de la
// persona, y solo puede sincronizarse a SI MISMA.
//
// Los roles que se asignan a mano —Administrador Global, Funcional y de Tienda—
// no se tocan: los pone una persona y no salen de ninguna casilla.
// ----------------------------------------------------------------------

const jsonError = (message, status) => Response.json({ error: message }, { status });

const getBearerToken = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
};

const normalizarRol = (valor) => String(valor ?? '').trim().toLowerCase();

/**
 * El id de miembro de quien llama.
 *
 * Las cuentas de miembro guardan su documento bajo el id de miembro y no bajo el
 * uid de Firebase, asi que hay que buscarlo por el campo `uid` cuando el token
 * todavia no trae el claim.
 */
const resolverIdMiembros = async (db, caller) => {
  const delToken = caller?.idMiembros ?? caller?.idMiembro;

  if (delToken) return String(delToken);

  const porUid = await db
    .collection(COLECCION_USUARIOS_ROLES)
    .where('uid', '==', caller.uid)
    .limit(1)
    .get()
    .catch(() => null);

  const documento = porUid?.docs?.[0];

  return documento ? String(documento.data()?.idMiembros ?? documento.id) : '';
};

export async function POST(req) {
  if (!isAdminConfigured()) {
    return jsonError('El servidor no tiene configurado FIREBASE_SERVICE_ACCOUNT.', 503);
  }

  const auth = getAdminAuth();
  const db = getAdminDb();
  const token = getBearerToken(req);

  if (!token) return jsonError('Falta el token de autorización.', 401);

  let caller;

  try {
    caller = await verificarTokenDeSesion(token);
  } catch {
    return jsonError('Token inválido o expirado.', 401);
  }

  // INICIO DE SESION. Entrar ocurre en el navegador, directo contra Firebase, y
  // no dejaba nada en ningun registro. La sesion llama aqui al arrancar; si la
  // contraseña (o el codigo) se escribio hace menos de cinco minutos, es un
  // inicio de sesion de verdad y no una recarga. Una vez por sesion.
  const segundosDesdeQueEntro = Date.now() / 1000 - Number(caller.auth_time || 0);

  if (caller.auth_time && segundosDesdeQueEntro < 5 * 60) {
    await registrarEventoDeSeguridad(
      req,
      {
        accion: ACCIONES_DE_SEGURIDAD.sesionIniciada,
        actor: { uid: caller.uid, correo: caller.email, rol: caller.rol },
        detalle: { proveedor: caller.firebase?.sign_in_provider ?? null },
      },
      { unaVezCada: { clave: `sesion:${caller.uid}:${caller.auth_time}`, ms: 6 * 60 * 60 * 1000 } }
    );
  }

  // Una cuenta con Administrador Global elige aquí un rol manual para probar la
  // aplicación. La marca, puesta por switch-own-role tras validar el cargo
  // global activo, evita que la sincronización deshaga la selección al recargar.
  //
  // Pero salir sin escribir NADA la dejaba sin documento en `usuarios_roles/<uid>`
  // cuando el suyo estaba guardado por número de miembro, que es como están la
  // mayoría de las fichas antiguas. Y ese documento es justo el que miran las
  // reglas de Firestore para saber qué cargo tiene: sin él, la cuenta entraba
  // —`esUsuarioDelSistema()` la deja pasar— pero cualquier regla que preguntara
  // por el cargo le respondía "permisos insuficientes" en sus propias pantallas.
  //
  // Se crea el documento SOLO si no existe, y con el cargo que le corresponde por
  // ser esta cuenta. Si ya existe una selección manual marcada, no se toca.
  const asignacionManual = await db.collection(COLECCION_USUARIOS_ROLES).doc(caller.uid).get();
  if (asignacionManual.data()?.selectorRolAdminGlobal === true) {
    return Response.json({ ok: true, omitido: 'rol manual del Administrador Global' });
  }

  if (puedeUsarSelectorDeRol(caller.email)) {
    const suyo = db.collection(COLECCION_USUARIOS_ROLES).doc(caller.uid);
    const existente = await suyo.get();

    if (existente.exists) {
      return Response.json({ ok: true, omitido: 'rol manual del Administrador Global' });
    }

    const ahora = new Date().toISOString();

    await suyo.set(
      {
        uidUsuario: caller.uid,
        uid: caller.uid,
        correo: caller.email || '',
        rolId: 'administrador_global',
        rol: 'administrador',
        activo: true,
        creadoEn: ahora,
        actualizadoEn: ahora,
      },
      { merge: true }
    );

    // Un Administrador Global que nace solo, sin que nadie lo asigne: tiene que
    // quedar constancia, aunque la cuenta este en la lista autorizada.
    await registrarEventoDeSeguridad(req, {
      accion: ACCIONES_DE_SEGURIDAD.administradorGlobalCreado,
      actor: { uid: caller.uid, correo: caller.email },
      objetivo: { uid: caller.uid, correo: caller.email },
      detalle: { origen: 'cuenta_autorizada_sin_documento' },
    });

    return Response.json({ ok: true, rolId: 'administrador_global', creado: true });
  }

  // Solo se sincroniza a si misma: no hay parametro para apuntar a otra persona.
  const referencia = db.collection(COLECCION_USUARIOS_ROLES).doc(caller.uid);
  const actual = await referencia.get();
  const rolActual = normalizarRol(actual.exists ? actual.data()?.rolId : '');

  // Un rol puesto a mano manda sobre cualquier cargo: se conserva. Pero antes se
  // salia de aqui sin escribir NADA, y entonces sus cargos —los permisos y el
  // alcance de su casilla en el destacamento— nunca llegaban al documento que
  // miran las reglas. Ahora se escribe igual, con su rol intacto.
  let rolFijo = ROLES_QUE_NO_SALEN_DE_UNA_CASILLA.includes(rolActual) ? rolActual : '';

  const idMiembros = await resolverIdMiembros(db, caller);

  if (!idMiembros) {
    return Response.json({ ok: true, omitido: 'sin id de miembro', rolId: rolActual });
  }

  // EL ROL A MANO PUEDE ESTAR EN EL PERFIL POR NUMERO DE MIEMBRO. Si se le dio
  // (p. ej. Oficina Nacional) cuando aun no tenia cuenta, solo existia
  // `usuarios_roles/<idMiembros>`; al crearse la cuenta, el documento por uid
  // nacio sin el y esta sincronizacion lo dejaba en su cargo de casilla
  // (EDR-10049 entraba como Coordinador y no como Oficina Nacional). Se rescata
  // de ahi y pasa a mandar, como cualquier rol a mano.
  if (!rolFijo && String(idMiembros) !== String(caller.uid)) {
    const porNumero = await db
      .collection(COLECCION_USUARIOS_ROLES)
      .doc(String(idMiembros))
      .get()
      .catch(() => null);
    const rolDelNumero = normalizarRol(porNumero?.data()?.rolId);

    if (ROLES_QUE_NO_SALEN_DE_UNA_CASILLA.includes(rolDelNumero)) rolFijo = rolDelNumero;
  }

  // Todos sus roles de administracion, de sus dos documentos (por uid y por
  // numero de miembro): sin esto solo sobrevivia uno.
  const porNumeroDeMiembro =
    String(idMiembros) !== String(caller.uid)
      ? await db
          .collection(COLECCION_USUARIOS_ROLES)
          .doc(String(idMiembros))
          .get()
          .catch(() => null)
      : null;
  const rolesAdministracion = [
    ...rolesDeAdministracionDe(actual.exists ? actual.data() : {}),
    ...rolesDeAdministracionDe(porNumeroDeMiembro?.data?.() ?? {}),
  ];

  const acceso = resolverAccesoPorCargo(await leerAsignacionesDe(db, idMiembros), {
    rolFijo,
    rolesAdministracion,
  });
  await escribirAccesoPorCargo({ db, auth, uid: caller.uid, idMiembros, acceso });

  // Su cargo cambio por lo que dice la directiva: de cual a cual.
  if (rolActual !== normalizarRol(acceso.rolId)) {
    await registrarEventoDeSeguridad(req, {
      accion: ACCIONES_DE_SEGURIDAD.rolSincronizado,
      actor: { uid: caller.uid, idMiembros },
      objetivo: { uid: caller.uid, idMiembros },
      detalle: { de: rolActual || null, a: acceso.rolId, cargos: acceso.cargos.length },
    });
  }

  return Response.json({ ok: true, rolId: acceso.rolId, cargos: acceso.cargos.length });
}
