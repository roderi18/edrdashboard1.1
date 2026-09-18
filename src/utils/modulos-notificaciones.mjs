// ----------------------------------------------------------------------
// CÓMO SE AGRUPAN LOS AVISOS EN "CUENTA → NOTIFICACIONES".
//
// La pantalla era la de la plantilla: textos en inglés ("Email me when someone
// comments…") y un interruptor que no guardaba nada. Ahora lista los avisos
// reales del catálogo (`firebase-notificaciones.js`), agrupados por módulo, y
// cada interruptor escribe en `preferencias_notificaciones/{uid}` — que es lo
// que ya lee `filtrarDestinatariosPorPreferencias` al repartir cada aviso.
//
// Sin Firebase: solo el orden y los nombres de cada grupo, para probarlo.
// ----------------------------------------------------------------------

export const MODULOS_NOTIFICACIONES = Object.freeze([
  {
    modulo: 'miembros',
    titulo: 'Miembros',
    descripcion: 'Altas, cambios y estatus de los miembros.',
  },
  { modulo: 'comunicados', titulo: 'Comunicados', descripcion: 'Lo que se publica en la portada.' },
  {
    modulo: 'destacamentos',
    titulo: 'Destacamentos',
    descripcion: 'Cambios en los destacamentos.',
  },
  { modulo: 'cumpleanos', titulo: 'Cumpleaños', descripcion: 'Recordatorios de cumpleaños.' },
  { modulo: 'mensajes', titulo: 'Mensajes', descripcion: 'Chat y buzones compartidos.' },
  {
    modulo: 'publicaciones',
    titulo: 'Publicaciones',
    descripcion: 'El muro: comentarios y reportes.',
  },
  { modulo: 'eventos', titulo: 'Eventos', descripcion: 'Cambios en el calendario.' },
  { modulo: 'pedidos', titulo: 'Pedidos', descripcion: 'La tienda: tus pedidos y los recibidos.' },
  { modulo: 'facturas', titulo: 'Facturas', descripcion: 'Recibos y facturas.' },
  { modulo: 'productos', titulo: 'Productos', descripcion: 'Inventario y catálogo de la tienda.' },
  { modulo: 'cuentas', titulo: 'Cuenta', descripcion: 'Tu cuenta y tu perfil.' },
  { modulo: 'permisos', titulo: 'Permisos', descripcion: 'Cambios de roles y permisos.' },
  {
    modulo: 'administradores',
    titulo: 'Administradores',
    descripcion: 'Altas de administradores.',
  },
  { modulo: 'archivos', titulo: 'Archivos', descripcion: 'Errores al subir archivos.' },
  { modulo: 'salud_sistema', titulo: 'Salud del sistema', descripcion: 'Alertas técnicas.' },
]);

const ORDEN = new Map(MODULOS_NOTIFICACIONES.map((grupo, indice) => [grupo.modulo, indice]));

/**
 * `tipos`: `[{ tipoNotificacion, modulo, titulo }]` → grupos en el orden de
 * arriba. Un módulo que no está en la lista va al final con su nombre tal cual,
 * para que un aviso nuevo nunca desaparezca de la pantalla.
 */
export const agruparTiposPorModulo = (tipos = []) => {
  const grupos = new Map();

  (Array.isArray(tipos) ? tipos : []).forEach((tipo) => {
    const modulo = tipo?.modulo || 'otros';
    if (!grupos.has(modulo)) grupos.set(modulo, []);
    grupos.get(modulo).push(tipo);
  });

  return [...grupos]
    .map(([modulo, lista]) => {
      const conocido = MODULOS_NOTIFICACIONES.find((grupo) => grupo.modulo === modulo);

      return {
        modulo,
        titulo: conocido?.titulo ?? modulo,
        descripcion: conocido?.descripcion ?? '',
        tipos: lista,
      };
    })
    .sort((a, b) => (ORDEN.get(a.modulo) ?? 99) - (ORDEN.get(b.modulo) ?? 99));
};

/** Un aviso sin preferencia guardada está encendido: así se reparte hoy. */
export const estaActivo = (preferencias = {}, tipoNotificacion = '') =>
  preferencias?.tiposNotificacion?.[tipoNotificacion] !== false;
