import { ROLES_QUE_NO_SALEN_DE_UNA_CASILLA } from 'src/catalogs/directiva-roles';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import {
  leerAsignacionesDe,
  resolverAccesoPorCargo,
  escribirAccesoPorCargo,
  COLECCION_USUARIOS_ROLES,
} from 'src/server/rol-por-cargo';

import { PERMISOS } from 'src/auth/permissions/permissions';
import { PERMISOS_POR_ROL } from 'src/auth/permissions/role-permissions';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// PONER AL DIA A TODAS LAS CUENTAS DE UNA VEZ.
//
// Cada persona se sincroniza sola al entrar, pero eso deja fuera a quien lleva
// tiempo sin iniciar sesion: su documento sigue sin rol y el servidor le niega
// lo que su cargo si le concede. Esto recorre las cuentas y las pone al dia sin
// esperar a que vuelvan.
//
// Lo dispara quien puede gestionar roles. Sin `?aplicar=1` no escribe nada: solo
// cuenta que haria.
// ----------------------------------------------------------------------

const jsonError = (message, status) => Response.json({ error: message }, { status });

const getBearerToken = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
};

const normalizarRol = (valor) => String(valor ?? '').trim().toLowerCase();

const puedeGestionarRoles = (rol) => {
  const rolId = normalizarRol(rol);

  if (rolId === 'administrador_global') return true;

  return (PERMISOS_POR_ROL[rolId] || []).includes(PERMISOS.ADMINISTRACION_GESTIONAR_ROLES);
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
    caller = await auth.verifyIdToken(token);
  } catch {
    return jsonError('Token inválido o expirado.', 401);
  }

  const suAsignacion = await db
    .collection(COLECCION_USUARIOS_ROLES)
    .doc(caller.uid)
    .get()
    .catch(() => null);

  if (!puedeGestionarRoles(caller.rol || suAsignacion?.data()?.rolId || '')) {
    return jsonError('No tienes permiso para gestionar roles.', 403);
  }

  const aplicar = new URL(req.url).searchParams.get('aplicar') === '1';
  const cuentas = await db.collection(COLECCION_USUARIOS_ROLES).get();
  const resultado = { revisadas: cuentas.size, sincronizadas: 0, omitidas: 0, detalle: [] };

  for (const documento of cuentas.docs) {
    const datos = documento.data() ?? {};
    const uid = String(datos.uid ?? '').trim();
    const idMiembros = String(datos.idMiembros ?? '').trim();
    const rolActual = normalizarRol(datos.rolId);

    // Sin uid de Firebase no hay documento que las reglas puedan mirar.
    if (!uid || !idMiembros) {
      resultado.omitidas += 1;
      continue;
    }

    // Un rol puesto a mano manda sobre cualquier cargo: se conserva, pero sus
    // cargos se escriben igual (antes la cuenta se omitia entera y se quedaba
    // sin permisos ni alcance de su casilla).
    const rolFijo = ROLES_QUE_NO_SALEN_DE_UNA_CASILLA.includes(rolActual) ? rolActual : '';

    const acceso = resolverAccesoPorCargo(await leerAsignacionesDe(db, idMiembros), { rolFijo });

    resultado.detalle.push({
      nombre: datos.nombre ?? idMiembros,
      rolId: acceso.rolId,
      cargos: acceso.cargos.length,
      permisos: acceso.permisos.length,
    });

    if (!aplicar) continue;

     
    await escribirAccesoPorCargo({ db, auth, uid, idMiembros, acceso });
    resultado.sincronizadas += 1;
  }

  return Response.json({ ok: true, aplicado: aplicar, ...resultado });
}
