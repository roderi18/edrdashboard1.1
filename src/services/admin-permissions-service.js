import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { registrarAuditoriaSilenciosa } from 'src/services/audit-log-service';

// ----------------------------------------------------------------------

export const ADMIN_PERMISSION_ACTIONS = [
  { key: 'ver', label: 'Ver' },
  { key: 'crear', label: 'Crear' },
  { key: 'editar', label: 'Editar' },
  { key: 'eliminar', label: 'Eliminar' },
  { key: 'exportar', label: 'Exportar' },
  { key: 'aprobar', label: 'Aprobar' },
  { key: 'administrarConfiguracion', label: 'Administrar configuración' },
];

export const ADMIN_PERMISSION_MODULES = [
  { key: 'administradores', label: 'Administradores' },
  { key: 'miembros', label: 'Miembros' },
  { key: 'destacamentos', label: 'Destacamentos' },
  { key: 'secciones', label: 'Secciones' },
  { key: 'regiones', label: 'Regiones' },
  { key: 'publicaciones', label: 'Publicaciones' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'facturas', label: 'Facturas' },
  { key: 'productos', label: 'Productos' },
  { key: 'archivos', label: 'Archivos' },
  { key: 'notificaciones', label: 'Notificaciones' },
  { key: 'logs', label: 'Logs' },
  { key: 'mantenimiento', label: 'Mantenimiento' },
];

export const crearPermisosAdminPorDefecto = () =>
  Object.fromEntries(
    ADMIN_PERMISSION_MODULES.map((module) => [
      module.key,
      Object.fromEntries(ADMIN_PERMISSION_ACTIONS.map((action) => [action.key, true])),
    ])
  );

export const normalizarPermisosAdmin = (permissions = {}) => {
  const defaults = crearPermisosAdminPorDefecto();

  return Object.fromEntries(
    ADMIN_PERMISSION_MODULES.map((module) => [
      module.key,
      {
        ...defaults[module.key],
        ...(permissions?.[module.key] || {}),
      },
    ])
  );
};

const getAdminDocId = (admin = {}) =>
  String(
    admin.adminId ||
      admin.adminDocId ||
      admin.uid ||
      admin.idUsuario ||
      admin.idMiembros ||
      admin.memberId ||
      admin.id ||
      ''
  ).trim();

const getRoleDocId = (admin = {}) =>
  String(admin.idMiembros || admin.memberId || admin.codigoMiembro || admin.memberCode || '').trim();

export async function guardarPermisosAdministrador({
  administrador = {},
  permisos = {},
  usuario = {},
} = {}) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado para guardar permisos.');
  }

  const normalizedPermissions = normalizarPermisosAdmin(permisos);
  const adminDocId = getAdminDocId(administrador);
  const roleDocId = getRoleDocId(administrador);
  const now = new Date().toISOString();
  const payload = {
    permisos: normalizedPermissions,
    permissions: normalizedPermissions,
    actualizadoEn: now,
    actualizadoEnServidor: serverTimestamp(),
  };

  await Promise.all([
    adminDocId
      ? setDoc(doc(FIRESTORE, 'admins', adminDocId), payload, { merge: true })
      : Promise.resolve(),
    roleDocId
      ? setDoc(doc(FIRESTORE, 'usuarios_roles', roleDocId), payload, { merge: true })
      : Promise.resolve(),
    administrador?.uid
      ? setDoc(doc(FIRESTORE, 'users', String(administrador.uid)), payload, { merge: true })
      : Promise.resolve(),
  ]);

  registrarAuditoriaSilenciosa({
    modulo: 'permisos',
    accion: 'permisos_administrador_actualizados',
    descripcion: `Se actualizaron permisos finos de ${administrador.name || administrador.displayName || 'administrador'}.`,
    severidad: 'importante',
    entidad: {
      tipo: 'administrador',
      id: adminDocId || roleDocId,
      nombre: administrador.name || administrador.displayName || administrador.email || '',
      ruta: '/dashboard/admin',
    },
    despues: normalizedPermissions,
    realizadoPor: usuario,
    origen: 'administradores',
  });

  return normalizedPermissions;
}
