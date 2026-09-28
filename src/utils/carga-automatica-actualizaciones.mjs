// ----------------------------------------------------------------------
// CARGA AUTOMÁTICA DE LAS ACTUALIZACIONES DE DESTACAMENTOS.
//
// Por defecto, lo que llega desde la landing de registro espera en la bandeja a
// que alguien lo cargue a mano. Con el interruptor "Cargar automáticamente" de la
// bandeja, los envíos NUEVOS se cargan solos (la misma carga que la manual:
// padrón, Historial y foto) y se avisa a la Oficina Nacional y al Administrador
// Global.
//
// Quién la hace: la sesión abierta de cualquiera que pueda revisar la bandeja
// (Administrador Global u Oficina Nacional), en cualquier pantalla del
// dashboard. Sin nadie con la aplicación abierta, esperan y se cargan en cuanto
// alguien entra. Con varios abiertos a la vez, cada envío lo toma uno solo (se
// "reserva" en una transacción antes de cargarlo).
//
// Aquí solo está la decisión, sin Firestore, para probarla con relojes de mentira.
// ----------------------------------------------------------------------

export const COLECCION_CONFIG_ACTUALIZACIONES = 'configuracion_actualizaciones_destacamentos';
export const DOC_CARGA_AUTOMATICA = 'carga_automatica';

// Lo que dura la reserva de un envío: si quien lo tomó cierra la pestaña a
// medias, pasado este tiempo otro puede volver a intentarlo.
export const RESERVA_MS = 3 * 60 * 1000;

// Tras estos intentos fallidos se deja para la carga manual: si la API .NET lo
// rechaza, reintentarlo sin fin no lo arregla.
export const INTENTOS_MAXIMOS = 3;

const ms = (valor) => {
  if (!valor) return null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  const n = typeof valor === 'number' ? valor : Date.parse(valor);
  return Number.isFinite(n) ? n : null;
};

/**
 * ¿Se carga solo este envío?
 *
 * Solo los que llegaron DESPUÉS de encender el interruptor (`config.desde`): los
 * que ya esperaban en la bandeja se decidieron a mano y encender la carga no
 * puede volcarlos todos de golpe. Los destacamentos nuevos (sin id en el padrón)
 * nunca: la carga manual tampoco los crea.
 */
export function debeCargarseSolo(fila = {}, config = {}, ahora = Date.now()) {
  if (!config?.activa) return false;
  if ((fila.estado || 'pendiente') !== 'pendiente') return false;
  if (fila.esNuevo || !fila.destacamento?.id) return false;

  const desde = ms(config.desde);
  const llegada = ms(fila.fechaEnvio ?? fila.creadoEn);
  if (desde === null || llegada === null || llegada < desde) return false;

  const auto = fila.cargaAutomatica || {};
  if ((auto.intentos ?? 0) >= INTENTOS_MAXIMOS) return false;
  const reservadoHasta = ms(auto.reservadoHasta);
  if (reservadoHasta !== null && reservadoHasta > ahora) return false;

  return true;
}
