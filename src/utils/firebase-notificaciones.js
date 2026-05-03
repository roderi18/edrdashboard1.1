import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export const COLECCIONES_NOTIFICACIONES = {
  notificaciones: 'notificaciones',
  tipos: 'tipos_notificaciones',
  plantillas: 'plantillas_notificaciones',
  preferencias: 'preferencias_notificaciones',
  tareas: 'tareas_notificaciones',
};

export const TIPOS_NOTIFICACIONES_ADMIN = [
  'miembro_creado',
  'miembro_actualizado',
  'pedido_recibido',
  'pedido_cancelado',
  'factura_generada',
  'producto_sin_stock',
  'producto_stock_bajo',
  'producto_publicado',
  'error_subida_archivo_imagen',
  'permisos_cambiados',
  'administrador_creado',
  'cumpleanos_miembro_7_dias',
  'cumpleanos_miembro_hoy',
  'cuenta_creada',
  'perfil_actualizado',
  'evento_reprogramado',
  'mensaje_recibido',
];

export const TIPOS_NOTIFICACIONES_USUARIO = [
  'cuenta_creada',
  'perfil_actualizado',
  'pedido_creado',
  'pedido_confirmado',
  'pedido_cancelado',
  'factura_disponible',
  'producto_disponible_nuevamente',
  'evento_reprogramado',
  'mensaje_recibido',
  'cumpleanos_miembro_destacamento_7_dias',
  'cumpleanos_miembro_destacamento_hoy',
];

const DEFINICIONES_NOTIFICACIONES = {
  miembro_creado: {
    modulo: 'miembros',
    titulo: 'Nuevo miembro creado',
    mensajePlantilla: '{{actorNombre}} registró a {{nombres}} {{apellidos}}.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'miembro',
    etiquetaAccion: 'Ver',
    tipoAccion: 'ver',
    requiereFotoPersona: true,
  },
  miembro_actualizado: {
    modulo: 'miembros',
    titulo: 'Miembro actualizado',
    mensajePlantilla: 'Se actualizó la información de {{nombres}} {{apellidos}}.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'miembro',
    etiquetaAccion: 'Ver',
    tipoAccion: 'ver',
    requiereFotoPersona: true,
  },
  pedido_recibido: {
    modulo: 'pedidos',
    titulo: 'Nuevo pedido recibido',
    mensajePlantilla: 'Se recibió el pedido {{idPedido}}.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'importante',
    entidadTipo: 'pedido',
    etiquetaAccion: 'Ver',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  pedido_creado: {
    modulo: 'pedidos',
    titulo: 'Pedido creado',
    mensajePlantilla: 'Tu pedido {{idPedido}} fue creado correctamente.',
    rolesDisponibles: ['usuario'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'pedido',
    etiquetaAccion: 'Ver pedido',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  pedido_confirmado: {
    modulo: 'pedidos',
    titulo: 'Pedido confirmado',
    mensajePlantilla: 'Tu pedido {{idPedido}} fue confirmado.',
    rolesDisponibles: ['usuario'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'pedido',
    etiquetaAccion: 'Ver pedido',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  pedido_cancelado: {
    modulo: 'pedidos',
    titulo: 'Pedido cancelado',
    mensajePlantilla: 'El pedido {{idPedido}} fue cancelado.',
    rolesDisponibles: ['admin', 'usuario'],
    prioridadPorDefecto: 'importante',
    entidadTipo: 'pedido',
    etiquetaAccion: 'Ver pedido',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  factura_generada: {
    modulo: 'facturas',
    titulo: 'Factura generada',
    mensajePlantilla: 'Se generó la factura {{idFactura}}.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'factura',
    etiquetaAccion: 'Ver factura',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  factura_disponible: {
    modulo: 'facturas',
    titulo: 'Factura disponible',
    mensajePlantilla: 'Tu factura {{idFactura}} ya está disponible.',
    rolesDisponibles: ['usuario'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'factura',
    etiquetaAccion: 'Ver factura',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  producto_sin_stock: {
    modulo: 'productos',
    titulo: 'Producto sin stock',
    mensajePlantilla: 'El producto {{nombreProducto}} se quedó sin stock.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'critica',
    entidadTipo: 'producto',
    etiquetaAccion: 'Ver producto',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  producto_stock_bajo: {
    modulo: 'productos',
    titulo: 'Producto con stock bajo',
    mensajePlantilla: 'El producto {{nombreProducto}} tiene stock bajo: {{stock}}.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'importante',
    entidadTipo: 'producto',
    etiquetaAccion: 'Ver producto',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  producto_publicado: {
    modulo: 'productos',
    titulo: 'Producto publicado',
    mensajePlantilla: 'El producto {{nombreProducto}} fue publicado.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'producto',
    etiquetaAccion: 'Ver producto',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  producto_disponible_nuevamente: {
    modulo: 'productos',
    titulo: 'Producto disponible nuevamente',
    mensajePlantilla: 'El producto {{nombreProducto}} ya está disponible de nuevo.',
    rolesDisponibles: ['usuario'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'producto',
    etiquetaAccion: 'Ver producto',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  error_subida_archivo_imagen: {
    modulo: 'archivos',
    titulo: 'Error al subir archivo o imagen',
    mensajePlantilla: 'Ocurrió un error al subir {{nombreArchivo}}.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'importante',
    entidadTipo: 'archivo',
    etiquetaAccion: 'Revisar',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  permisos_cambiados: {
    modulo: 'permisos',
    titulo: 'Cambio de permisos',
    mensajePlantilla: 'Se actualizaron los permisos de {{nombreUsuario}}.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'importante',
    entidadTipo: 'permiso',
    etiquetaAccion: 'Ver',
    tipoAccion: 'ver',
    requiereFotoPersona: true,
  },
  administrador_creado: {
    modulo: 'administradores',
    titulo: 'Nuevo administrador creado',
    mensajePlantilla: '{{actorNombre}} creó al administrador {{nombreUsuario}}.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'importante',
    entidadTipo: 'administrador',
    etiquetaAccion: 'Ver',
    tipoAccion: 'ver',
    requiereFotoPersona: true,
  },
  cumpleanos_miembro_7_dias: {
    modulo: 'cumpleanos',
    titulo: 'Cumpleaños próximo',
    mensajePlantilla: 'Faltan 7 días para el cumpleaños de {{nombres}} {{apellidos}}.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'miembro',
    etiquetaAccion: 'Ver perfil',
    tipoAccion: 'ver',
    requiereFotoPersona: true,
  },
  cumpleanos_miembro_hoy: {
    modulo: 'cumpleanos',
    titulo: 'Cumpleaños hoy',
    mensajePlantilla: 'Hoy está de cumpleaños {{nombres}} {{apellidos}}.',
    rolesDisponibles: ['admin'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'miembro',
    etiquetaAccion: 'Ver perfil',
    tipoAccion: 'ver',
    requiereFotoPersona: true,
  },
  cumpleanos_miembro_destacamento_7_dias: {
    modulo: 'cumpleanos',
    titulo: 'Cumpleaños próximo en tu destacamento',
    mensajePlantilla: 'Faltan 7 días para el cumpleaños de {{nombres}} {{apellidos}}.',
    rolesDisponibles: ['usuario'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'miembro',
    etiquetaAccion: 'Ver perfil',
    tipoAccion: 'ver',
    requiereFotoPersona: true,
  },
  cumpleanos_miembro_destacamento_hoy: {
    modulo: 'cumpleanos',
    titulo: 'Cumpleaños hoy en tu destacamento',
    mensajePlantilla: 'Hoy está de cumpleaños {{nombres}} {{apellidos}}.',
    rolesDisponibles: ['usuario'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'miembro',
    etiquetaAccion: 'Ver perfil',
    tipoAccion: 'ver',
    requiereFotoPersona: true,
  },
  cuenta_creada: {
    modulo: 'cuentas',
    titulo: 'Cuenta creada',
    mensajePlantilla: 'La cuenta de {{nombreUsuario}} fue creada correctamente.',
    rolesDisponibles: ['admin', 'usuario'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'cuenta',
    etiquetaAccion: 'Ver',
    tipoAccion: 'ver',
    requiereFotoPersona: true,
  },
  perfil_actualizado: {
    modulo: 'miembros',
    titulo: 'Perfil actualizado',
    mensajePlantilla: 'El perfil de {{nombreUsuario}} fue actualizado.',
    rolesDisponibles: ['admin', 'usuario'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'miembro',
    etiquetaAccion: 'Ver perfil',
    tipoAccion: 'ver',
    requiereFotoPersona: true,
  },
  evento_reprogramado: {
    modulo: 'eventos',
    titulo: 'Evento reprogramado',
    mensajePlantilla: 'El evento {{nombreEvento}} fue reprogramado.',
    rolesDisponibles: ['admin', 'usuario'],
    prioridadPorDefecto: 'importante',
    entidadTipo: 'evento',
    etiquetaAccion: 'Ver evento',
    tipoAccion: 'ver',
    requiereFotoPersona: false,
  },
  mensaje_recibido: {
    modulo: 'mensajes',
    titulo: 'Mensaje recibido',
    mensajePlantilla: '{{actorNombre}} te envió un mensaje.',
    rolesDisponibles: ['admin', 'usuario'],
    prioridadPorDefecto: 'informativa',
    entidadTipo: 'mensaje',
    etiquetaAccion: 'Responder',
    tipoAccion: 'responder',
    requiereFotoPersona: true,
  },
};

const PLANTILLA_PREFERENCIAS_BASE = {
  enAplicacion: true,
  notificacionPush: false,
  correoElectronico: false,
};

const asegurarFirebaseNotificaciones = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado en este entorno.');
  }
};

const construirDocumentoTipo = (tipoNotificacion, definicion) => ({
  tipoNotificacion,
  modulo: definicion.modulo,
  titulo: definicion.titulo,
  rolesDisponibles: definicion.rolesDisponibles,
  prioridadPorDefecto: definicion.prioridadPorDefecto,
  entidadTipo: definicion.entidadTipo,
  requiereFotoPersona: definicion.requiereFotoPersona,
  activa: true,
  fechaActualizacion: serverTimestamp(),
});

const construirDocumentoPlantilla = (tipoNotificacion, definicion) => ({
  tipoNotificacion,
  modulo: definicion.modulo,
  tituloPlantilla: definicion.titulo,
  mensajePlantilla: definicion.mensajePlantilla,
  prioridadPorDefecto: definicion.prioridadPorDefecto,
  etiquetaAccionPorDefecto: definicion.etiquetaAccion,
  tipoAccionPorDefecto: definicion.tipoAccion,
  requiereFotoPersona: definicion.requiereFotoPersona,
  activa: true,
  fechaActualizacion: serverTimestamp(),
});

export const obtenerDefinicionNotificacion = (tipoNotificacion) =>
  DEFINICIONES_NOTIFICACIONES[tipoNotificacion] || null;

export async function sembrarTiposNotificacionesIniciales() {
  asegurarFirebaseNotificaciones();

  await Promise.all(
    Object.entries(DEFINICIONES_NOTIFICACIONES).map(([tipoNotificacion, definicion]) =>
      setDoc(
        doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.tipos, tipoNotificacion),
        {
          ...construirDocumentoTipo(tipoNotificacion, definicion),
          fechaCreacion: serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}

export async function sembrarPlantillasNotificacionesIniciales() {
  asegurarFirebaseNotificaciones();

  await Promise.all(
    Object.entries(DEFINICIONES_NOTIFICACIONES).map(([tipoNotificacion, definicion]) =>
      setDoc(
        doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.plantillas, tipoNotificacion),
        {
          ...construirDocumentoPlantilla(tipoNotificacion, definicion),
          fechaCreacion: serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}

export async function sembrarCatalogoNotificacionesIniciales() {
  await sembrarTiposNotificacionesIniciales();
  await sembrarPlantillasNotificacionesIniciales();
}

export function construirPreferenciasNotificacionesBase({ idUsuario, rol = 'usuario' }) {
  const esAdmin = rol === 'admin';
  const tiposPermitidos = esAdmin ? TIPOS_NOTIFICACIONES_ADMIN : TIPOS_NOTIFICACIONES_USUARIO;

  return {
    idUsuario,
    rol,
    ...PLANTILLA_PREFERENCIAS_BASE,
    modulos: {
      miembros: true,
      pedidos: true,
      facturas: true,
      productos: true,
      eventos: true,
      mensajes: true,
      cumpleanos: true,
      permisos: esAdmin,
      administradores: esAdmin,
      archivos: esAdmin,
      cuentas: true,
    },
    tiposNotificacion: Object.fromEntries(tiposPermitidos.map((tipo) => [tipo, true])),
  };
}

export async function sembrarPreferenciasNotificacionesUsuario({ idUsuario, rol = 'usuario' }) {
  asegurarFirebaseNotificaciones();

  if (!idUsuario) {
    throw new Error('El idUsuario es requerido para crear las preferencias de notificaciones.');
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.preferencias, String(idUsuario)),
    {
      ...construirPreferenciasNotificacionesBase({ idUsuario, rol }),
      fechaCreacion: serverTimestamp(),
      fechaActualizacion: serverTimestamp(),
    },
    { merge: true }
  );
}
