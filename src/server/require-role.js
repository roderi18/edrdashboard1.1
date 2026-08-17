import { getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

// ----------------------------------------------------------------------
// Guardia de rol para las rutas /api que escriben en el backend .NET.
//
// Estos proxys reenviaban POST y DELETE sin comprobar nada: cualquiera que
// conociera la URL podia asignar o retirar cargos SIN tener cuenta. El rol se
// lee de los custom claims del ID token, que solo emite el Admin SDK.
// ----------------------------------------------------------------------

const getBearerToken = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
};

// Devuelve null si la peticion esta autorizada, o una Response con el error.
export async function requireRole(req, rolesPermitidos = []) {
  if (!isAdminConfigured()) {
    return Response.json(
      { Success: false, Message: 'El servidor no tiene configurado FIREBASE_SERVICE_ACCOUNT.' },
      { status: 503 }
    );
  }

  const token = getBearerToken(req);

  if (!token) {
    return Response.json(
      { Success: false, Message: 'Inicia sesión para realizar esta acción.' },
      { status: 401 }
    );
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const rol = String(decoded?.rol ?? '').trim().toLowerCase();

    if (rolesPermitidos.length && !rolesPermitidos.includes(rol)) {
      return Response.json(
        { Success: false, Message: 'Tu rol no puede realizar esta acción.' },
        { status: 403 }
      );
    }

    return null;
  } catch {
    return Response.json(
      { Success: false, Message: 'La sesión no es válida o expiró.' },
      { status: 401 }
    );
  }
}

export const ROLES_ADMINISTRACION_CARGOS = ['administrador_global'];
