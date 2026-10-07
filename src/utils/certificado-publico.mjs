// ----------------------------------------------------------------------
// LO QUE COMPARTEN LOS CERTIFICADOS QUE SE ABREN CON SU CÓDIGO QR (el ONERRD y
// los de "Crear certificados"): una clave por certificado y los enlaces de la
// página pública que los enseña dentro de un contenedor con la fecha y hora de
// generación.
//
// La clave es aleatoria: los identificadores son predecibles (números
// correlativos, fecha y código de miembro) y, sin ella, cualquiera podría ir
// probando y bajarse los certificados de otros.
// ----------------------------------------------------------------------

export const esClaveCertificadoValida = (valor) =>
  /^[A-Za-z0-9_-]{24,64}$/.test(String(valor ?? ''));

// 32 caracteres aleatorios (24 bytes): imposible de adivinar.
export const crearClaveCertificado = () => {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
};

// La fecha y hora de generación que enseña el contenedor.
const ZONA_HORARIA = 'America/Santo_Domingo';

// 07/10/2026 10:32 a. m. en hora de Santo Domingo (dé igual la del equipo).
export const formatearFechaHoraCertificado = (valor) => {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA_HORARIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
      .formatToParts(fecha)
      .map(({ type, value }) => [type, value])
  );
  const meridiano = partes.dayPeriod?.toUpperCase() === 'PM' ? 'p. m.' : 'a. m.';
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute} ${meridiano}`;
};

const sinBarraFinal = (origen) => String(origen || '').replace(/\/+$/, '');

// ---------------------------------------------------------------- de "Crear certificados"

export const RUTA_PUBLICA_CERTIFICADOS = '/certificados';

// `CERT-AAAAMMDD-HHmmss-<código del miembro normalizado>`, el id con que
// `guardarLoteCertificados` guarda cada uno. Sin barras: no sale de su documento.
export const esIdCertificadoValido = (valor) =>
  /^CERT-\d{8}-\d{6}-[a-z0-9._-]{1,80}$/.test(String(valor ?? '')) && !String(valor).includes('..');

// Lo que lleva el QR. Sin id o sin clave válidos, '' (quien llama decide: los
// certificados de antes del cambio siguen llevando la URL directa del PDF).
export const urlDelCertificadoPublico = (origen, id, clave) =>
  esIdCertificadoValido(id) && esClaveCertificadoValida(clave)
    ? `${sinBarraFinal(origen)}${RUTA_PUBLICA_CERTIFICADOS}/${id}?c=${clave}`
    : '';

// El PDF guardado, que la página pide (y descarga).
export const urlDelPdfPublico = (id, clave, { descargar = false } = {}) =>
  esIdCertificadoValido(id) && esClaveCertificadoValida(clave)
    ? `/api/certificados/${id}?c=${clave}${descargar ? '&descargar=1' : ''}`
    : '';
