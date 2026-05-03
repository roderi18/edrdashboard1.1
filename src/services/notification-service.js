import {
  doc,
  query,
  where,
  setDoc,
  getDocs,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';

import { getMembers } from 'src/services/member-service';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

const MODULOS_CATEGORIAS = {
  administradores: 'Administradores',
  archivos: 'Archivos',
  cuentas: 'Cuentas',
  cumpleanos: 'Cumpleaños',
  eventos: 'Eventos',
  facturas: 'Facturas',
  miembros: 'Miembros',
  mensajes: 'Mensajes',
  pedidos: 'Pedidos',
  permisos: 'Permisos',
  productos: 'Productos',
};

const TIPOS_VISUALES = {
  administrador_creado: 'mail',
  cuenta_creada: 'friend',
  evento_reprogramado: 'tags',
  factura_disponible: 'mail',
  factura_generada: 'mail',
  miembro_actualizado: 'project',
  miembro_creado: 'friend',
  mensaje_recibido: 'chat',
  pedido_cancelado: 'order',
  pedido_confirmado: 'delivery',
  pedido_creado: 'order',
  pedido_recibido: 'order',
  perfil_actualizado: 'project',
  producto_disponible_nuevamente: 'delivery',
  producto_publicado: 'tags',
  producto_sin_stock: 'order',
  producto_stock_bajo: 'file',
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const asegurarFirebaseNotificaciones = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado en este entorno.');
  }
};

const obtenerCategoriaNotificacion = (modulo) => MODULOS_CATEGORIAS[modulo] || 'General';

const obtenerTipoVisualNotificacion = (tipoNotificacion) =>
  TIPOS_VISUALES[tipoNotificacion] || 'mail';

const construirTituloHtml = (notificacion) => {
  if (notificacion.tituloHtml) {
    return notificacion.tituloHtml;
  }

  const actorNombre = escapeHtml(notificacion.actorNombre || 'Sistema');
  const mensaje =
    escapeHtml(
      notificacion.mensajeVisual ||
        notificacion.mensaje ||
        notificacion.titulo ||
        'Tienes una nueva notificación.'
    ) || 'Tienes una nueva notificación.';

  return `<p><strong>${actorNombre}</strong> ${mensaje}</p>`;
};

const aIsoConDesfase = ({ minutes = 0, hours = 0, days = 0 }) => {
  const now = new Date();
  const offsetMs = (((days * 24) + hours) * 60 + minutes) * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString();
};

const construirNombreCompletoMiembro = (miembro = {}) =>
  [miembro.firstName || miembro.nombres || '', miembro.lastName || miembro.apellidos || '']
    .join(' ')
    .trim();

const obtenerUltimoMiembroCreado = async () => {
  const members = await getMembers();

  if (!members.length) {
    return null;
  }

  const sorted = [...members].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();

    if (dateA !== dateB) {
      return dateB - dateA;
    }

    return Number(b.id || 0) - Number(a.id || 0);
  });

  return sorted[0];
};

const construirMetadatosMiembro = (miembro = {}) => ({
  idMiembros: Number(miembro.id || 0),
  codigoMiembro: miembro.memberId || '',
  nombres: miembro.firstName || '',
  apellidos: miembro.lastName || '',
  genero: miembro.gender || '',
  fechaNacimiento: miembro.birthDate || null,
  idDestacamento: Number(miembro.idDestacamento || miembro.destId || 0),
  telefono: miembro.phoneNumber || '',
  direccion: miembro.memberAddress || '',
  correo: miembro.email || '',
  idDivision: Number(miembro.idDivision || 0),
  instructorCertificadoCi: Boolean(miembro.InstructorCertificadoCI),
  estatusVigenciaCi: Boolean(miembro.EstatusVigenciaCI),
  fechaInicioCertificado: miembro.FechaInicioCI || null,
  fechaFinCertificado: miembro.FechaVencimientoCI || null,
  estatusMiembro: miembro.status || 'active',
});

const construirNotificacionesPrueba = ({ usuario, ultimoMiembro }) => {
  const idUsuario = String(usuario?.uid || usuario?.id || '');
  const nombreUsuario =
    usuario?.displayName || usuario?.nombre || usuario?.email || usuario?.correo || 'Usuario';
  const nombreMiembro = construirNombreCompletoMiembro(ultimoMiembro) || 'Último usuario creado';
  const fotoMiembro = ultimoMiembro?.avatarUrl || usuario?.photoURL || null;
  const fotoActor = usuario?.photoURL || fotoMiembro || null;
  const idMiembro = Number(ultimoMiembro?.id || 0);
  const baseMiembro = construirMetadatosMiembro(ultimoMiembro);

  return [
    {
      id: `prueba_admin_cuenta_creada_${idUsuario}`,
      tipoNotificacion: 'cuenta_creada',
      modulo: 'cuentas',
      titulo: 'Cuenta creada',
      tituloHtml: `<p><strong>${escapeHtml(nombreMiembro)}</strong> fue registrado como nuevo usuario</p>`,
      mensaje: 'fue registrado como nuevo usuario.',
      mensajeVisual: 'fue registrado como nuevo usuario.',
      rolDestinatario: 'admin',
      idsDestinatarios: [idUsuario],
      prioridad: 'informativa',
      estado: 'no_leida',
      fechaCreacion: aIsoConDesfase({ minutes: 5 }),
      fechaEnvio: aIsoConDesfase({ minutes: 5 }),
      actorId: idUsuario,
      actorTipo: 'admin',
      actorNombre: nombreUsuario,
      actorFotoURL: fotoActor,
      entidadTipo: 'miembro',
      entidadId: idMiembro || 'ultimo_usuario',
      ruta: idMiembro ? `/dashboard/level/member/${idMiembro}/edit` : '/dashboard/level/member',
      imagenTipo: 'persona',
      imagenURL: fotoMiembro,
      miniaturaURL: fotoMiembro,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver',
      metadatos: {
        ...baseMiembro,
        esPrueba: true,
      },
    },
    {
      id: `prueba_admin_miembro_actualizado_${idUsuario}`,
      tipoNotificacion: 'miembro_actualizado',
      modulo: 'miembros',
      titulo: 'Miembro actualizado',
      tituloHtml: `<p><strong>${escapeHtml(nombreMiembro)}</strong> actualizó su perfil</p>`,
      mensaje: 'actualizó su perfil.',
      mensajeVisual: 'actualizó su perfil.',
      rolDestinatario: 'admin',
      idsDestinatarios: [idUsuario],
      prioridad: 'informativa',
      estado: 'leida',
      fechaCreacion: aIsoConDesfase({ hours: 1 }),
      fechaEnvio: aIsoConDesfase({ hours: 1 }),
      actorId: idUsuario,
      actorTipo: 'admin',
      actorNombre: nombreMiembro,
      actorFotoURL: fotoMiembro,
      entidadTipo: 'miembro',
      entidadId: idMiembro || 'ultimo_usuario',
      ruta: idMiembro ? `/dashboard/level/member/${idMiembro}/edit` : '/dashboard/level/member',
      imagenTipo: 'persona',
      imagenURL: fotoMiembro,
      miniaturaURL: fotoMiembro,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver perfil',
      metadatos: {
        ...baseMiembro,
        esPrueba: true,
      },
    },
    {
      id: `prueba_admin_pedido_recibido_${idUsuario}`,
      tipoNotificacion: 'pedido_recibido',
      modulo: 'pedidos',
      titulo: 'Nuevo pedido recibido',
      tituloHtml: `<p><strong>Tienda</strong> recibió el pedido <strong>#ORD-1024</strong></p>`,
      mensaje: 'recibió el pedido #ORD-1024.',
      mensajeVisual: 'recibió el pedido #ORD-1024.',
      rolDestinatario: 'admin',
      idsDestinatarios: [idUsuario],
      prioridad: 'importante',
      estado: 'no_leida',
      fechaCreacion: aIsoConDesfase({ hours: 3 }),
      fechaEnvio: aIsoConDesfase({ hours: 3 }),
      actorId: 'sistema',
      actorTipo: 'sistema',
      actorNombre: 'Tienda',
      actorFotoURL: null,
      entidadTipo: 'pedido',
      entidadId: 'ORD-1024',
      ruta: '/dashboard/order',
      imagenTipo: 'icono',
      imagenURL: null,
      miniaturaURL: null,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver pedido',
      metadatos: {
        idPedido: 'ORD-1024',
        nombreCliente: nombreMiembro,
        esPrueba: true,
      },
    },
    {
      id: `prueba_admin_producto_stock_bajo_${idUsuario}`,
      tipoNotificacion: 'producto_stock_bajo',
      modulo: 'productos',
      titulo: 'Producto con stock bajo',
      tituloHtml: `<p><strong>Inventario</strong> reportó stock bajo en <strong>Camisa oficial</strong></p>`,
      mensaje: 'reportó stock bajo en Camisa oficial.',
      mensajeVisual: 'reportó stock bajo en Camisa oficial.',
      rolDestinatario: 'admin',
      idsDestinatarios: [idUsuario],
      prioridad: 'importante',
      estado: 'leida',
      fechaCreacion: aIsoConDesfase({ days: 1 }),
      fechaEnvio: aIsoConDesfase({ days: 1 }),
      actorId: 'sistema',
      actorTipo: 'sistema',
      actorNombre: 'Inventario',
      actorFotoURL: null,
      entidadTipo: 'producto',
      entidadId: 'PROD-100',
      ruta: '/dashboard/product',
      imagenTipo: 'icono',
      imagenURL: null,
      miniaturaURL: null,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver producto',
      metadatos: {
        idProducto: 'PROD-100',
        nombreProducto: 'Camisa oficial',
        stock: 2,
        esPrueba: true,
      },
    },
    {
      id: `prueba_admin_mensaje_recibido_${idUsuario}`,
      tipoNotificacion: 'mensaje_recibido',
      modulo: 'mensajes',
      titulo: 'Mensaje recibido',
      tituloHtml: `<p><strong>${escapeHtml(nombreMiembro)}</strong> te envió un mensaje</p>`,
      mensaje: 'te envió un mensaje.',
      mensajeVisual: 'te envió un mensaje.',
      rolDestinatario: 'admin',
      idsDestinatarios: [idUsuario],
      prioridad: 'informativa',
      estado: 'no_leida',
      fechaCreacion: aIsoConDesfase({ days: 2 }),
      fechaEnvio: aIsoConDesfase({ days: 2 }),
      actorId: String(idMiembro || 'miembro'),
      actorTipo: 'miembro',
      actorNombre: nombreMiembro,
      actorFotoURL: fotoMiembro,
      entidadTipo: 'mensaje',
      entidadId: 'MSG-ADMIN-1',
      ruta: '/dashboard/chat',
      imagenTipo: 'persona',
      imagenURL: fotoMiembro,
      miniaturaURL: fotoMiembro,
      tipoAccion: 'responder',
      etiquetaAccion: 'Responder',
      metadatos: {
        idMensaje: 'MSG-ADMIN-1',
        esPrueba: true,
      },
    },
    {
      id: `prueba_usuario_cuenta_creada_${idUsuario}`,
      tipoNotificacion: 'cuenta_creada',
      modulo: 'cuentas',
      titulo: 'Cuenta creada',
      tituloHtml: `<p><strong>${escapeHtml(nombreUsuario)}</strong> tu cuenta fue creada correctamente</p>`,
      mensaje: 'tu cuenta fue creada correctamente.',
      mensajeVisual: 'tu cuenta fue creada correctamente.',
      rolDestinatario: 'usuario',
      idsDestinatarios: [idUsuario],
      prioridad: 'informativa',
      estado: 'no_leida',
      fechaCreacion: aIsoConDesfase({ minutes: 15 }),
      fechaEnvio: aIsoConDesfase({ minutes: 15 }),
      actorId: 'sistema',
      actorTipo: 'sistema',
      actorNombre: nombreUsuario,
      actorFotoURL: fotoActor,
      entidadTipo: 'cuenta',
      entidadId: idUsuario,
      ruta: '/dashboard/user/account',
      imagenTipo: 'persona',
      imagenURL: fotoActor,
      miniaturaURL: fotoActor,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver cuenta',
      metadatos: {
        idUsuario,
        nombreUsuario,
        esPrueba: true,
      },
    },
    {
      id: `prueba_usuario_perfil_actualizado_${idUsuario}`,
      tipoNotificacion: 'perfil_actualizado',
      modulo: 'miembros',
      titulo: 'Perfil actualizado',
      tituloHtml: `<p><strong>${escapeHtml(nombreUsuario)}</strong> actualizó su perfil</p>`,
      mensaje: 'actualizó su perfil.',
      mensajeVisual: 'actualizó su perfil.',
      rolDestinatario: 'usuario',
      idsDestinatarios: [idUsuario],
      prioridad: 'informativa',
      estado: 'leida',
      fechaCreacion: aIsoConDesfase({ hours: 2 }),
      fechaEnvio: aIsoConDesfase({ hours: 2 }),
      actorId: idUsuario,
      actorTipo: 'usuario',
      actorNombre: nombreUsuario,
      actorFotoURL: fotoActor,
      entidadTipo: 'miembro',
      entidadId: idMiembro || idUsuario,
      ruta: '/dashboard/user/account',
      imagenTipo: 'persona',
      imagenURL: fotoActor,
      miniaturaURL: fotoActor,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver perfil',
      metadatos: {
        idUsuario,
        nombreUsuario,
        esPrueba: true,
      },
    },
    {
      id: `prueba_usuario_pedido_creado_${idUsuario}`,
      tipoNotificacion: 'pedido_creado',
      modulo: 'pedidos',
      titulo: 'Pedido creado',
      tituloHtml: `<p><strong>Tienda</strong> creó tu pedido <strong>#ORD-2048</strong></p>`,
      mensaje: 'creó tu pedido #ORD-2048.',
      mensajeVisual: 'creó tu pedido #ORD-2048.',
      rolDestinatario: 'usuario',
      idsDestinatarios: [idUsuario],
      prioridad: 'informativa',
      estado: 'no_leida',
      fechaCreacion: aIsoConDesfase({ hours: 5 }),
      fechaEnvio: aIsoConDesfase({ hours: 5 }),
      actorId: 'sistema',
      actorTipo: 'sistema',
      actorNombre: 'Tienda',
      actorFotoURL: null,
      entidadTipo: 'pedido',
      entidadId: 'ORD-2048',
      ruta: '/product/checkout',
      imagenTipo: 'icono',
      imagenURL: null,
      miniaturaURL: null,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver pedido',
      metadatos: {
        idPedido: 'ORD-2048',
        esPrueba: true,
      },
    },
    {
      id: `prueba_usuario_factura_disponible_${idUsuario}`,
      tipoNotificacion: 'factura_disponible',
      modulo: 'facturas',
      titulo: 'Factura disponible',
      tituloHtml: `<p><strong>Facturación</strong> dejó disponible la factura <strong>#FAC-330</strong></p>`,
      mensaje: 'dejó disponible la factura #FAC-330.',
      mensajeVisual: 'dejó disponible la factura #FAC-330.',
      rolDestinatario: 'usuario',
      idsDestinatarios: [idUsuario],
      prioridad: 'informativa',
      estado: 'no_leida',
      fechaCreacion: aIsoConDesfase({ days: 3 }),
      fechaEnvio: aIsoConDesfase({ days: 3 }),
      actorId: 'sistema',
      actorTipo: 'sistema',
      actorNombre: 'Facturación',
      actorFotoURL: null,
      entidadTipo: 'factura',
      entidadId: 'FAC-330',
      ruta: '/dashboard/invoice',
      imagenTipo: 'icono',
      imagenURL: null,
      miniaturaURL: null,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver factura',
      metadatos: {
        idFactura: 'FAC-330',
        esPrueba: true,
      },
    },
    {
      id: `prueba_usuario_evento_reprogramado_${idUsuario}`,
      tipoNotificacion: 'evento_reprogramado',
      modulo: 'eventos',
      titulo: 'Evento reprogramado',
      tituloHtml: `<p><strong>Campamento anual</strong> fue reprogramado</p>`,
      mensaje: 'fue reprogramado.',
      mensajeVisual: 'fue reprogramado.',
      rolDestinatario: 'usuario',
      idsDestinatarios: [idUsuario],
      prioridad: 'importante',
      estado: 'leida',
      fechaCreacion: aIsoConDesfase({ days: 4 }),
      fechaEnvio: aIsoConDesfase({ days: 4 }),
      actorId: 'sistema',
      actorTipo: 'sistema',
      actorNombre: 'Campamento anual',
      actorFotoURL: null,
      entidadTipo: 'evento',
      entidadId: 'EVT-100',
      ruta: '/dashboard/calendar',
      imagenTipo: 'icono',
      imagenURL: null,
      miniaturaURL: null,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver evento',
      metadatos: {
        idEvento: 'EVT-100',
        nombreEvento: 'Campamento anual',
        esPrueba: true,
      },
    },
  ];
};

export const transformarNotificacionFirestoreADrawer = (id, notificacion = {}) => ({
  id,
  avatarUrl: notificacion.imagenURL || notificacion.actorFotoURL || null,
  type: obtenerTipoVisualNotificacion(notificacion.tipoNotificacion),
  category: obtenerCategoriaNotificacion(notificacion.modulo),
  estado: notificacion.estado || 'no_leida',
  isUnRead: notificacion.estado !== 'leida',
  createdAt: notificacion.fechaCreacion || notificacion.fechaEnvio || null,
  title: construirTituloHtml(notificacion),
});

export async function listarNotificacionesFirestorePorUsuario(idUsuario) {
  if (!isFirebaseConfigured || !FIRESTORE || !idUsuario) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones),
      where('idsDestinatarios', 'array-contains', String(idUsuario))
    )
  );

  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
    }))
    .sort((a, b) => String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || '')));
}

export async function listarNotificacionesDrawerPorUsuario(idUsuario) {
  const notificaciones = await listarNotificacionesFirestorePorUsuario(idUsuario);
  return notificaciones.map((item) => transformarNotificacionFirestoreADrawer(item.id, item));
}

export async function marcarNotificacionesComoLeidasPorUsuario(idUsuario) {
  asegurarFirebaseNotificaciones();

  if (!idUsuario) {
    return;
  }

  const notificaciones = await listarNotificacionesFirestorePorUsuario(idUsuario);

  await Promise.all(
    notificaciones.map((notificacion) =>
      updateDoc(doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificacion.id), {
        estado: 'leida',
        fechaLectura: new Date().toISOString(),
        actualizadoEnServidor: serverTimestamp(),
      })
    )
  );
}

export async function sembrarNotificacionesPrueba(usuario = {}) {
  asegurarFirebaseNotificaciones();

  const idUsuario = String(usuario?.uid || usuario?.id || '');

  if (!idUsuario) {
    throw new Error('No se pudo identificar al usuario destinatario de la prueba.');
  }

  const ultimoMiembro = await obtenerUltimoMiembroCreado();
  const notificaciones = construirNotificacionesPrueba({ usuario, ultimoMiembro });

  await Promise.all(
    notificaciones.map((notificacion) =>
      setDoc(
        doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificacion.id),
        {
          ...notificacion,
          leidaPor: [],
          fechaProgramada: null,
          fechaExpiracion: null,
          fechaLectura: notificacion.estado === 'leida' ? notificacion.fechaCreacion : null,
          tipoAccionSecundaria: null,
          etiquetaAccionSecundaria: null,
          creadoEnServidor: serverTimestamp(),
          actualizadoEnServidor: serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}
