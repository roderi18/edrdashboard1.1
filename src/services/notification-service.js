import {
  doc,
  query,
  where,
  getDoc,
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
  chat_reportado: 'chat',
  cuenta_creada: 'mail',
  cumpleanos_miembro_7_dias: 'mail',
  cumpleanos_miembro_hoy: 'mail',
  error_subida_archivo_imagen: 'file',
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
  permisos_cambiados: 'project',
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

// El titulo pone SIEMPRE en negrita a quien actua, y algunas plantillas ya
// empiezan por su nombre ("{{actorNombre}} registró a ..."). Sin esto salia
// "Rodery Peña Rodery Peña registró a ...": el nombre dos veces seguidas.
const componerTituloHtml = (actorNombre, mensaje) => {
  const nombre = String(actorNombre || 'Sistema').trim();
  const texto = String(mensaje || '').trim();

  if (nombre && texto.toLowerCase().startsWith(nombre.toLowerCase())) {
    return `<p><strong>${escapeHtml(nombre)}</strong>${escapeHtml(texto.slice(nombre.length))}</p>`;
  }

  return `<p><strong>${escapeHtml(nombre)}</strong> ${escapeHtml(texto)}</p>`;
};

// Quien hizo la accion no necesita que se la cuenten en tercera persona: "Se
// registró a Fulano exitosamente" en vez de "Fulano Mengano registró a Fulano".
// El aviso es UN documento para varios destinatarios, asi que la version propia
// viaja dentro y se elige al pintarla.
const construirTituloHtml = (notificacion, idUsuario = '') => {
  const usuarioId = String(idUsuario || '').trim();
  const esElActor = Boolean(usuarioId) && String(notificacion.actorId || '') === usuarioId;

  if (esElActor && notificacion.tituloHtmlPropio) {
    return notificacion.tituloHtmlPropio;
  }

  if (notificacion.tituloHtml) {
    return notificacion.tituloHtml;
  }

  const mensaje =
    notificacion.mensajeVisual ||
    notificacion.mensaje ||
    notificacion.titulo ||
    'Tienes una nueva notificación.';

  return componerTituloHtml(notificacion.actorNombre, mensaje);
};

const renderTemplate = (template = '', values = {}) =>
  String(template || '').replace(/{{\s*([^}]+)\s*}}/g, (match, key) => {
    const value = values[String(key).trim()];
    return value === undefined || value === null ? '' : String(value);
  });

const obtenerConfiguracionNotificacion = async (tipoNotificacion) => {
  if (!tipoNotificacion) {
    return { tipo: null, plantilla: null };
  }

  const [tipoSnap, plantillaSnap] = await Promise.all([
    getDoc(doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.tipos, tipoNotificacion)).catch(() => null),
    getDoc(doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.plantillas, tipoNotificacion)).catch(
      () => null
    ),
  ]);

  return {
    tipo: tipoSnap?.exists() ? tipoSnap.data() : null,
    plantilla: plantillaSnap?.exists() ? plantillaSnap.data() : null,
  };
};

const filtrarDestinatariosPorPreferencias = async ({
  idsDestinatarios = [],
  tipoNotificacion,
  modulo,
}) => {
  const uniqueIds = [...new Set(idsDestinatarios.map(String).filter(Boolean))];

  if (!uniqueIds.length) {
    return [];
  }

  const preferences = await Promise.all(
    uniqueIds.map(async (idUsuario) => {
      const snapshot = await getDoc(
        doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.preferencias, idUsuario)
      ).catch(() => null);

      return {
        idUsuario,
        data: snapshot?.exists() ? snapshot.data() : null,
      };
    })
  );

  return preferences
    .filter(({ data }) => {
      if (!data) return true;
      if (data.tiposNotificacion?.[tipoNotificacion] === false) return false;
      if (modulo && data.modulos?.[modulo] === false) return false;

      return true;
    })
    .map(({ idUsuario }) => idUsuario);
};

export const resolverNotificacionConConfiguracion = async (notificacion = {}) => {
  const { tipo: tipoConfig, plantilla: plantillaConfig } =
    await obtenerConfiguracionNotificacion(notificacion.tipoNotificacion);

  if (tipoConfig?.activa === false || plantillaConfig?.activa === false) {
    return null;
  }

  if (
    Array.isArray(tipoConfig?.rolesDisponibles) &&
    !tipoConfig.rolesDisponibles.includes(notificacion.rolDestinatario)
  ) {
    return null;
  }

  const modulo = tipoConfig?.modulo || plantillaConfig?.modulo || notificacion.modulo;
  const idsDestinatarios = await filtrarDestinatariosPorPreferencias({
    idsDestinatarios: notificacion.idsDestinatarios || [],
    tipoNotificacion: notificacion.tipoNotificacion,
    modulo,
  });

  if (!idsDestinatarios.length) {
    return null;
  }

  const templateValues = {
    ...(notificacion.metadatos || {}),
    actorNombre: notificacion.actorNombre,
    entidadId: notificacion.entidadId,
    titulo: notificacion.titulo,
    mensaje: notificacion.mensaje,
  };
  const mensajePlantilla = renderTemplate(plantillaConfig?.mensajePlantilla, templateValues);
  const mensaje = mensajePlantilla || notificacion.mensaje;
  const actorNombre = notificacion.actorNombre || 'Sistema';

  return {
    ...notificacion,
    modulo,
    idsDestinatarios,
    titulo: plantillaConfig?.tituloPlantilla || tipoConfig?.titulo || notificacion.titulo,
    tituloHtml: plantillaConfig?.mensajePlantilla
      ? componerTituloHtml(actorNombre, mensaje)
      : notificacion.tituloHtml,
    mensaje,
    mensajeVisual: notificacion.mensajeVisual === notificacion.mensaje ? mensaje : notificacion.mensajeVisual,
    prioridad:
      plantillaConfig?.prioridadPorDefecto ||
      tipoConfig?.prioridadPorDefecto ||
      notificacion.prioridad,
    tipoAccion: plantillaConfig?.tipoAccionPorDefecto || notificacion.tipoAccion,
    etiquetaAccion: plantillaConfig?.etiquetaAccionPorDefecto || notificacion.etiquetaAccion,
  };
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
  idMiembros: Number(miembro.id ?? miembro.idMiembros ?? 0),
  codigoMiembro: miembro.memberId || miembro.codigoMiembro || '',
  nombres: miembro.firstName || miembro.nombres || '',
  apellidos: miembro.lastName || miembro.apellidos || '',
  genero: miembro.gender || miembro.genero || '',
  fechaNacimiento: miembro.birthDate || miembro.fechaNacimiento || null,
  idDestacamento: Number(miembro.idDestacamento || miembro.destId || 0),
  telefono: miembro.phoneNumber || miembro.telefono || '',
  direccion: miembro.memberAddress || miembro.direccion || '',
  correo: miembro.email || miembro.correo || '',
  idDivision: Number(miembro.idDivision || 0),
  instructorCertificadoCi: Boolean(miembro.InstructorCertificadoCI ?? miembro.instructorCertificadoCi),
  estatusVigenciaCi: Boolean(miembro.EstatusVigenciaCI ?? miembro.estatusVigenciaCi),
  fechaInicioCertificado: miembro.FechaInicioCI || miembro.fechaInicioCertificado || null,
  fechaFinCertificado: miembro.FechaVencimientoCI || miembro.fechaFinCertificado || null,
  estatusMiembro: miembro.status || miembro.estatusMiembro || 'active',
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

        const id = data.uid ?? data.idUsuario ?? data.idMiembros ?? item.id;

        if (id) {
          ids.add(String(id));
        }
      });
    } catch (error) {
      console.warn(`[notifications] no se pudo leer ${collectionName}`, error);
    }
  };

  await Promise.all([leerColeccion('admins'), leerColeccion('users'), leerColeccion('usuarios_roles')]);

  return Array.from(ids);
};

const isAdminRole = (value = '') => {
  const role = String(value || '').toLowerCase();

  return role === 'admin' || role === 'administrador' || role === 'administrator';
};

const obtenerUsuariosNoAdminNotificaciones = async ({ destacamentoId = null, alcance = null } = {}) => {
  const usuarios = new Map();
  const nivelAlcance = alcance?.nivel || alcance?.level || (destacamentoId ? 'mi-destacamento' : 'nacional');
  const idAlcance = String(alcance?.id || alcance?.value || alcance?.valor || destacamentoId || '').trim();
  const targetDest = nivelAlcance === 'mi-destacamento' ? idAlcance : '';

  const getProfileDestIds = (data = {}) => [
    data.idDestacamento,
    data.destId,
    data.destacamentoId,
    ...(Array.isArray(data.alcance?.destacamentos) ? data.alcance.destacamentos : []),
  ].map((value) => String(value || '').trim()).filter(Boolean);

  const addUser = (data = {}, fallbackId = '') => {
    const rol = data.rol ?? data.role ?? data.tipoUsuario ?? '';

    if (isAdminRole(rol)) return;

    const idUsuario = String(data.uid || data.idUsuario || fallbackId || '').trim();

    if (!idUsuario) return;

    const destIds = getProfileDestIds(data);

    if (targetDest && !destIds.includes(targetDest)) return;
    if (nivelAlcance === 'regional') {
      const regiones = [
        data.idRegional,
        data.regionalId,
        data.regionId,
        ...(Array.isArray(data.alcance?.regiones) ? data.alcance.regiones : []),
      ].map((value) => String(value || '').trim()).filter(Boolean);

      if (idAlcance && !regiones.includes(idAlcance)) return;
    }
    if (nivelAlcance === 'seccional') {
      const secciones = [
        data.idSeccion,
        data.idSeccional,
        data.sectionalId,
        ...(Array.isArray(data.alcance?.secciones) ? data.alcance.secciones : []),
      ].map((value) => String(value || '').trim()).filter(Boolean);

      if (idAlcance && !secciones.includes(idAlcance)) return;
    }

    usuarios.set(idUsuario, {
      idUsuario,
      idMiembros: data.idMiembros || data.memberId || null,
      codigoMiembro: data.codigoMiembro || data.memberId || '',
      nombre: data.nombre || data.displayName || data.name || '',
      correo: data.correo || data.email || '',
      destIds,
    });
  };

  await Promise.all(
    ['users', 'usuarios_roles'].map(async (collectionName) => {
      const snapshot = await getDocs(collection(FIRESTORE, collectionName)).catch(() => null);

      snapshot?.docs?.forEach((item) => addUser(item.data() || {}, item.id));
    })
  );

  return Array.from(usuarios.values());
};

const obtenerIdUsuarioNotificaciones = (usuario = {}) =>
  String(usuario?.uid || usuario?.id || usuario?.usuarioId || '').trim();

const resolverIdsDestinatariosUsuario = async ({ usuario = {}, idsDestinatarios = null } = {}) => {
  const directIds = [
    ...(Array.isArray(idsDestinatarios) ? idsDestinatarios : []),
    usuario?.uid,
    usuario?.idUsuario,
    usuario?.usuarioId,
  ].map((value) => String(value || '').trim()).filter(Boolean);

  if (directIds.length) {
    return [...new Set(directIds)];
  }

  const idMiembros = usuario?.idMiembros || usuario?.memberId || usuario?.id;
  const codigoMiembro = usuario?.codigoMiembro || usuario?.memberId || usuario?.codigo;
  const correo = usuario?.correo || usuario?.email;
  const matches = new Set();

  await Promise.all(
    ['users', 'usuarios_roles'].map(async (collectionName) => {
      const snapshot = await getDocs(collection(FIRESTORE, collectionName)).catch(() => null);

      snapshot?.docs?.forEach((item) => {
        const data = item.data() || {};
        const sameMember =
          idMiembros && String(data.idMiembros || data.memberId || '') === String(idMiembros);
        const sameCode =
          codigoMiembro && String(data.codigoMiembro || data.memberId || '') === String(codigoMiembro);
        const sameEmail = correo && String(data.correo || data.email || '') === String(correo);

        if (sameMember || sameCode || sameEmail) {
          const idUsuario = data.uid || data.idUsuario || item.id;

          if (idUsuario) {
            matches.add(String(idUsuario));
          }
        }
      });
    })
  );

  return Array.from(matches);
};

const obtenerUsuariosConProductoEnCarrito = async (producto = {}) => {
  const productId = String(obtenerIdProducto(producto) || '').trim();
  const sku = String(producto?.sku || '').trim();

  if (!productId && !sku) {
    return [];
  }

  const snapshot = await getDocs(collection(FIRESTORE, 'carritos')).catch(() => null);
  const ids = new Set();

  snapshot?.docs?.forEach((item) => {
    const data = item.data() || {};
    const hasProduct = (data.items || []).some((cartItem) => {
      const cartProductId = String(cartItem?.productoId || cartItem?.id || '').trim();
      const cartSku = String(cartItem?.sku || '').trim();

      return (productId && cartProductId === productId) || (sku && cartSku === sku);
    });

    if (!hasProduct) return;

    const idUsuario = data.usuarioId || item.id;

    if (idUsuario) {
      ids.add(String(idUsuario));
    }
  });

  return Array.from(ids);
};

export async function crearNotificacionUsuario({
  tipoNotificacion,
  modulo = 'general',
  titulo = 'Nueva notificacion',
  tituloHtml = null,
  mensaje = '',
  mensajeVisual = null,
  prioridad = 'informativa',
  actorId = 'sistema',
  actorTipo = 'sistema',
  actorNombre = 'Sistema',
  actorFotoURL = null,
  entidadTipo = 'general',
  entidadId = '',
  ruta = '/dashboard',
  imagenTipo = 'icono',
  imagenURL = null,
  miniaturaURL = null,
  tipoAccion = 'ver',
  etiquetaAccion = 'Ver',
  metadatos = {},
  usuario = {},
  idsDestinatarios = null,
  notificationId = null,
}) {
  asegurarFirebaseNotificaciones();

  const resolvedIds = await resolverIdsDestinatariosUsuario({ usuario, idsDestinatarios });

  if (!resolvedIds.length) {
    return null;
  }

  const fechaActual = new Date().toISOString();
  const resolvedNotificationId =
    notificationId || `${tipoNotificacion}_${sanitizeNotificationIdPart(entidadId)}_${Date.now()}`;
  const notificacion = {
    id: resolvedNotificationId,
    tipoNotificacion,
    modulo,
    titulo,
    tituloHtml,
    mensaje,
    mensajeVisual: mensajeVisual || mensaje,
    rolDestinatario: 'usuario',
    idsDestinatarios: resolvedIds,
    prioridad,
    estado: 'no_leida',
    fechaCreacion: fechaActual,
    fechaEnvio: fechaActual,
    actorId: String(actorId || 'sistema'),
    actorTipo,
    actorNombre,
    actorFotoURL,
    entidadTipo,
    entidadId,
    ruta,
    imagenTipo,
    imagenURL,
    miniaturaURL,
    tipoAccion,
    etiquetaAccion,
    tipoAccionSecundaria: null,
    etiquetaAccionSecundaria: null,
    leidaPor: [],
    fechaProgramada: null,
    fechaExpiracion: null,
    fechaLectura: null,
    metadatos,
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };
  const notificacionConfigurada = await resolverNotificacionConConfiguracion(notificacion);

  if (!notificacionConfigurada) {
    return null;
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificacionConfigurada.id),
    notificacionConfigurada,
    { merge: true }
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notificaciones:actualizar'));
  }

  return notificacionConfigurada;
}

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

const sanitizeNotificationIdPart = (value = '') =>
  String(value || Date.now()).replace(/[/.#[\]]/g, '_');

export async function crearNotificacionAdmin({
  tipoNotificacion,
  modulo = 'administradores',
  titulo = 'Nueva notificacion',
  tituloHtml = null,
  mensaje = '',
  mensajeVisual = null,
  prioridad = 'informativa',
  actorId = null,
  actorTipo = null,
  actorNombre = null,
  actorFotoURL = null,
  entidadTipo = 'general',
  entidadId = '',
  ruta = '/dashboard',
  imagenTipo = 'icono',
  imagenURL = null,
  miniaturaURL = null,
  tipoAccion = 'ver',
  etiquetaAccion = 'Ver',
  metadatos = {},
  usuario = {},
  notificationId = null,
  idsDestinatariosPrecalculados = null,
}) {
  asegurarFirebaseNotificaciones();

  const idsDestinatarios =
    idsDestinatariosPrecalculados || (await obtenerIdsAdministradoresNotificaciones(usuario));

  if (!idsDestinatarios.length) {
    return null;
  }

  const fechaActual = new Date().toISOString();
  const resolvedActorNombre =
    actorNombre ||
    usuario?.displayName ||
    usuario?.nombre ||
    usuario?.email ||
    usuario?.correo ||
    'Sistema';
  const { tipo: tipoConfig, plantilla: plantillaConfig } =
    await obtenerConfiguracionNotificacion(tipoNotificacion);

  if (tipoConfig?.activa === false || plantillaConfig?.activa === false) {
    return null;
  }

  if (Array.isArray(tipoConfig?.rolesDisponibles) && !tipoConfig.rolesDisponibles.includes('admin')) {
    return null;
  }

  const resolvedModulo = tipoConfig?.modulo || plantillaConfig?.modulo || modulo;
  const templateValues = {
    ...metadatos,
    actorNombre: resolvedActorNombre,
    entidadId,
    titulo,
    mensaje,
  };
  const resolvedTitulo = plantillaConfig?.tituloPlantilla || tipoConfig?.titulo || titulo;
  const resolvedMensaje =
    renderTemplate(plantillaConfig?.mensajePlantilla, templateValues) || mensaje;
  const resolvedPrioridad =
    plantillaConfig?.prioridadPorDefecto || tipoConfig?.prioridadPorDefecto || prioridad;
  const resolvedTipoAccion = plantillaConfig?.tipoAccionPorDefecto || tipoAccion;
  const resolvedEtiquetaAccion = plantillaConfig?.etiquetaAccionPorDefecto || etiquetaAccion;
  const resolvedIdsDestinatarios = await filtrarDestinatariosPorPreferencias({
    idsDestinatarios,
    tipoNotificacion,
    modulo: resolvedModulo,
  });

  if (!resolvedIdsDestinatarios.length) {
    return null;
  }

  const resolvedNotificationId =
    notificationId ||
    `${tipoNotificacion}_${sanitizeNotificationIdPart(entidadId)}_${Date.now()}`;
  const notificacion = {
    id: resolvedNotificationId,
    tipoNotificacion,
    modulo: resolvedModulo,
    titulo: resolvedTitulo,
    tituloHtml: plantillaConfig?.mensajePlantilla
      ? `<p><strong>${escapeHtml(resolvedActorNombre)}</strong> ${escapeHtml(resolvedMensaje)}</p>`
      : tituloHtml,
    mensaje: resolvedMensaje,
    mensajeVisual: mensajeVisual || resolvedMensaje,
    rolDestinatario: 'admin',
    idsDestinatarios: resolvedIdsDestinatarios,
    prioridad: resolvedPrioridad,
    estado: 'no_leida',
    fechaCreacion: fechaActual,
    fechaEnvio: fechaActual,
    actorId: String(actorId || usuario?.uid || usuario?.id || 'sistema'),
    actorTipo: actorTipo || (usuario?.role === 'admin' ? 'admin' : 'sistema'),
    actorNombre: resolvedActorNombre,
    actorFotoURL: actorFotoURL ?? usuario?.photoURL ?? usuario?.avatarUrl ?? null,
    entidadTipo,
    entidadId,
    ruta,
    imagenTipo,
    imagenURL,
    miniaturaURL,
    tipoAccion: resolvedTipoAccion,
    etiquetaAccion: resolvedEtiquetaAccion,
    tipoAccionSecundaria: null,
    etiquetaAccionSecundaria: null,
    leidaPor: [],
    fechaProgramada: null,
    fechaExpiracion: null,
    fechaLectura: null,
    metadatos,
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };
  const notificacionConfigurada = await resolverNotificacionConConfiguracion(notificacion);

  if (!notificacionConfigurada) {
    return null;
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, resolvedNotificationId),
    notificacionConfigurada,
    { merge: true }
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notificaciones:actualizar'));
  }

  return notificacionConfigurada;
}

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
    tituloHtml: `<p><strong>${escapeHtml(actorNombre)}</strong> registró a ${escapeHtml(nombreMiembro)}.</p>`,
    // La lee quien hizo el registro; el resto de coordinadores y administradores
    // ven arriba quien fue.
    tituloHtmlPropio: `<p>Se registró a <strong>${escapeHtml(nombreMiembro)}</strong> exitosamente.</p>`,
    mensaje: `registró a ${nombreMiembro}.`,
    mensajeVisual: `registró a ${nombreMiembro}.`,
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

  const notificacionConfigurada = await resolverNotificacionConConfiguracion(notificacion);

  if (!notificacionConfigurada) {
    return null;
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
    notificacionConfigurada,
    { merge: true }
  );

  return notificacionConfigurada;
}

export async function crearNotificacionMiembroActualizado({ miembro = {}, usuario = {} }) {
  const idMiembro = Number(miembro.id ?? miembro.idMiembros ?? 0);
  const codigoMiembro = miembro.memberId || miembro.codigoMiembro || '';
  const nombreMiembro =
    construirNombreCompletoMiembro(miembro) || codigoMiembro || `Miembro ${idMiembro}`;
  const fotoMiembro = miembro?.avatarUrl || miembro?.photoURL || null;

  return crearNotificacionAdmin({
    tipoNotificacion: 'miembro_actualizado',
    modulo: 'miembros',
    titulo: 'Miembro actualizado',
    tituloHtml: `<p><strong>${escapeHtml(nombreMiembro)}</strong> fue actualizado</p>`,
    mensaje: `actualizo la informacion de ${nombreMiembro}.`,
    prioridad: 'informativa',
    entidadTipo: 'miembro',
    entidadId: idMiembro || codigoMiembro,
    ruta: idMiembro ? `/dashboard/level/member/${idMiembro}/edit` : '/dashboard/level/member',
    imagenTipo: 'persona',
    imagenURL: fotoMiembro,
    miniaturaURL: fotoMiembro,
    etiquetaAccion: 'Ver miembro',
    metadatos: construirMetadatosMiembro(miembro),
    usuario,
    notificationId: `miembro_actualizado_${idMiembro || sanitizeNotificationIdPart(codigoMiembro)}_${Date.now()}`,
  });
}

export async function crearNotificacionCuentaCreada({ cuenta = {}, usuario = {} }) {
  const idCuenta = cuenta?.uid || cuenta?.id || cuenta?.idMiembros || cuenta?.codigoMiembro || Date.now();
  const nombreCuenta =
    cuenta?.displayName ||
    cuenta?.nombre ||
    construirNombreCompletoMiembro(cuenta) ||
    cuenta?.email ||
    cuenta?.correo ||
    `Cuenta ${idCuenta}`;

  // A LOS ADMINISTRADORES NO SE LES AVISA DOS VECES.
  //
  // La cuenta de acceso se crea junto con el miembro, asi que este aviso salia
  // pegado al de "registró a Fulano" y contaba lo mismo. Queda solo el del alta
  // del miembro; el de la cuenta se lo queda su dueño.
  const userNotification = await crearNotificacionUsuario({
    tipoNotificacion: 'cuenta_creada',
    modulo: 'cuentas',
    titulo: 'Cuenta creada',
    tituloHtml: `<p><strong>${escapeHtml(nombreCuenta)}</strong> tu cuenta fue creada correctamente</p>`,
    mensaje: `tu cuenta fue creada correctamente.`,
    prioridad: 'informativa',
    actorId: String(usuario?.uid || usuario?.id || 'sistema'),
    actorTipo: 'sistema',
    actorNombre: 'Exploradores del Rey',
    entidadTipo: 'cuenta',
    entidadId: String(idCuenta),
    ruta: '/dashboard/user/account',
    imagenTipo: 'persona',
    imagenURL: cuenta?.photoURL || cuenta?.avatarUrl || null,
    miniaturaURL: cuenta?.photoURL || cuenta?.avatarUrl || null,
    etiquetaAccion: 'Ver cuenta',
    metadatos: {
      nombreUsuario: nombreCuenta,
      uid: cuenta?.uid || null,
      email: cuenta?.email || cuenta?.correo || null,
      codigoMiembro: cuenta?.codigoMiembro || cuenta?.memberId || null,
      idMiembros: cuenta?.idMiembros || cuenta?.id || null,
    },
    usuario: cuenta,
    notificationId: `cuenta_creada_usuario_${sanitizeNotificationIdPart(idCuenta)}`,
  });

  return [userNotification].filter(Boolean);
}

export async function crearNotificacionPerfilActualizado({ perfil = {}, usuario = {} }) {
  const idMiembro = Number(perfil.idMiembros ?? perfil.id ?? usuario?.idMiembros ?? 0);
  const nombrePerfil =
    perfil?.nombre ||
    perfil?.displayName ||
    construirNombreCompletoMiembro(perfil) ||
    usuario?.displayName ||
    usuario?.email ||
    `Miembro ${idMiembro}`;

  const adminNotification = await crearNotificacionAdmin({
    tipoNotificacion: 'perfil_actualizado',
    modulo: 'miembros',
    titulo: 'Perfil actualizado',
    tituloHtml: `<p><strong>${escapeHtml(nombrePerfil)}</strong> actualizo su perfil</p>`,
    mensaje: `actualizo su perfil de usuario.`,
    prioridad: 'informativa',
    actorTipo: 'usuario',
    entidadTipo: 'miembro',
    entidadId: idMiembro || perfil?.codigoMiembro || usuario?.uid || '',
    ruta: idMiembro ? `/dashboard/level/member/${idMiembro}/edit` : '/dashboard/user/account',
    imagenTipo: 'persona',
    imagenURL: perfil?.avatarUrl || perfil?.photoURL || usuario?.photoURL || null,
    miniaturaURL: perfil?.avatarUrl || perfil?.photoURL || usuario?.photoURL || null,
    etiquetaAccion: 'Ver perfil',
    metadatos: {
      ...construirMetadatosMiembro(perfil),
      origen: perfil?.origen || 'perfil',
    },
    usuario,
    notificationId: `perfil_actualizado_${sanitizeNotificationIdPart(idMiembro || usuario?.uid)}_${Date.now()}`,
  });
  const userNotification = await crearNotificacionUsuario({
    tipoNotificacion: 'perfil_actualizado',
    modulo: 'miembros',
    titulo: 'Perfil actualizado',
    tituloHtml: `<p><strong>${escapeHtml(nombrePerfil)}</strong> tu perfil fue actualizado</p>`,
    mensaje: 'tu perfil fue actualizado correctamente.',
    prioridad: 'informativa',
    actorId: String(usuario?.uid || usuario?.id || 'sistema'),
    actorTipo: 'sistema',
    actorNombre: 'Exploradores del Rey',
    actorFotoURL: perfil?.avatarUrl || perfil?.photoURL || usuario?.photoURL || null,
    entidadTipo: 'miembro',
    entidadId: idMiembro || perfil?.codigoMiembro || usuario?.uid || '',
    ruta: '/dashboard/user/account',
    imagenTipo: 'persona',
    imagenURL: perfil?.avatarUrl || perfil?.photoURL || usuario?.photoURL || null,
    miniaturaURL: perfil?.avatarUrl || perfil?.photoURL || usuario?.photoURL || null,
    etiquetaAccion: 'Ver perfil',
    metadatos: {
      ...construirMetadatosMiembro(perfil),
      nombreUsuario: nombrePerfil,
      origen: perfil?.origen || 'perfil',
    },
    usuario: {
      ...usuario,
      ...perfil,
    },
    notificationId: `perfil_actualizado_usuario_${sanitizeNotificationIdPart(idMiembro || usuario?.uid)}_${Date.now()}`,
  });

  return [adminNotification, userNotification].filter(Boolean);
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

  const notificacionesConfiguradas = (
    await Promise.all(
      notificaciones.map((notificacion) => resolverNotificacionConConfiguracion(notificacion))
    )
  ).filter(Boolean);

  await Promise.all(
    notificacionesConfiguradas.map((notificacion) =>
      setDoc(
        doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificacion.id),
        notificacion,
        { merge: true }
      )
    )
  );

  return notificacionesConfiguradas;
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

  const notificacionConfigurada = await resolverNotificacionConConfiguracion(notificacion);

  if (!notificacionConfigurada) {
    return null;
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
    notificacionConfigurada,
    { merge: true }
  );

  return notificacionConfigurada;
}

export async function crearNotificacionPedidoCanceladoAdmin({
  orden = {},
  razon = '',
  usuario = {},
}) {
  const ordenId = orden?.ordenId || orden?.id || '';
  const { numeroOrden, clienteNombre, monto, cantidad } = construirDescripcionPedido(orden);
  const mensaje = razon
    ? `cancelo el pedido ${numeroOrden}. Motivo: ${razon}.`
    : `cancelo el pedido ${numeroOrden}.`;

  return crearNotificacionAdmin({
    tipoNotificacion: 'pedido_cancelado',
    modulo: 'pedidos',
    titulo: 'Pedido cancelado',
    tituloHtml: `<p><strong>${escapeHtml(clienteNombre)}</strong> tiene el pedido <strong>${escapeHtml(numeroOrden)}</strong> cancelado</p>`,
    mensaje,
    prioridad: 'importante',
    actorTipo: 'admin',
    entidadTipo: 'pedido',
    entidadId: ordenId,
    ruta: numeroOrden ? `/dashboard/order/${numeroOrden}` : '/dashboard/order',
    etiquetaAccion: 'Ver pedido',
    metadatos: {
      ordenId,
      numeroOrden,
      clienteNombre,
      montoTotal: monto,
      cantidadTotal: cantidad,
      razon,
      miembroId: orden?.miembroId || orden?.customer?.memberId || null,
    },
    usuario,
    notificationId: `pedido_cancelado_admin_${sanitizeNotificationIdPart(ordenId || numeroOrden)}`,
  });
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

  const notificacionConfigurada = await resolverNotificacionConConfiguracion(notificacion);

  if (!notificacionConfigurada) {
    return null;
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
    notificacionConfigurada,
    { merge: true }
  );

  return notificacionConfigurada;
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

  const notificacionConfigurada = await resolverNotificacionConConfiguracion(notificacion);

  if (!notificacionConfigurada) {
    return null;
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
    notificacionConfigurada,
    { merge: true }
  );

  return notificacionConfigurada;
}

const obtenerNombreProducto = (producto = {}) =>
  producto?.name || producto?.nombre || producto?.title || producto?.titulo || 'Producto';

const obtenerIdProducto = (producto = {}) => producto?.id || producto?.productoId || producto?.sku || '';

export async function crearNotificacionProductoPublicado({ producto = {}, usuario = {} }) {
  const productId = obtenerIdProducto(producto);
  const productName = obtenerNombreProducto(producto);

  return crearNotificacionAdmin({
    tipoNotificacion: 'producto_publicado',
    modulo: 'productos',
    titulo: 'Producto publicado',
    tituloHtml: `<p><strong>${escapeHtml(productName)}</strong> fue publicado en la tienda</p>`,
    mensaje: `publico el producto ${productName}.`,
    prioridad: 'informativa',
    actorTipo: usuario?.role === 'admin' ? 'admin' : 'sistema',
    entidadTipo: 'producto',
    entidadId: productId,
    ruta: productId ? `/dashboard/product/${productId}` : '/dashboard/product',
    etiquetaAccion: 'Ver producto',
    metadatos: {
      productId,
      productName,
      sku: producto?.sku || null,
      disponibles: producto?.available ?? producto?.disponibles ?? null,
    },
    usuario,
    notificationId: `producto_publicado_${sanitizeNotificationIdPart(productId)}_${Date.now()}`,
  });
}

export async function crearNotificacionProductoSinStock({ producto = {}, usuario = {} }) {
  const productId = obtenerIdProducto(producto);
  const productName = obtenerNombreProducto(producto);

  return crearNotificacionAdmin({
    tipoNotificacion: 'producto_sin_stock',
    modulo: 'productos',
    titulo: 'Producto sin stock',
    tituloHtml: `<p><strong>${escapeHtml(productName)}</strong> se quedo sin stock</p>`,
    mensaje: `detecto que ${productName} se quedo sin stock.`,
    prioridad: 'critica',
    entidadTipo: 'producto',
    entidadId: productId,
    ruta: productId ? `/dashboard/product/${productId}` : '/dashboard/product',
    etiquetaAccion: 'Ver producto',
    metadatos: {
      productId,
      productName,
      disponibles: producto?.available ?? producto?.disponibles ?? 0,
      sku: producto?.sku || null,
    },
    usuario,
    notificationId: `producto_sin_stock_${sanitizeNotificationIdPart(productId)}_${Date.now()}`,
  });
}

export async function crearNotificacionProductoStockBajo({ producto = {}, usuario = {} }) {
  const productId = obtenerIdProducto(producto);
  const productName = obtenerNombreProducto(producto);
  const disponibles = Number(producto?.available ?? producto?.disponibles ?? 0);

  return crearNotificacionAdmin({
    tipoNotificacion: 'producto_stock_bajo',
    modulo: 'productos',
    titulo: 'Producto con stock bajo',
    tituloHtml: `<p><strong>${escapeHtml(productName)}</strong> tiene stock bajo: <strong>${escapeHtml(disponibles)}</strong></p>`,
    mensaje: `detecto stock bajo en ${productName}: ${disponibles}.`,
    prioridad: 'importante',
    entidadTipo: 'producto',
    entidadId: productId,
    ruta: productId ? `/dashboard/product/${productId}` : '/dashboard/product',
    etiquetaAccion: 'Ver producto',
    metadatos: {
      productId,
      productName,
      disponibles,
      sku: producto?.sku || null,
    },
    usuario,
    notificationId: `producto_stock_bajo_${sanitizeNotificationIdPart(productId)}_${Date.now()}`,
  });
}

export async function crearNotificacionProductoDisponibleNuevamente({
  producto = {},
  usuario = {},
  idsDestinatarios = null,
}) {
  const productId = obtenerIdProducto(producto);
  const productName = obtenerNombreProducto(producto);
  const disponibles = Number(producto?.available ?? producto?.disponibles ?? 0);
  const recipients =
    idsDestinatarios ||
    (await obtenerUsuariosConProductoEnCarrito(producto));

  return crearNotificacionUsuario({
    tipoNotificacion: 'producto_disponible_nuevamente',
    modulo: 'productos',
    titulo: 'Producto disponible nuevamente',
    tituloHtml: `<p><strong>${escapeHtml(productName)}</strong> esta disponible nuevamente</p>`,
    mensaje: `${productName} esta disponible nuevamente.`,
    prioridad: 'informativa',
    actorId: String(usuario?.uid || usuario?.id || 'sistema'),
    actorTipo: 'sistema',
    actorNombre: 'Tienda',
    entidadTipo: 'producto',
    entidadId: productId,
    ruta: productId ? `/dashboard/product/${productId}` : '/dashboard/product',
    etiquetaAccion: 'Ver producto',
    metadatos: {
      productId,
      nombreProducto: productName,
      productName,
      disponibles,
      sku: producto?.sku || null,
    },
    idsDestinatarios: recipients,
    notificationId: `producto_disponible_nuevamente_${sanitizeNotificationIdPart(productId)}_${Date.now()}`,
  });
}

export async function crearNotificacionFacturaGenerada({ factura = {}, usuario = {} }) {
  const facturaId = factura?.reciboId || factura?.receiptId || factura?.id || factura?.numeroRecibo || '';
  const numeroFactura = factura?.numeroRecibo || factura?.invoiceNumber || facturaId || 'Factura';
  const clienteNombre =
    factura?.emitidoPara?.nombre || factura?.cliente?.nombre || factura?.customer?.name || 'Cliente';

  return crearNotificacionAdmin({
    tipoNotificacion: 'factura_generada',
    modulo: 'facturas',
    titulo: 'Factura generada',
    tituloHtml: `<p>Se genero la factura <strong>${escapeHtml(numeroFactura)}</strong> para <strong>${escapeHtml(clienteNombre)}</strong></p>`,
    mensaje: `genero la factura ${numeroFactura} para ${clienteNombre}.`,
    prioridad: 'informativa',
    entidadTipo: 'factura',
    entidadId: facturaId,
    ruta: facturaId ? `/dashboard/invoice/${facturaId}` : '/dashboard/invoice',
    etiquetaAccion: 'Ver factura',
    metadatos: {
      facturaId,
      numeroFactura,
      clienteNombre,
      orderId: factura?.ordenId || factura?.orderId || null,
      montoTotal: factura?.montoTotal || factura?.totalAmount || null,
    },
    usuario,
    notificationId: `factura_generada_${sanitizeNotificationIdPart(facturaId || numeroFactura)}`,
  });
}

export async function crearNotificacionFacturaDisponible({ factura = {}, usuario = {} }) {
  const facturaId = factura?.reciboId || factura?.receiptId || factura?.id || factura?.numeroRecibo || '';
  const numeroFactura = factura?.numeroRecibo || factura?.invoiceNumber || facturaId || 'Factura';
  const clienteNombre =
    factura?.emitidoPara?.nombre ||
    factura?.invoiceTo?.name ||
    factura?.cliente?.nombre ||
    factura?.customer?.name ||
    usuario?.displayName ||
    usuario?.nombre ||
    'Cliente';
  const idUsuario =
    factura?.usuarioId ||
    factura?.userId ||
    usuario?.uid ||
    usuario?.idUsuario ||
    usuario?.id ||
    null;

  return crearNotificacionUsuario({
    tipoNotificacion: 'factura_disponible',
    modulo: 'facturas',
    titulo: 'Factura disponible',
    tituloHtml: `<p>Tu factura <strong>${escapeHtml(numeroFactura)}</strong> esta disponible</p>`,
    mensaje: `tu factura ${numeroFactura} esta disponible.`,
    prioridad: 'informativa',
    actorId: 'sistema',
    actorTipo: 'sistema',
    actorNombre: 'Facturacion',
    entidadTipo: 'factura',
    entidadId: facturaId,
    ruta: facturaId ? `/dashboard/invoice/${facturaId}` : '/dashboard/invoice',
    etiquetaAccion: 'Ver factura',
    metadatos: {
      idFactura: facturaId,
      facturaId,
      numeroFactura,
      clienteNombre,
      orderId: factura?.ordenId || factura?.orderId || null,
      montoTotal: factura?.montoTotal || factura?.totalAmount || null,
    },
    usuario: {
      ...usuario,
      uid: idUsuario || usuario?.uid,
      idUsuario: idUsuario || usuario?.idUsuario,
      idMiembros: factura?.miembroId || factura?.invoiceTo?.idMiembros || usuario?.idMiembros,
      codigoMiembro: factura?.emitidoPara?.codigoMiembro || factura?.invoiceTo?.codigoMiembro || usuario?.codigoMiembro,
      correo: factura?.emitidoPara?.correo || factura?.invoiceTo?.company || usuario?.correo || usuario?.email,
    },
    notificationId: `factura_disponible_${sanitizeNotificationIdPart(facturaId || numeroFactura)}_${sanitizeNotificationIdPart(idUsuario || usuario?.uid || '')}`,
  });
}

export async function crearNotificacionErrorSubidaArchivoImagen({
  archivo = {},
  error = null,
  contexto = '',
  usuario = {},
}) {
  const nombreArchivo = archivo?.name || archivo?.nombre || archivo?.nombreOriginal || 'archivo';
  const entidadId = `${contexto || 'upload'}_${nombreArchivo}`;

  return crearNotificacionAdmin({
    tipoNotificacion: 'error_subida_archivo_imagen',
    modulo: 'archivos',
    titulo: 'Error al subir archivo',
    tituloHtml: `<p>No se pudo subir <strong>${escapeHtml(nombreArchivo)}</strong></p>`,
    mensaje: `no pudo subir ${nombreArchivo}.`,
    prioridad: 'importante',
    actorTipo: usuario?.role === 'admin' ? 'admin' : 'usuario',
    entidadTipo: 'archivo',
    entidadId,
    ruta: '/dashboard/file',
    etiquetaAccion: 'Revisar archivos',
    metadatos: {
      nombreArchivo,
      tipoArchivo: archivo?.type || archivo?.tipo || null,
      tamano: archivo?.size || archivo?.tamano || null,
      contexto,
      error: error?.message || String(error || ''),
    },
    usuario,
    notificationId: `error_subida_archivo_imagen_${sanitizeNotificationIdPart(entidadId)}_${Date.now()}`,
  });
}

export async function crearNotificacionSaludSistemaAlerta({
  chequeo = {},
  usuario = {},
}) {
  const nombreChequeo = chequeo?.name || 'Chequeo de salud';
  const detalle = chequeo?.detail || '';
  const entidadId = chequeo?.id || sanitizeNotificationIdPart(nombreChequeo);

  return crearNotificacionAdmin({
    tipoNotificacion: 'salud_sistema_alerta',
    modulo: 'salud_sistema',
    titulo: `Alerta de salud del sistema: ${nombreChequeo}`,
    tituloHtml: `<p>Alerta en <strong>${escapeHtml(nombreChequeo)}</strong></p>`,
    mensaje: `${nombreChequeo}: ${detalle}`,
    prioridad: chequeo?.status === 'critico' ? 'critica' : 'importante',
    actorTipo: 'sistema',
    entidadTipo: 'chequeo_salud',
    entidadId,
    ruta: '/dashboard/admin/health',
    etiquetaAccion: 'Ver salud del sistema',
    metadatos: {
      area: chequeo?.area || null,
      nombreChequeo,
      detalle,
      valor: chequeo?.value ?? null,
      estado: chequeo?.status || null,
    },
    usuario,
    notificationId: `salud_sistema_alerta_${sanitizeNotificationIdPart(entidadId)}_${new Date().toISOString().slice(0, 10)}`,
  });
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

  const notificacionConfigurada = await resolverNotificacionConConfiguracion(notificacion);

  if (!notificacionConfigurada) {
    return null;
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
    notificacionConfigurada,
    { merge: true }
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notificaciones:actualizar'));
  }

  return notificacionConfigurada;
}

export async function crearNotificacionEventoReprogramado({
  evento = {},
  usuario = {},
  cambios = {},
}) {
  const eventId = evento?.id || evento?.eventId || evento?.idActividad || Date.now();
  const nombreEvento = evento?.title || evento?.nombre || evento?.name || 'Evento';
  const fechaInicio = evento?.start || evento?.fechaInicio || evento?.inicio || '';
  const alcance = evento?.alcance || evento?.extendedProps?.alcance || {};
  const usuariosAlcance = await obtenerUsuariosNoAdminNotificaciones({ alcance });

  const adminNotification = await crearNotificacionAdmin({
    tipoNotificacion: 'evento_reprogramado',
    modulo: 'eventos',
    titulo: 'Evento reprogramado',
    tituloHtml: `<p><strong>${escapeHtml(nombreEvento)}</strong> fue reprogramado</p>`,
    mensaje: `reprogramo el evento ${nombreEvento}.`,
    prioridad: 'importante',
    actorTipo: usuario?.role === 'admin' ? 'admin' : 'sistema',
    entidadTipo: 'evento',
    entidadId: String(eventId),
    ruta: '/dashboard/calendar',
    etiquetaAccion: 'Ver evento',
    metadatos: {
      eventId,
      nombreEvento,
      fechaInicio,
      cambios,
    },
    usuario,
    notificationId: `evento_reprogramado_${sanitizeNotificationIdPart(eventId)}_${Date.now()}`,
  });
  const userNotification = await crearNotificacionUsuario({
    tipoNotificacion: 'evento_reprogramado',
    modulo: 'eventos',
    titulo: 'Evento reprogramado',
    tituloHtml: `<p><strong>${escapeHtml(nombreEvento)}</strong> fue reprogramado</p>`,
    mensaje: `el evento ${nombreEvento} fue reprogramado.`,
    prioridad: 'importante',
    actorId: String(usuario?.uid || usuario?.id || 'sistema'),
    actorTipo: 'sistema',
    actorNombre: 'Calendario',
    entidadTipo: 'evento',
    entidadId: String(eventId),
    ruta: '/dashboard/calendar',
    etiquetaAccion: 'Ver evento',
    metadatos: {
      eventId,
      nombreEvento,
      fechaInicio,
      cambios,
      alcance,
    },
    idsDestinatarios: usuariosAlcance.map((recipient) => recipient.idUsuario),
    notificationId: `evento_reprogramado_usuario_${sanitizeNotificationIdPart(eventId)}_${Date.now()}`,
  });

  return [adminNotification, userNotification].filter(Boolean);
}

const getBirthdayDate = (miembro = {}) =>
  miembro?.fechaNacimiento || miembro?.birthDate || miembro?.dateOfBirth || miembro?.birth || null;

const getDaysUntilBirthday = (birthDateValue, today = new Date()) => {
  if (!birthDateValue) return null;

  // 'YYYY-MM-DD' se lee en la zona horaria de AQUI. `new Date('2009-08-31')` se
  // interpreta como medianoche UTC, que en Santo Domingo es el dia anterior: el
  // cumpleaños del 31 se leia como 30 y el aviso salia un dia antes.
  const iso = String(birthDateValue).trim().slice(0, 10);
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const birthDate = partes
    ? new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]), 12)
    : new Date(birthDateValue);
  if (Number.isNaN(birthDate.getTime())) return null;

  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let nextBirthday = new Date(
    today.getFullYear(),
    birthDate.getMonth(),
    birthDate.getDate()
  );

  if (nextBirthday < startToday) {
    nextBirthday = new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
  }

  return Math.round((nextBirthday.getTime() - startToday.getTime()) / 86400000);
};

export async function crearNotificacionesCumpleanosMiembros({
  miembros = null,
  usuario = {},
  diasAviso = [0, 7],
} = {}) {
  asegurarFirebaseNotificaciones();

  const memberItems = Array.isArray(miembros) ? miembros : await getMembers();
  const idsDestinatarios = await obtenerIdsAdministradoresNotificaciones(usuario);
  const hoyClave = new Date().toISOString().slice(0, 10);
  const notificaciones = [];

  if (!idsDestinatarios.length) {
    return notificaciones;
  }

  for (const miembro of memberItems || []) {
    const diasHastaCumpleanos = getDaysUntilBirthday(getBirthdayDate(miembro));

    if (!diasAviso.includes(diasHastaCumpleanos)) {
      continue;
    }

    const idMiembro = Number(miembro?.id ?? miembro?.idMiembros ?? 0);
    const codigoMiembro = miembro?.memberId || miembro?.codigoMiembro || '';
    const nombreMiembro =
      construirNombreCompletoMiembro(miembro) || codigoMiembro || `Miembro ${idMiembro}`;
    const tipoNotificacion =
      diasHastaCumpleanos === 0 ? 'cumpleanos_miembro_hoy' : 'cumpleanos_miembro_7_dias';
    const tipoNotificacionDestacamento =
      diasHastaCumpleanos === 0
        ? 'cumpleanos_miembro_destacamento_hoy'
        : 'cumpleanos_miembro_destacamento_7_dias';
    const mensaje =
      diasHastaCumpleanos === 0
        ? `hoy esta de cumpleanos ${nombreMiembro}.`
        : `faltan 7 dias para el cumpleanos de ${nombreMiembro}.`;
    const idDestacamento = miembro?.idDestacamento || miembro?.destId || null;

    const notificacion = await crearNotificacionAdmin({
      tipoNotificacion,
      modulo: 'cumpleanos',
      titulo: diasHastaCumpleanos === 0 ? 'Cumpleanos hoy' : 'Cumpleanos proximo',
      tituloHtml: `<p><strong>${escapeHtml(nombreMiembro)}</strong> ${
        diasHastaCumpleanos === 0 ? 'esta de cumpleanos hoy' : 'cumple en 7 dias'
      }</p>`,
      mensaje,
      prioridad: 'informativa',
      entidadTipo: 'miembro',
      entidadId: idMiembro || codigoMiembro,
      ruta: idMiembro ? `/dashboard/level/member/${idMiembro}/edit` : '/dashboard/level/member',
      imagenTipo: 'persona',
      imagenURL: miembro?.avatarUrl || miembro?.photoURL || null,
      miniaturaURL: miembro?.avatarUrl || miembro?.photoURL || null,
      etiquetaAccion: 'Ver perfil',
      metadatos: {
        ...construirMetadatosMiembro(miembro),
        diasHastaCumpleanos,
        fechaEjecucion: hoyClave,
      },
      usuario,
      idsDestinatariosPrecalculados: idsDestinatarios,
      notificationId: `${tipoNotificacion}_${idMiembro || sanitizeNotificationIdPart(codigoMiembro)}_${hoyClave}`,
    });

    if (notificacion) {
      notificaciones.push(notificacion);
    }

    if (idDestacamento) {
      const destinatariosDestacamento = await obtenerUsuariosNoAdminNotificaciones({
        destacamentoId: idDestacamento,
      });
      const notificacionDestacamento = await crearNotificacionUsuario({
        tipoNotificacion: tipoNotificacionDestacamento,
        modulo: 'cumpleanos',
        titulo: diasHastaCumpleanos === 0 ? 'Cumpleanos hoy' : 'Cumpleanos proximo',
        tituloHtml: `<p><strong>${escapeHtml(nombreMiembro)}</strong> ${
          diasHastaCumpleanos === 0 ? 'esta de cumpleanos hoy' : 'cumple en 7 dias'
        }</p>`,
        mensaje,
        prioridad: 'informativa',
        actorId: 'sistema',
        actorTipo: 'sistema',
        actorNombre: 'Cumpleanos',
        entidadTipo: 'miembro',
        entidadId: idMiembro || codigoMiembro,
        ruta: idMiembro ? `/dashboard/level/member/${idMiembro}/edit` : '/dashboard/level/member',
        imagenTipo: 'persona',
        imagenURL: miembro?.avatarUrl || miembro?.photoURL || null,
        miniaturaURL: miembro?.avatarUrl || miembro?.photoURL || null,
        etiquetaAccion: 'Ver perfil',
        metadatos: {
          ...construirMetadatosMiembro(miembro),
          nombres: miembro?.firstName || miembro?.nombres || '',
          apellidos: miembro?.lastName || miembro?.apellidos || '',
          diasHastaCumpleanos,
          fechaEjecucion: hoyClave,
          idDestacamento,
        },
        idsDestinatarios: destinatariosDestacamento.map((recipient) => recipient.idUsuario),
        notificationId: `${tipoNotificacionDestacamento}_${idMiembro || sanitizeNotificationIdPart(codigoMiembro)}_${hoyClave}`,
      });

      if (notificacionDestacamento) {
        notificaciones.push(notificacionDestacamento);
      }
    }
  }

  return notificaciones;
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
    // La miniatura PRIMERO. En la campana la cara se dibuja a 40px, y hasta
    // ahora se bajaba la foto entera —se han visto de 497 kB— por cada aviso de
    // la lista. El campo ya existia; simplemente no se miraba.
    avatarUrl:
      notificacion.miniaturaURL || notificacion.imagenURL || notificacion.actorFotoURL || null,
    type: obtenerTipoVisualNotificacion(notificacion.tipoNotificacion),
    tipoNotificacion: notificacion.tipoNotificacion || '',
    category: obtenerCategoriaNotificacion(notificacion.modulo),
    prioridad: notificacion.prioridad || 'informativa',
    estado,
    isUnRead: estado === 'no_leida',
    createdAt: notificacion.fechaCreacion || notificacion.fechaEnvio || null,
    ruta: notificacion.ruta || null,
    entidadId: notificacion.entidadId || null,
    tipoAccion: notificacion.tipoAccion || 'ver',
    etiquetaAccion: notificacion.etiquetaAccion || '',
    tipoAccionSecundaria: notificacion.tipoAccionSecundaria || null,
    etiquetaAccionSecundaria: notificacion.etiquetaAccionSecundaria || null,
    metadatos: notificacion.metadatos || {},
    title: construirTituloHtml(notificacion, usuarioId),
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

      const notificacion = await resolverNotificacionConConfiguracion({
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
      });

      if (notificacion) {
        await setDoc(
          doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
          notificacion,
          { merge: true }
        );
      }

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

    // LO PERSONAL LLEGA SIEMPRE, SE MANDE O NO EN LA ORGANIZACION.
    //
    // El reparto por rol existe para que un aviso que se envia dos veces —una
    // version para administradores y otra para el resto— no salga duplicado a
    // quien es las dos cosas. Los cumpleaños no tienen esa doble version: son
    // del destacamento de uno. Con la regla general, a quien ademas administra
    // se le tiraba el aviso a la basura y se quedaba sin enterarse del
    // cumpleaños de su propio compañero.
    if (String(notificacion.modulo ?? '').toLowerCase() === 'cumpleanos') return true;

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

export async function marcarNotificacionComoAtendida(notificationId, idUsuario = '') {
  asegurarFirebaseNotificaciones();

  const notificationIds = Array.isArray(notificationId) ? notificationId : [notificationId];
  const usuarioId = String(idUsuario || '').trim();

  if (!notificationIds.filter(Boolean).length) {
    return;
  }

  await Promise.all(
    notificationIds.filter(Boolean).map((id) =>
      updateDoc(doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, id), {
        estado: 'atendida',
        atendidaPor: usuarioId ? arrayUnion(usuarioId) : [],
        fechaAtencion: new Date().toISOString(),
        actualizadoEnServidor: serverTimestamp(),
      })
    )
  );
}

/**
 * Recuerda que mensajes de felicitacion ya salieron para este cumpleaños.
 *
 * La memoria vive en la propia notificacion —una sola por cumpleaños, compartida
 * por todos los que la reciben—, asi que si quince personas felicitan a la misma
 * persona, le llegan quince mensajes DISTINTOS.
 *
 * Va aqui y no en el servicio de felicitaciones porque las escrituras a
 * Firestore estan reservadas a los ficheros que ya las hacian: la puerta de
 * cambios es para lo que cambia la organizacion, y esto es la memoria de un
 * sorteo.
 */
export async function recordarFelicitacionesEnviadas(notificationId, usados = []) {
  asegurarFirebaseNotificaciones();

  const id = String(notificationId || '').trim();

  if (!id) return;

  await updateDoc(doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, id), {
    'metadatos.felicitacionesUsadas': usados,
    actualizadoEnServidor: serverTimestamp(),
  });
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
