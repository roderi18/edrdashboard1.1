// ----------------------------------------------------------------------
// EL CERTIFICADO Y LA FACTURA DE UN PAGO CON PAYPAL los genera el servidor del
// dashboard (mismo diseño que la pestaña ONERRD), sin que nadie de la Oficina
// Nacional tenga que abrir nada: la landing se lo pide con el secreto de las
// tareas del servidor y espera la respuesta. Es idempotente: pedirlo dos veces
// no emite dos veces (la segunda ve que ya se está generando).
// ----------------------------------------------------------------------

// Generar los dos PDF tarda unos segundos; con holgura para un servidor frío.
const ESPERA_MS = 110_000;

// Devuelve { estado: 'listo' | 'generando' | 'error', numeroRegistro?, error? }.
export async function solicitarEmision(id) {
  const base = process.env.URL_DASHBOARD?.replace(/\/$/, '');
  const secreto = process.env.EMISION_MEMBRESIA_SECRETO;
  if (!base || !secreto) {
    console.error('[emisión] Falta URL_DASHBOARD o EMISION_MEMBRESIA_SECRETO.');
    return { estado: 'error', error: 'La emisión automática no está configurada.' };
  }
  try {
    const respuesta = await fetch(`${base}/api/certificados-onerrd/membresia/emitir-automatico/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tarea-secreto': secreto },
      body: JSON.stringify({ id: String(id) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      console.error('[emisión] el dashboard respondió', respuesta.status, datos);
      return { estado: 'error', error: 'No se pudieron generar los documentos.' };
    }
    return datos;
  } catch (error) {
    console.error('[emisión]', error);
    return { estado: 'error', error: 'No se pudieron generar los documentos.' };
  }
}
