import { listaDeRolesQueEjerce } from 'src/utils/lista-roles-que-ejerce.mjs';
import {
  conRolDeAdministracion,
  sinRolDeAdministracion,
  rolesDeAdministracionDe,
  rolPrincipalDeAdministracion,
} from 'src/utils/roles-de-administracion.mjs';

import { COLECCIONES } from 'src/config/esquema-firestore.mjs';
import { verificarTokenDeSesion } from 'src/server/verificar-token';
import { resolverCuentasDelObjetivo } from 'src/server/cuenta-del-objetivo.mjs';
import { fijarClaimsConservandoClave } from 'src/server/claims-con-marca-de-clave';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import { ACCIONES_DE_SEGURIDAD, registrarEventoDeSeguridad } from 'src/server/auditoria-seguridad';

import { deriveUserClaims } from 'src/auth/permissions/user-claims';
import { ROLES, ROLES_POR_CODIGO } from 'src/auth/permissions/roles';

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

const COLECCION_USUARIOS_ROLES = COLECCIONES.usuariosRoles;

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
const otrosAdministradoresGlobales = async (db, docIdsExcluidos = []) => {
  const excluidos = new Set([docIdsExcluidos].flat().map(String));
  const snap = await db
    .collection(COLECCION_USUARIOS_ROLES)
    .where('rolId', '==', ROLES.ADMINISTRADOR_GLOBAL)
    .get();

  return snap.docs.filter((documento) => !excluidos.has(String(documento.id))).length;
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
    // Con revocacion: una sesion cerrada no reparte cargos.
    quienLlama = await verificarTokenDeSesion(token);
  } catch {
    return jsonError('Token inválido o expirado.', 401);
  }

  if (quienLlama.debeCambiarClave === true) {
    return jsonError('Crea tu contraseña antes de continuar.', 403);
  }

  // 2) Solo el Administrador Global. Se acepta el claim o su documento, igual que
  //    en `set-user-claims`: los claims se emiten al guardar el rol, asi que la
  //    primera cuenta no tendria ninguno y se quedaria fuera de su propia llave.
  const suAsignacion = await leerAsignacion(db, quienLlama.uid);
  // EL PERFIL MANDA, NO EL CLAIM: los claims se quedan en la cuenta hasta que
  // alguien los reescribe, y a un Administrador Global degradado le seguian
  // dejando repartir cargos. Mismo orden que `set-user-claims` y `requireRole`.
  const suRol = normalizar(suAsignacion?.rolId || quienLlama.rol || '');

  if (suRol !== ROLES.ADMINISTRADOR_GLOBAL) {
    await registrarEventoDeSeguridad(req, {
      accion: ACCIONES_DE_SEGURIDAD.rolAdministracionDenegado,
      resultado: 'denegado',
      actor: { uid: quienLlama.uid, rol: suRol },
      detalle: { motivo: 'no_es_administrador_global' },
    });

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
    // 'agregar' suma el rol a los que ya tiene; 'quitar' quita SOLO ese. Sin
    // accion, el comportamiento de antes (reemplazar; `usuario_comun` = quitar
    // todos), para los llamadores antiguos.
    accion = '',
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

  // 4) LA CUENTA DE VERDAD. La pantalla puede mandar el numero de miembro en vez
  //    del uid de Firebase; el cargo tiene que acabar en el documento que leen la
  //    sesion, las reglas y la sincronizacion. Ver `cuenta-del-objetivo.mjs`.
  const cuentas = await resolverCuentasDelObjetivo({
    idObjetivo: uidUsuario,
    correo,
    obtenerUsuario: (uid) => auth.getUser(uid),
    obtenerPorCorreo: (valor) => auth.getUserByEmail(valor),
    leerRol: (id) => leerAsignacion(db, id),
    buscarPerfiles: async (campo, valor) =>
      (
        await Promise.all(
          [COLECCION_USUARIOS_ROLES, 'users'].map((coleccion) =>
            db.collection(coleccion).where(campo, '==', valor).limit(10).get()
          )
        )
      ).flatMap((consulta) => consulta.docs.map((doc) => ({ id: doc.id, data: doc.data() }))),
  });
  // Donde se escribe: cada cuenta de Firebase de la persona y, ademas, el
  // documento que mando la pantalla, para que la lista de Administradores siga
  // enseñando lo mismo que tiene de verdad.
  const documentos = [...new Set([...cuentas.uids, String(uidUsuario)])];
  const asignaciones = new Map(
    await Promise.all(documentos.map(async (id) => [id, await leerAsignacion(db, id)]))
  );

  // VARIOS ROLES DE ADMINISTRACION (`roles-de-administracion.mjs`). Los que ya
  // tiene, sumando todos sus documentos, y como quedan tras el cambio. Antes el
  // nuevo REEMPLAZABA al anterior: dar Tienda a la Oficina Nacional le quitaba
  // la Oficina.
  const rolesPrevios = [...asignaciones.values()].reduce(
    (lista, asignacion) => [...lista, ...rolesDeAdministracionDe(asignacion ?? {})],
    []
  );
  const accionNormalizada = normalizar(accion);

  if (['agregar', 'quitar'].includes(accionNormalizada) && cargoNuevo === ROLES.USUARIO_COMUN) {
    return jsonError('Elige qué rol de administración se añade o se quita.', 422);
  }

  const rolesNuevos =
    accionNormalizada === 'agregar'
      ? conRolDeAdministracion(rolesPrevios, cargoNuevo)
      : accionNormalizada === 'quitar'
        ? sinRolDeAdministracion(rolesPrevios, cargoNuevo)
        : cargoNuevo === ROLES.USUARIO_COMUN
          ? []
          : [cargoNuevo];
  const principalDeAdministracion = rolPrincipalDeAdministracion(rolesNuevos);

  // 5) Que no se quede en cero. Se mira en todos sus documentos: basta con que
  //    uno la tenga como Administradora Global.
  const eraAdministradorGlobal = [...asignaciones.values()].some(
    (asignacion) =>
      normalizar(asignacion?.rolId) === ROLES.ADMINISTRADOR_GLOBAL ||
      rolesDeAdministracionDe(asignacion ?? {}).includes(ROLES.ADMINISTRADOR_GLOBAL)
  );

  if (eraAdministradorGlobal && !rolesNuevos.includes(ROLES.ADMINISTRADOR_GLOBAL)) {
    const quedan = await otrosAdministradoresGlobales(db, documentos);

    if (quedan === 0) {
      await registrarEventoDeSeguridad(req, {
        accion: ACCIONES_DE_SEGURIDAD.rolAdministracionDenegado,
        resultado: 'denegado',
        actor: { uid: quienLlama.uid, rol: suRol },
        objetivo: { uid: cuentas.uids[0] || uidUsuario, idMiembros: cuentas.idMiembros },
        detalle: { motivo: 'ultimo_administrador_global', rolPedido: cargoNuevo },
      });

      return jsonError(
        'Es el único Administrador Global: nombra a otro antes de cambiarle el cargo. Sin ninguno, nadie podría volver a repartir cargos.',
        409
      );
    }
  }

  // 6) Escribir, documento por documento: cada uno conserva SUS cargos de la
  //    directiva. El cargo de administracion se suma a ellos, no los borra.
  const ahora = new Date().toISOString();
  let payload = null;

  await Promise.all(
    documentos.map(async (id) => {
      const actual = asignaciones.get(id) ?? {};
      const susCargos = Array.isArray(cargos) ? cargos : (actual.cargos ?? []);
      // QUITAR el cargo de administracion no deja a nadie en Usuario Comun si
      // ocupa casillas de la directiva: vuelve a mandar su primer cargo, igual que
      // hara la sincronizacion en su proximo acceso.
      // Manda el rol de administracion de mas rango; sin ninguno, su primer
      // cargo de la directiva, y si tampoco, Usuario Comun.
      const rolQueQueda =
        principalDeAdministracion ||
        normalizar(susCargos[0]?.rol ?? susCargos[0]?.rolId) ||
        ROLES.USUARIO_COMUN;
      const esCuentaDeMiembro = normalizar(actual.rol) === 'miembro';
      const datos = {
        uidUsuario: cuentas.uids[0] || String(uidUsuario),
        ...(correo && { correo }),
        ...(nombre && { nombre }),
        ...(cuentas.idMiembros && !actual.idMiembros && { idMiembros: cuentas.idMiembros }),
        ...(cuentas.codigoMiembro && !actual.codigoMiembro && { codigoMiembro: cuentas.codigoMiembro }),
        rolId: rolQueQueda,
        rolNombre: ROLES_POR_CODIGO[rolQueQueda]?.nombre || rolNombre,
        // Todos sus roles de administracion, no solo el principal.
        rolesAdministracion: rolesNuevos,
        alcance,
        restricciones,
        ...(Array.isArray(cargos) ? { cargos } : {}),
        // La lista plana que leen las reglas —el cargo de administracion mas los
        // que ya tuviera, en cualquier posicion—: sin ella, en Firestore solo
        // contaba el principal. Ver `lista-roles-que-ejerce.mjs`.
        rolesQueEjerce: listaDeRolesQueEjerce({
          rolId: rolQueQueda,
          cargos: susCargos,
          rolesAdministracion: rolesNuevos,
        }),
        activo: true,
        // El campo heredado se alinea con el cargo: varias pantallas y las propias
        // reglas caen a `rol` cuando no hay claim, y dejarlo desalineado hacia que
        // la persona apareciera con un cargo en un sitio y otro en el de al lado.
        // Salvo la marca 'miembro' de una cuenta de miembro, que es la que dice
        // como entra a la aplicacion y no su cargo.
        rol: esCuentaDeMiembro
          ? actual.rol
          : rolQueQueda === ROLES.ADMINISTRADOR_GLOBAL
            ? 'administrador'
            : rolQueQueda,
        asignadoPor: quienLlama.uid || quienLlama.email || 'sistema',
        asignadoEn: ahora,
        actualizadoEn: ahora,
      };

      await db.collection(COLECCION_USUARIOS_ROLES).doc(id).set(datos, { merge: true });

      if (!payload || id === cuentas.uids[0]) payload = datos;
    })
  );

  // 7) Los claims de CADA cuenta de Firebase, para que su sesion refleje el cargo
  //    nuevo sin esperar a volver a entrar. Si fallan, la asignacion ya esta
  //    guardada: se sincroniza en el proximo acceso.
  let claims = null;

  await Promise.all(
    cuentas.uids.map(async (uid) => {
      try {
        const actual = asignaciones.get(uid) ?? {};
        const suyos = deriveUserClaims({
          rolId: payload?.rolId ?? cargoNuevo,
          alcance,
          idMiembros: actual.idMiembros ?? actual.memberId ?? cuentas.idMiembros,
        });

        // Sin borrar `debeCambiarClave`: ver `claims-con-marca-de-clave.js`.
        await fijarClaimsConservandoClave(auth, uid, suyos);
        claims = claims ?? suyos;
      } catch (error) {
        console.warn('[asignar-rol-administracion] no se pudieron emitir los claims', error);
      }
    })
  );

  // Quien dio o quito que cargo a quien: de esto depende todo lo demas.
  await registrarEventoDeSeguridad(req, {
    accion: ACCIONES_DE_SEGURIDAD.rolAdministracionAsignado,
    actor: { uid: quienLlama.uid, rol: suRol },
    objetivo: {
      uid: cuentas.uids[0] || uidUsuario,
      idMiembros: cuentas.idMiembros,
      codigoMiembro: cuentas.codigoMiembro,
      correo,
    },
    detalle: {
      accion: accionNormalizada || 'reemplazar',
      rolPedido: cargoNuevo,
      rolesAntes: rolesPrevios,
      rolesDespues: rolesNuevos,
      cuentas: cuentas.uids.length,
    },
  });

  // Sin cuenta de Firebase todavia (nunca ha entrado): el cargo queda en su
  // documento y se le aplica cuando cree su acceso.
  if (!cuentas.uids.length) {
    return Response.json({
      ok: true,
      asignacion: payload,
      claims: null,
      aviso: 'Esta persona aún no tiene cuenta de acceso: el cargo se aplicará cuando entre.',
    });
  }

  return Response.json({ ok: true, asignacion: payload, claims });
}
