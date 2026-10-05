import {
  DEFINICIONES_NOTIFICACIONES,
  COLECCIONES_NOTIFICACIONES,
  construirDocumentoTipo,
  construirDocumentoPlantilla,
  construirPreferenciasNotificacionesBase,
} from 'src/utils/firebase-notificaciones';

import { exigirAdministradorGlobalRest } from 'src/server/sesion-rest.mjs';
import { createChatFirestoreRestClient } from 'src/server/chat-firestore-rest.mjs';

export const runtime = 'nodejs';

const isAdminRole = (value = '') =>
  ['admin', 'administrador', 'administrator'].includes(String(value || '').toLowerCase());

const addRecipient = (recipients, idUsuario, rol = 'usuario') => {
  if (!idUsuario) return;
  const normalizedRole = isAdminRole(rol) ? 'admin' : 'usuario';
  const currentRole = recipients.get(String(idUsuario));
  if (currentRole === 'admin' && normalizedRole !== 'admin') return;
  recipients.set(String(idUsuario), normalizedRole);
};

const crearCliente = (request) => {
  const token = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const projectId = String(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ''
  ).trim();
  if (!token || !projectId) return null;
  return createChatFirestoreRestClient({ projectId, token });
};

const confirmarEnLotes = async (client, writes) => {
  for (let index = 0; index < writes.length; index += 300) {
    await client.commitWrites(writes.slice(index, index + 300));
  }
};

const rutasDeCampos = (data, prefix = '') =>
  Object.entries(data).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)
      ? rutasDeCampos(value, path)
      : [path];
  });

export async function POST(req) {
  const sinPermiso = await exigirAdministradorGlobalRest(req);
  if (sinPermiso) return sinPermiso;

  const client = crearCliente(req);
  if (!client) {
    return Response.json({ ok: false, message: 'Firebase no está configurado.' }, { status: 503 });
  }

  try {
    const recipients = new Map();
    const collections = ['admins', 'users', 'usuarios_roles'];
    const results = await Promise.all(collections.map((name) => client.listCollection(name)));

    results.forEach((documents, index) => {
      documents.forEach((data) => {
        const rol = collections[index] === 'admins' ? 'admin' : data.rol || data.role || 'usuario';
        const idUsuario = data.uid || data.idUsuario || data.idMiembros || data.id;
        addRecipient(recipients, idUsuario, rol);
      });
    });

    const now = new Date();
    const writes = Object.entries(DEFINICIONES_NOTIFICACIONES).flatMap(([tipo, definicion]) => [
      {
        type: 'set',
        path: `${COLECCIONES_NOTIFICACIONES.tipos}/${tipo}`,
        data: { ...construirDocumentoTipo(tipo, definicion, now), fechaCreacion: now },
        merge: true,
      },
      {
        type: 'set',
        path: `${COLECCIONES_NOTIFICACIONES.plantillas}/${tipo}`,
        data: { ...construirDocumentoPlantilla(tipo, definicion, now), fechaCreacion: now },
        merge: true,
      },
    ]);

    recipients.forEach((rol, idUsuario) => {
      const data = {
        ...construirPreferenciasNotificacionesBase({ idUsuario, rol }),
        fechaCreacion: now,
        fechaActualizacion: now,
      };
      writes.push({
        type: 'set',
        path: `${COLECCIONES_NOTIFICACIONES.preferencias}/${idUsuario}`,
        data,
        merge: true,
        fieldPaths: rutasDeCampos(data),
      });
    });

    await confirmarEnLotes(client, writes);

    return Response.json({
      ok: true,
      tipos: 'sincronizados',
      plantillas: 'sincronizadas',
      preferencias: recipients.size,
    });
  } catch (error) {
    console.error('[notifications/seed] no se pudo sembrar el catálogo', error);
    return Response.json({ ok: false, message: 'No se pudieron sembrar las notificaciones.' }, { status: 502 });
  }
}
