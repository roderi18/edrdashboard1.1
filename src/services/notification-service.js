import {
  doc,
  query,
  where,
  setDoc,
  getDocs,
  updateDoc,
  collection,
  arrayUnion,
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
  publicaciones: 'Publicaciones',
};

const TIPOS_VISUALES = {
  administrador_creado: 'mail',
  cuenta_creada: 'mail',
  evento_reprogramado: 'tags',
  factura_disponible: 'mail',
  factura_generada: 'mail',
  miembro_actualizado: 'project',
  miembro_creado: 'mail',
  mensaje_recibido: 'chat',
  pedido_cancelado: 'order',
  pedido_confirmado: 'delivery',
  pedido_creado: 'order',
  pedido_recibido: 'order',
  perfil_actualizado: 'project',
  producto_disponible_nuevamente: 'delivery',
  producto_publicado: 'tags',
  publicacion_comentada: 'chat',
  publicacion_reportada: 'mail',
  recordatorio_publicacion: 'mail',
  producto_resena_baja: 'chat',
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
  const offsetMs = ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
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

const obtenerIdsAdministradoresNotificaciones = async (usuarioActual = {}) => {
  const ids = new Set();
  const currentRole = String(usuarioActual?.role ?? usuarioActual?.rol ?? '').toLowerCase();
  const currentIsAdmin = currentRole === 'admin' || currentRole === 'administrador';

  if (currentIsAdmin && usuarioActual?.uid) ids.add(String(usuarioActual.uid));
  if (currentIsAdmin && usuarioActual?.id) ids.add(String(usuarioActual.id));

  const leerColeccion = async (collectionName) => {
    try {
      const snapshot = await getDocs(collection(FIRESTORE, collectionName));

      snapshot.docs.forEach((item) => {
        const data = item.data() ?? {};
        const rol = String(data.rol ?? data.role ?? '').toLowerCase();
        const esAdmin = collectionName === 'admins' || rol === 'admin' || rol === 'administrador';

        if (!esAdmin) return;

        const id = data.uid ?? data.idUsuario ?? item.id;

        if (id) {
          ids.add(String(id));
        }
      });
    } catch (error) {
      console.warn(`[notifications] no se pudo leer ${collectionName}`, error);
    }
  };

  await Promise.all([leerColeccion('admins'), leerColeccion('users')]);

  return Array.from(ids);
};

const obtenerIdUsuarioNotificaciones = (usuario = {}) =>
  String(usuario?.uid || usuario?.id || usuario?.usuarioId || '').trim();

const construirDescripcionPedido = (orden = {}) => {
  const numeroOrden = orden?.numeroOrden || orden?.orderNumber || orden?.ordenId || orden?.id;
  const monto = Number(orden?.montoTotal ?? orden?.totalAmount ?? 0);
  const cantidad = Number(orden?.cantidadTotal ?? orden?.totalQuantity ?? 0);

  return {
    numeroOrden,
    monto,
    cantidad,
    clienteNombre: orden?.cliente?.nombre || orden?.customer?.name || 'Cliente',
    clienteCorreo: orden?.cliente?.correo || orden?.customer?.email || '',
  };
};

const tieneAdjuntosDeProductoRestringido = (orden = {}) =>
  (orden?.items || []).some(
    (item) =>
      (item?.requiereAprobacion ||
        item?.renglon === 'restringido' ||
        item?.tipoProducto === 'restringido') &&
      (item?.archivosAdjuntos || item?.aprobacion?.archivosAdjuntos || []).length
  );

export async function crearNotificacionMiembroCreado({ miembro = {}, usuario = {} }) {
  asegurarFirebaseNotificaciones();

  const idsDestinatarios = await obtenerIdsAdministradoresNotificaciones(usuario);

  if (!idsDestinatarios.length) {
    return null;
  }

  const idMiembro = Number(miembro.id ?? miembro.idMiembros ?? 0);
  const codigoMiembro = miembro.memberId || miembro.codigoMiembro || '';
  const nombreMiembro =
    construirNombreCompletoMiembro(miembro) || codigoMiembro || `Miembro ${idMiembro}`;
  const actorNombre =
    usuario?.displayName || usuario?.nombre || usuario?.email || usuario?.correo || 'Sistema';
  const fotoMiembro = miembro?.avatarUrl || miembro?.photoURL || null;
  const fechaActual = new Date().toISOString();
  const notificationId = `miembro_creado_${idMiembro || codigoMiembro || Date.now()}`;

  const notificacion = {
    id: notificationId,
    tipoNotificacion: 'miembro_creado',
    modulo: 'miembros',
    titulo: 'Nuevo miembro creado',
    tituloHtml: `<p><strong>${escapeHtml(nombreMiembro)}</strong> fue registrado como nuevo miembro</p>`,
    mensaje: 'fue registrado como nuevo miembro.',
    mensajeVisual: 'fue registrado como nuevo miembro.',
    rolDestinatario: 'admin',
    idsDestinatarios,
    prioridad: 'informativa',
    estado: 'no_leida',
    fechaCreacion: fechaActual,
    fechaEnvio: fechaActual,
    actorId: String(usuario?.uid || usuario?.id || 'sistema'),
    actorTipo: usuario?.role === 'admin' ? 'admin' : 'sistema',
    actorNombre,
    actorFotoURL: usuario?.photoURL || fotoMiembro || null,
    entidadTipo: 'miembro',
    entidadId: idMiembro || codigoMiembro,
    ruta: idMiembro ? `/dashboard/level/member/${idMiembro}/edit` : '/dashboard/level/member',
    imagenTipo: 'persona',
    imagenURL: fotoMiembro,
    miniaturaURL: fotoMiembro,
    tipoAccion: 'ver',
    etiquetaAccion: 'Ver miembro',
    tipoAccionSecundaria: null,
    etiquetaAccionSecundaria: null,
    leidaPor: [],
    fechaProgramada: null,
    fechaExpiracion: null,
    fechaLectura: null,
    metadatos: construirMetadatosMiembro(miembro),
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
    notificacion,
    { merge: true }
  );

  return notificacion;
}

export async function crearNotificacionesPedidoCreado({ orden = {}, usuario = {} }) {
  asegurarFirebaseNotificaciones();

  const idsAdministradores = await obtenerIdsAdministradoresNotificaciones(usuario);
  const idUsuario = obtenerIdUsuarioNotificaciones(usuario) || String(orden?.usuarioId || '');
  const fechaActual = new Date().toISOString();
  const ordenId = orden?.ordenId || orden?.id || '';
  const { numeroOrden, monto, cantidad, clienteNombre, clienteCorreo } =
    construirDescripcionPedido(orden);
  const actorId = idUsuario || 'sistema';
  const actorNombre =
    usuario?.displayName || usuario?.nombre || clienteNombre || usuario?.email || 'Cliente';
  const actorFotoURL = usuario?.photoURL || null;
  const tieneAdjuntosRestringidos = tieneAdjuntosDeProductoRestringido(orden);
  const requiereEvaluacion = Boolean(orden?.requiereEvaluacion || tieneAdjuntosRestringidos);
  const mensajePedidoAdmin = tieneAdjuntosRestringidos
    ? `realizó el pedido ${numeroOrden} con archivos adjuntos por producto restringido. Se requiere evaluación.`
    : `realizó el pedido ${numeroOrden}.`;
  const tituloPedidoAdmin = tieneAdjuntosRestringidos
    ? `<p><strong>${escapeHtml(clienteNombre)}</strong> realizó el pedido <strong>${escapeHtml(numeroOrden)}</strong> con archivos adjuntos por producto restringido. Se requiere evaluación</p>`
    : `<p><strong>${escapeHtml(clienteNombre)}</strong> realizó el pedido <strong>${escapeHtml(numeroOrden)}</strong></p>`;
  const baseMetadatos = {
    ordenId,
    numeroOrden,
    montoTotal: monto,
    cantidadTotal: cantidad,
    clienteNombre,
    clienteCorreo,
    miembroId: orden?.miembroId ?? usuario?.idMiembros ?? null,
    codigoMiembro: orden?.cliente?.codigoMiembro ?? usuario?.codigoMiembro ?? null,
  };

  const notificaciones = [];

  if (idsAdministradores.length) {
    notificaciones.push({
      id: `pedido_recibido_${ordenId || Date.now()}`,
      tipoNotificacion: 'pedido_recibido',
      modulo: 'pedidos',
      titulo: 'Nuevo pedido recibido',
      tituloHtml: tituloPedidoAdmin,
      mensaje: mensajePedidoAdmin,
      mensajeVisual: mensajePedidoAdmin,
      rolDestinatario: 'admin',
      idsDestinatarios: idsAdministradores,
      prioridad: 'importante',
      estado: 'no_leida',
      fechaCreacion: fechaActual,
      fechaEnvio: fechaActual,
      actorId,
      actorTipo: 'usuario',
      actorNombre,
      actorFotoURL,
      entidadTipo: 'pedido',
      entidadId: ordenId,
      ruta: numeroOrden ? `/dashboard/order/${numeroOrden}` : '/dashboard/order',
      imagenTipo: 'icono',
      imagenURL: null,
      miniaturaURL: null,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver pedido',
      tipoAccionSecundaria: null,
      etiquetaAccionSecundaria: null,
      leidaPor: [],
      fechaProgramada: null,
      fechaExpiracion: null,
      fechaLectura: null,
      metadatos: baseMetadatos,
      creadoEnServidor: serverTimestamp(),
      actualizadoEnServidor: serverTimestamp(),
    });
  }

  if (idUsuario) {
    notificaciones.push({
      id: `pedido_creado_${ordenId || Date.now()}_${idUsuario}`,
      tipoNotificacion: 'pedido_creado',
      modulo: 'pedidos',
      titulo: requiereEvaluacion ? 'Evaluación en proceso' : 'Pedido creado',
      tituloHtml: requiereEvaluacion
        ? `<p><strong>${escapeHtml(numeroOrden)}</strong> fue enviado a evaluación. La evaluación está en proceso</p>`
        : `<p><strong>${escapeHtml(numeroOrden)}</strong> fue creado correctamente</p>`,
      mensaje: requiereEvaluacion
        ? `tu pedido ${numeroOrden} fue enviado a evaluación. La evaluación está en proceso.`
        : `tu pedido ${numeroOrden} fue creado correctamente.`,
      mensajeVisual: requiereEvaluacion
        ? `tu pedido ${numeroOrden} fue enviado a evaluación. La evaluación está en proceso.`
        : `tu pedido ${numeroOrden} fue creado correctamente.`,
      rolDestinatario: 'usuario',
      idsDestinatarios: [idUsuario],
      prioridad: 'informativa',
      estado: 'no_leida',
      fechaCreacion: fechaActual,
      fechaEnvio: fechaActual,
      actorId: 'sistema',
      actorTipo: 'sistema',
      actorNombre: 'Tienda',
      actorFotoURL: null,
      entidadTipo: 'pedido',
      entidadId: ordenId,
      ruta: numeroOrden ? `/dashboard/order/${numeroOrden}` : '/dashboard/order',
      imagenTipo: 'icono',
      imagenURL: null,
      miniaturaURL: null,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver pedido',
      tipoAccionSecundaria: null,
      etiquetaAccionSecundaria: null,
      leidaPor: [],
      fechaProgramada: null,
      fechaExpiracion: null,
      fechaLectura: null,
      metadatos: baseMetadatos,
      creadoEnServidor: serverTimestamp(),
      actualizadoEnServidor: serverTimestamp(),
    });
  }

  await Promise.all(
    notificaciones.map((notificacion) =>
      setDoc(
        doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificacion.id),
        notificacion,
        { merge: true }
      )
    )
  );

  return notificaciones;
}

export async function crearNotificacionEvaluacionPedido({
  orden = {},
  tipo = 'rechazada',
  razon = '',
  usuario = {},
  metadatosExtra = {},
}) {
  asegurarFirebaseNotificaciones();

  const idUsuario = String(orden?.usuarioId || '').trim();

  if (!idUsuario) {
    return null;
  }

  const fechaActual = new Date().toISOString();
  const ordenId = orden?.ordenId || orden?.id || '';
  const { numeroOrden } = construirDescripcionPedido(orden);
  const esRechazo = tipo === 'rechazada';
  const estadoTexto = esRechazo ? 'fue rechazada.' : 'fue aprobado para compra';
  const mensaje = esRechazo
    ? `tu pedido ${numeroOrden} fue rechazado. Motivo: ${razon}. Presiona este número de orden para cargar el archivo faltante.`
    : `tu pedido ${numeroOrden} fue aprobado para compra.`;
  const notificationId = `pedido_${tipo}_${ordenId || Date.now()}_${idUsuario}`;

  const notificacion = {
    id: notificationId,
    tipoNotificacion: esRechazo ? 'pedido_cancelado' : 'pedido_confirmado',
    modulo: 'pedidos',
    titulo: esRechazo ? 'Pedido rechazado' : 'Pedido aceptado',
    tituloHtml: `<p><strong>${escapeHtml(numeroOrden)}</strong> ${escapeHtml(estadoTexto)}</p>`,
    mensaje,
    mensajeVisual: mensaje,
    rolDestinatario: 'usuario',
    idsDestinatarios: [idUsuario],
    prioridad: 'importante',
    estado: 'no_leida',
    fechaCreacion: fechaActual,
    fechaEnvio: fechaActual,
    actorId: String(usuario?.uid || usuario?.id || 'sistema'),
    actorTipo: 'admin',
    actorNombre: usuario?.displayName || usuario?.nombre || usuario?.email || 'Administración',
    actorFotoURL: usuario?.photoURL || null,
    entidadTipo: 'pedido',
    entidadId: ordenId,
    ruta: numeroOrden ? `/dashboard/order/${numeroOrden}` : '/dashboard/order',
    imagenTipo: 'icono',
    imagenURL: null,
    miniaturaURL: null,
    tipoAccion: 'ver',
    etiquetaAccion: 'Ver pedido',
    tipoAccionSecundaria: null,
    etiquetaAccionSecundaria: null,
    leidaPor: [],
    fechaProgramada: null,
    fechaExpiracion: null,
    fechaLectura: null,
    metadatos: {
      ordenId,
      numeroOrden,
      razon,
      estadoEvaluacion: tipo,
      miembroId: orden?.miembroId || orden?.customer?.memberId || null,
      ...metadatosExtra,
    },
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
    notificacion,
    { merge: true }
  );

  return notificacion;
}

export async function crearNotificacionArchivosFaltantesPedido({
  orden = {},
  archivos = [],
  usuario = {},
}) {
  asegurarFirebaseNotificaciones();

  const idsAdministradores = await obtenerIdsAdministradoresNotificaciones(usuario);

  if (!idsAdministradores.length) {
    return null;
  }

  const fechaActual = new Date().toISOString();
  const ordenId = orden?.ordenId || orden?.id || '';
  const { numeroOrden, clienteNombre } = construirDescripcionPedido(orden);
  const cantidadArchivos = archivos.length;
  const archivoTexto =
    cantidadArchivos === 1 ? 'un archivo faltante' : `${cantidadArchivos} archivos faltantes`;
  const actorNombre =
    usuario?.displayName || usuario?.nombre || clienteNombre || usuario?.email || 'Miembro';
  const notificationId = `pedido_archivos_faltantes_${ordenId || Date.now()}_${Date.now()}`;
  const mensaje = `cargó ${archivoTexto} para el pedido ${numeroOrden}.`;
  const notificacion = {
    id: notificationId,
    tipoNotificacion: 'pedido_recibido',
    modulo: 'pedidos',
    titulo: 'Archivos faltantes cargados',
    tituloHtml: `<p><strong>${escapeHtml(actorNombre)}</strong> cargó ${escapeHtml(archivoTexto)} para el pedido <strong>${escapeHtml(numeroOrden)}</strong></p>`,
    mensaje,
    mensajeVisual: mensaje,
    rolDestinatario: 'admin',
    idsDestinatarios: idsAdministradores,
    prioridad: 'importante',
    estado: 'no_leida',
    fechaCreacion: fechaActual,
    fechaEnvio: fechaActual,
    actorId: String(usuario?.uid || usuario?.id || orden?.usuarioId || 'sistema'),
    actorTipo: 'usuario',
    actorNombre,
    actorFotoURL: usuario?.photoURL || null,
    entidadTipo: 'pedido',
    entidadId: ordenId,
    ruta: ordenId ? `/dashboard/order/${ordenId}` : '/dashboard/order',
    imagenTipo: 'icono',
    imagenURL: null,
    miniaturaURL: null,
    tipoAccion: 'ver',
    etiquetaAccion: 'Ver pedido',
    tipoAccionSecundaria: null,
    etiquetaAccionSecundaria: null,
    leidaPor: [],
    fechaProgramada: null,
    fechaExpiracion: null,
    fechaLectura: null,
    metadatos: {
      ordenId,
      numeroOrden,
      cantidadArchivos,
      clienteNombre,
      miembroId: orden?.miembroId ?? usuario?.idMiembros ?? null,
    },
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
    notificacion,
    { merge: true }
  );

  return notificacion;
}

export async function crearNotificacionResenaProductoBaja({
  productId = '',
  productName = '',
  review = {},
  usuario = {},
}) {
  asegurarFirebaseNotificaciones();

  const idsAdministradores = await obtenerIdsAdministradoresNotificaciones(usuario);

  if (!idsAdministradores.length) {
    return null;
  }

  const fechaActual = new Date().toISOString();
  const reviewerName =
    review?.name ||
    review?.nombre ||
    usuario?.displayName ||
    usuario?.nombre ||
    usuario?.email ||
    'Usuario';
  const rating = Number(review?.rating ?? review?.calificacion ?? 0);
  const comment = review?.comment || review?.comentario || '';
  const productLabel = productName || `Producto ${productId || ''}`.trim() || 'Producto';
  const reviewId = review?.id || review?.resenaId || Date.now();
  const safeProductId = String(productId || 'producto').replace(/[/.]/g, '_');
  const safeReviewId = String(reviewId).replace(/[/.]/g, '_');
  const notificationId = `producto_resena_baja_${safeProductId}_${safeReviewId}`;
  const mensaje = `dejo una resena de ${rating || '-'} estrellas en ${productLabel}.`;

  const notificacion = {
    id: notificationId,
    tipoNotificacion: 'producto_resena_baja',
    modulo: 'productos',
    titulo: 'Resena baja recibida',
    tituloHtml: `<p><strong>${escapeHtml(reviewerName)}</strong> dejo una resena de <strong>${escapeHtml(rating || '-')} estrellas</strong> en <strong>${escapeHtml(productLabel)}</strong></p>`,
    mensaje,
    mensajeVisual: mensaje,
    rolDestinatario: 'admin',
    idsDestinatarios: idsAdministradores,
    prioridad: 'importante',
    estado: 'no_leida',
    fechaCreacion: fechaActual,
    fechaEnvio: fechaActual,
    actorId: String(usuario?.uid || usuario?.id || review?.email || 'usuario'),
    actorTipo: 'usuario',
    actorNombre: reviewerName,
    actorFotoURL: review?.avatarUrl || usuario?.photoURL || usuario?.avatarUrl || null,
    entidadTipo: 'producto',
    entidadId: productId || safeProductId,
    ruta: productId ? `/dashboard/product/${productId}` : '/dashboard/product',
    imagenTipo: 'icono',
    imagenURL: null,
    miniaturaURL: null,
    tipoAccion: 'ver',
    etiquetaAccion: 'Ver producto',
    tipoAccionSecundaria: null,
    etiquetaAccionSecundaria: null,
    leidaPor: [],
    fechaProgramada: null,
    fechaExpiracion: null,
    fechaLectura: null,
    metadatos: {
      productId,
      productName,
      reviewId,
      rating,
      reviewerName,
      comment,
    },
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
    notificacion,
    { merge: true }
  );

  return notificacion;
}

export async function crearNotificacionReportePublicacion({
  publicacion = {},
  razon = '',
  usuario = {},
}) {
  asegurarFirebaseNotificaciones();

  const idsAdministradores = await obtenerIdsAdministradoresNotificaciones(usuario);

  if (!idsAdministradores.length) {
    return null;
  }

  const fechaActual = new Date().toISOString();
  const idPublicacion =
    publicacion?.idPublicacion || publicacion?.id || publicacion?.postId || Date.now();
  const actorNombre =
    usuario?.displayName || usuario?.nombre || usuario?.email || usuario?.correo || 'Usuario';
  const actorId = String(usuario?.uid || usuario?.id || usuario?.idMiembros || 'usuario');
  const notificationId = `publicacion_reportada_${idPublicacion}_${Date.now()}`;
  const mensaje = `reporto una publicacion. Motivo: ${razon}.`;

  const notificacion = {
    id: notificationId,
    tipoNotificacion: 'publicacion_reportada',
    modulo: 'publicaciones',
    titulo: 'Publicacion reportada',
    tituloHtml: `<p><strong>${escapeHtml(actorNombre)}</strong> reporto una publicacion</p>`,
    mensaje,
    mensajeVisual: mensaje,
    rolDestinatario: 'admin',
    idsDestinatarios: idsAdministradores,
    prioridad: 'importante',
    estado: 'no_leida',
    fechaCreacion: fechaActual,
    fechaEnvio: fechaActual,
    actorId,
    actorTipo: 'usuario',
    actorNombre,
    actorFotoURL: usuario?.photoURL || null,
    entidadTipo: 'publicacion',
    entidadId: String(idPublicacion),
    ruta: publicacion?.url || '/dashboard/principal',
    imagenTipo: 'persona',
    imagenURL: usuario?.photoURL || null,
    miniaturaURL: usuario?.photoURL || null,
    tipoAccion: 'ver',
    etiquetaAccion: 'Ver publicacion',
    tipoAccionSecundaria: null,
    etiquetaAccionSecundaria: null,
    leidaPor: [],
    fechaProgramada: null,
    fechaExpiracion: null,
    fechaLectura: null,
    metadatos: {
      idPublicacion,
      razon,
      mensajePublicacion: publicacion?.mensaje || publicacion?.message || '',
      urlPublicacion: publicacion?.url || '',
    },
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
    notificacion,
    { merge: true }
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notificaciones:actualizar'));
  }

  return notificacion;
}

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

export const transformarNotificacionFirestoreADrawer = (id, notificacion = {}, idUsuario = '') => {
  const usuarioId = String(idUsuario || '').trim();
  const leidaPor = Array.isArray(notificacion.leidaPor) ? notificacion.leidaPor.map(String) : [];
  const leidaPorUsuario = Boolean(usuarioId && leidaPor.includes(usuarioId));
  const estado =
    leidaPorUsuario || notificacion.estado === 'leida'
      ? 'leida'
      : notificacion.estado || 'no_leida';

  return {
    id,
    idsNotificaciones: notificacion.idsNotificaciones || [id],
    avatarUrl: notificacion.imagenURL || notificacion.actorFotoURL || null,
    type: obtenerTipoVisualNotificacion(notificacion.tipoNotificacion),
    tipoNotificacion: notificacion.tipoNotificacion || '',
    category: obtenerCategoriaNotificacion(notificacion.modulo),
    estado,
    isUnRead: estado !== 'leida',
    createdAt: notificacion.fechaCreacion || notificacion.fechaEnvio || null,
    ruta: notificacion.ruta || null,
    entidadId: notificacion.entidadId || null,
    metadatos: notificacion.metadatos || {},
    title: construirTituloHtml(notificacion),
  };
};

const construirClaveGrupoNotificacion = (notificacion = {}) => {
  if (notificacion.tipoNotificacion !== 'mensaje_recibido') {
    return notificacion.id;
  }

  return [
    notificacion.tipoNotificacion,
    notificacion.metadatos?.idConversacion || notificacion.entidadId,
    notificacion.metadatos?.remitenteIdMiembros || notificacion.actorId,
  ]
    .filter(Boolean)
    .join('_');
};

const agruparNotificacionesMensaje = (notificaciones = []) => {
  const grouped = new Map();

  notificaciones.forEach((notificacion) => {
    const key = construirClaveGrupoNotificacion(notificacion);

    if (notificacion.tipoNotificacion !== 'mensaje_recibido') {
      grouped.set(key, notificacion);
      return;
    }

    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, {
        ...notificacion,
        idsNotificaciones: [notificacion.id],
        cantidadMensajes: 1,
      });
      return;
    }

    const cantidadMensajes = Number(current.cantidadMensajes || 1) + 1;
    const newest =
      String(notificacion.fechaCreacion || '').localeCompare(String(current.fechaCreacion || '')) >
      0
        ? notificacion
        : current;
    const hasUnread = current.estado !== 'leida' || notificacion.estado !== 'leida';

    grouped.set(key, {
      ...current,
      ...newest,
      idsNotificaciones: [...(current.idsNotificaciones || [current.id]), notificacion.id],
      cantidadMensajes,
      estado: hasUnread ? 'no_leida' : 'leida',
      tituloHtml:
        cantidadMensajes > 1
          ? `<p><strong>${escapeHtml(newest.actorNombre || 'Usuario')}</strong> te envió ${cantidadMensajes} mensajes</p>`
          : newest.tituloHtml,
      metadatos: {
        ...(current.metadatos || {}),
        ...(newest.metadatos || {}),
        cantidadMensajes,
      },
    });
  });

  return Array.from(grouped.values()).sort((a, b) =>
    String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || ''))
  );
};

const publicarRecordatoriosPublicacionVencidos = async (idUsuario) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idUsuario) {
    return;
  }

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCIONES_NOTIFICACIONES.tareas),
      where('idsDestinatarios', 'array-contains', String(idUsuario))
    )
  ).catch(() => ({ docs: [] }));
  const ahora = Date.now();
  const tareas = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter(
      (tarea) =>
        tarea.tipoTarea === 'recordatorio_publicacion' &&
        tarea.estado === 'pendiente' &&
        tarea.fechaProgramada &&
        new Date(tarea.fechaProgramada).getTime() <= ahora
    );

  await Promise.all(
    tareas.map(async (tarea) => {
      const fechaActual = new Date().toISOString();
      const notificationId = `recordatorio_publicacion_${tarea.idTarea || tarea.id}`;
      const mensaje = 'Tienes una publicacion guardada para recordar.';

      await setDoc(
        doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
        {
          id: notificationId,
          tipoNotificacion: 'recordatorio_publicacion',
          modulo: 'publicaciones',
          titulo: 'Recordatorio de publicacion',
          tituloHtml: '<p><strong>Recordatorio</strong> de publicacion</p>',
          mensaje,
          mensajeVisual: mensaje,
          rolDestinatario: tarea.rolDestinatario || 'usuario',
          idsDestinatarios: tarea.idsDestinatarios || [String(idUsuario)],
          prioridad: 'informativa',
          estado: 'no_leida',
          fechaCreacion: fechaActual,
          fechaEnvio: fechaActual,
          actorId: String(tarea.usuarioIdMiembros || idUsuario),
          actorTipo: 'sistema',
          actorNombre: 'Recordatorio',
          actorFotoURL: tarea.fotoUsuarioURL || null,
          entidadTipo: 'publicacion',
          entidadId: String(tarea.idPublicacion || ''),
          ruta: tarea.ruta || `/dashboard/principal/#post-${tarea.idPublicacion}`,
          imagenTipo: 'icono',
          imagenURL: null,
          miniaturaURL: null,
          tipoAccion: 'ver',
          etiquetaAccion: 'Ver publicacion',
          tipoAccionSecundaria: null,
          etiquetaAccionSecundaria: null,
          leidaPor: [],
          fechaProgramada: tarea.fechaProgramada,
          fechaExpiracion: null,
          fechaLectura: null,
          metadatos: {
            ...(tarea.metadatos || {}),
            idTarea: tarea.idTarea || tarea.id,
            canales: tarea.canales || {},
          },
          creadoEnServidor: serverTimestamp(),
          actualizadoEnServidor: serverTimestamp(),
        },
        { merge: true }
      );

      await updateDoc(doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.tareas, tarea.idTarea || tarea.id), {
        estado: 'enviada',
        fechaEnvio: fechaActual,
        actualizadoEnServidor: serverTimestamp(),
      }).catch(() => null);
    })
  );

  if (tareas.length && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notificaciones:actualizar'));
  }
};

export async function listarNotificacionesFirestorePorUsuario(idUsuario) {
  if (!isFirebaseConfigured || !FIRESTORE || !idUsuario) {
    return [];
  }

  await publicarRecordatoriosPublicacionVencidos(idUsuario);

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

const esRolAdmin = (usuario = {}) => {
  const role = String(usuario?.role ?? usuario?.rol ?? '').toLowerCase();

  return role === 'admin' || role === 'administrador';
};

export async function listarNotificacionesFirestoreParaUsuario(usuario = {}) {
  const idUsuario = usuario?.uid || usuario?.id;
  const notificaciones = await listarNotificacionesFirestorePorUsuario(idUsuario);
  const usuarioEsAdmin = esRolAdmin(usuario);

  return notificaciones.filter((notificacion) => {
    const rolDestinatario = String(notificacion.rolDestinatario ?? '').toLowerCase();

    if (rolDestinatario === 'admin') return usuarioEsAdmin;
    if (rolDestinatario === 'usuario') return !usuarioEsAdmin;

    return true;
  });
}

export async function listarNotificacionesDrawerPorUsuario(idUsuario) {
  const notificaciones = await listarNotificacionesFirestorePorUsuario(idUsuario);
  return agruparNotificacionesMensaje(notificaciones).map((item) =>
    transformarNotificacionFirestoreADrawer(item.id, item, idUsuario)
  );
}

export async function listarNotificacionesDrawerParaUsuario(usuario = {}) {
  const notificaciones = await listarNotificacionesFirestoreParaUsuario(usuario);
  const idUsuario = usuario?.uid || usuario?.id || '';

  return agruparNotificacionesMensaje(notificaciones).map((item) =>
    transformarNotificacionFirestoreADrawer(item.id, item, idUsuario)
  );
}

export async function marcarNotificacionComoLeida(notificationId, idUsuario = '') {
  asegurarFirebaseNotificaciones();

  const notificationIds = Array.isArray(notificationId) ? notificationId : [notificationId];
  const usuarioId = String(idUsuario || '').trim();

  if (!notificationIds.filter(Boolean).length) {
    return;
  }

  await Promise.all(
    notificationIds.filter(Boolean).map((id) =>
      updateDoc(doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, id), {
        ...(usuarioId ? { leidaPor: arrayUnion(usuarioId) } : { estado: 'leida' }),
        fechaLectura: new Date().toISOString(),
        actualizadoEnServidor: serverTimestamp(),
      })
    )
  );
}

export async function marcarNotificacionesComoLeidasPorUsuario(idUsuario) {
  asegurarFirebaseNotificaciones();

  if (!idUsuario) {
    return;
  }

  const notificaciones = await listarNotificacionesFirestorePorUsuario(idUsuario);
  const usuarioId = String(idUsuario || '').trim();

  await Promise.all(
    notificaciones.map((notificacion) =>
      updateDoc(doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificacion.id), {
        ...(usuarioId ? { leidaPor: arrayUnion(usuarioId) } : { estado: 'leida' }),
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
