import { getDocs, collection } from 'firebase/firestore';

import {
  sembrarCatalogoNotificacionesIniciales,
  sembrarPreferenciasNotificacionesUsuario,
} from 'src/utils/firebase-notificaciones';

import { exigirSesionRest } from 'src/server/sesion-rest.mjs';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

const isAdminRole = (value = '') => {
  const role = String(value || '').toLowerCase();
  return role === 'admin' || role === 'administrador' || role === 'administrator';
};

const addRecipient = (recipients, idUsuario, rol = 'usuario') => {
  if (!idUsuario) return;

  const normalizedRole = isAdminRole(rol) ? 'admin' : 'usuario';
  const currentRole = recipients.get(String(idUsuario));

  if (currentRole === 'admin' && normalizedRole !== 'admin') {
    return;
  }

  recipients.set(String(idUsuario), normalizedRole);
};

const obtenerUsuariosConPreferencias = async () => {
  const recipients = new Map();

  const readCollection = async (collectionName) => {
    const snapshot = await getDocs(collection(FIRESTORE, collectionName)).catch(() => null);

    snapshot?.docs?.forEach((item) => {
      const data = item.data() || {};
      const rol = collectionName === 'admins' ? 'admin' : data.rol || data.role || 'usuario';
      const idUsuario = data.uid || data.idUsuario || data.idMiembros || item.id;

      addRecipient(recipients, idUsuario, rol);
    });
  };

  await Promise.all([
    readCollection('admins'),
    readCollection('users'),
    readCollection('usuarios_roles'),
  ]);

  return Array.from(recipients.entries()).map(([idUsuario, rol]) => ({ idUsuario, rol }));
};

export async function POST(req) {
  // Sembrar el catalogo de notificaciones y las preferencias escribe para todos
  // los usuarios: sin sesion, no.
  const sinSesion = await exigirSesionRest(req);

  if (sinSesion) return sinSesion;

  if (!isFirebaseConfigured || !FIRESTORE) {
    return Response.json({ ok: false, message: 'Firebase no esta configurado.' }, { status: 500 });
  }

  await sembrarCatalogoNotificacionesIniciales();

  const recipients = await obtenerUsuariosConPreferencias();

  await Promise.all(
    recipients.map((recipient) => sembrarPreferenciasNotificacionesUsuario(recipient))
  );

  return Response.json({
    ok: true,
    tipos: 'sincronizados',
    plantillas: 'sincronizadas',
    preferencias: recipients.length,
  });
}
