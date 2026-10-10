import { db } from './firebase.mjs';
import {
  aDolares,
  tasaVigente,
  logoDeBanco,
  IDS_DE_PLANES,
  cuentasListas,
  construirPlanes,
  vigenciaAplicada,
  COLECCION_MEMBRESIA,
  inscripcionesCerradas,
  DOC_SECRETOS_MEMBRESIA,
  DOC_CONFIGURACION_MEMBRESIA,
  sanearConfiguracionMembresia,
} from '../utils/configuracion-membresia.mjs';

// ----------------------------------------------------------------------
// LO QUE LA OFICINA NACIONAL CAMBIA DESDE EL DASHBOARD (pestaña ONERRD →
// "Membresía 2027 · landing"): tarifas, planes, licencias, banco, PayPal,
// tasa y si los cobros están abiertos. Se lee de
// `configuracionMembresia2027/general` con una caché de 15 s: lo guardado
// sale en la landing casi al momento, sin una lectura por visita.
//
// La clave secreta de PayPal está aparte (`secretos`), que solo lee el
// servidor. Si no hay nada en Firestore, valen las variables de entorno
// (PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID) como respaldo.
// ----------------------------------------------------------------------

const VIDA_CACHE_MS = 15_000;
let cache = { at: 0, valor: null, promesa: null };

const coleccion = () => db().collection(COLECCION_MEMBRESIA);

async function leerDeFirestore() {
  const [general, secretos] = await Promise.all([
    coleccion().doc(DOC_CONFIGURACION_MEMBRESIA).get(),
    coleccion().doc(DOC_SECRETOS_MEMBRESIA).get(),
  ]);
  return {
    config: sanearConfiguracionMembresia(general.exists ? general.data() : {}),
    secretos: secretos.exists ? secretos.data() : {},
  };
}

export async function leerConfiguracion() {
  if (cache.valor && Date.now() - cache.at < VIDA_CACHE_MS) return cache.valor;
  if (!cache.promesa) {
    cache.promesa = leerDeFirestore()
      .then((valor) => {
        cache = { at: Date.now(), valor, promesa: null };
        return valor;
      })
      .catch((error) => {
        cache.promesa = null;
        // Si Firestore falla, lo último leído antes que dejar de cobrar mal:
        // sin nada leído, la de fábrica (cobros cerrados).
        console.warn('[configuracion] no se pudo leer:', error.message);
        return cache.valor || { config: sanearConfiguracionMembresia({}), secretos: {} };
      });
  }
  return cache.promesa;
}

// Se cobra con los cobros abiertos y antes del cierre de inscripciones.
export const lanzamientoHabilitado = (config) =>
  config.cobrosAbiertos === true && !inscripcionesCerradas(config);

// Por qué no se cobra, para la respuesta de las rutas de pago.
export const motivoSinCobros = (config) =>
  inscripcionesCerradas(config)
    ? 'Las inscripciones de la membresía 2027 ya cerraron.'
    : 'La membresía todavía no está abierta para cobros.';

export const bancoListo = (config) => cuentasListas(config).length > 0;

// Solo las credenciales: para cobrar o confirmar un pedido ya creado (aunque
// la tasa haya vencido entre tanto, o PayPal se haya apagado después).
export function credencialesPaypal({ config, secretos }) {
  const clientId = config.paypal.clientId || process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = secretos.paypalClientSecret || process.env.PAYPAL_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    modo: config.paypal.modo,
    webhookId: secretos.paypalWebhookId || process.env.PAYPAL_WEBHOOK_ID || '',
  };
}

// Credenciales y tasa para crear un pedido nuevo, o null si falta algo
// (entonces PayPal no se ofrece).
export function paypalConfig(lectura) {
  const credenciales = credencialesPaypal(lectura);
  const rate = tasaVigente(lectura.config);
  if (!lectura.config.paypal.activo || !credenciales || !rate) return null;
  return {
    ...credenciales,
    rate,
    date: lectura.config.tasa.fecha,
    usd: (rd) => aDolares(rd, rate),
  };
}

// Lo que el navegador puede saber: sin claves. Las cuentas se enseñan aunque
// los cobros estén cerrados (antes se escondían y parecía que faltaban); lo
// que se cierra es el envío del pago.
export function configuracionPublica({ config, secretos }) {
  const abiertos = lanzamientoHabilitado(config);
  const paypal = paypalConfig({ config, secretos });
  const planes = construirPlanes(config);
  return {
    lanzamientoHabilitado: abiertos,
    inscripcionesCerradas: inscripcionesCerradas(config),
    // La que llevará quien pague hoy: «hoy + 1 año» o el rango fijo del panel.
    vigencia: vigenciaAplicada(config),
    planes: IDS_DE_PLANES.map((id) => planes[id]).filter((p) => p.activo),
    banks: cuentasListas(config).map((c) => ({
      name: c.banco,
      logo: logoDeBanco(c.banco),
      accountName: c.titular,
      accountType: c.tipoCuenta,
      accountNumber: c.numeroCuenta,
      document: c.documento,
    })),
    paypalEnabled: abiertos && Boolean(paypal),
    rate: paypal?.rate || tasaVigente(config) || null,
    rateDate: config.tasa.fecha || null,
  };
}

export const paypalBaseUrl = (modo) =>
  modo === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
