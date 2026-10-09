import { FieldValue } from 'firebase-admin/firestore';

import { ROLES } from 'src/auth/permissions/roles';

const ROLES_DESTINO = [ROLES.ADMINISTRADOR_GLOBAL, ROLES.OFICINA_NACIONAL];

export async function notificarDocumentosMembresiaEnviados(
  db,
  { id, membresia, registro, numeroRegistro, facturaNumero }
) {
  if (registro.estado !== 'enviado') return false;
  const roles = db.collection('usuarios_roles');
  const [porRol, porCargos] = await Promise.all([
    roles.where('rolId', 'in', ROLES_DESTINO).get(),
    roles.where('rolesQueEjerce', 'array-contains-any', ROLES_DESTINO).get(),
  ]);
  const idsDestinatarios = [
    ...new Set(
      [...porRol.docs, ...porCargos.docs]
        .filter((doc) => doc.data()?.activo !== false)
        .map((doc) => String(doc.data()?.uid || (doc.id.length > 20 ? doc.id : '')).trim())
        .filter(Boolean)
    ),
  ];
  if (!idsDestinatarios.length) return false;

  const destacado = membresia.destacamento || {};
  const nombre = `#${destacado.numero || id} ${destacado.nombre || ''}`.trim();
  const ahora = new Date().toISOString();
  const aviso = db.collection('notificaciones').doc(`membresia-documentos-${crypto.randomUUID()}`);
  const mensaje = `Certificado ${numeroRegistro || '—'}${facturaNumero ? ` y factura ${facturaNumero}` : ''} enviados a ${registro.para}.`;
  await aviso.create({
    id: aviso.id,
    tipoNotificacion: 'membresia_onerrd_documentos_enviados',
    modulo: 'certificados',
    titulo: `Membresía 2027: documentos enviados a ${nombre}`,
    mensaje,
    mensajeVisual: mensaje,
    rolDestinatario: 'admin',
    idsDestinatarios,
    prioridad: 'normal',
    estado: 'no_leida',
    creadoPorUid: null,
    fechaCreacion: ahora,
    fechaEnvio: ahora,
    actorId: '20003',
    actorTipo: 'sistema',
    actorNombre: 'Sistema',
    actorFotoURL: null,
    entidadTipo: 'destacamento',
    entidadId: String(id),
    ruta: '/dashboard/certificates?tab=onerrd',
    imagenTipo: 'icono',
    imagenURL: null,
    miniaturaURL: null,
    tipoAccion: 'ver',
    etiquetaAccion: 'Ver membresía',
    leidaPor: [],
    metadatos: {
      correo: registro.para,
      numeroRegistro: numeroRegistro || '',
      facturaNumero: facturaNumero || '',
    },
    creadoEnServidor: FieldValue.serverTimestamp(),
    actualizadoEnServidor: FieldValue.serverTimestamp(),
  });
  return true;
}
