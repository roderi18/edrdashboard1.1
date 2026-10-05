import 'server-only';

import { db } from './firebase.mjs';

// ----------------------------------------------------------------------
// LA CUENTA ATRÁS, elegida desde el dashboard (solo servidor).
//
// La fecha de cierre ya no está escrita en el código: la eligen el Administrador
// Global y la Oficina Nacional en la bandeja de actualizaciones del dashboard y
// se guarda en `configuracion_landing_registro/cuenta_regresiva`. Este es el
// mismo contrato que `next-js/src/utils/cuenta-regresiva-landing.mjs`: si cambia
// un campo allí, cambia aquí.
//
// Se lee con 10 s de memoria: la página la pide cada 30 s y así un cambio se ve
// en unos segundos sin cargar Firestore en cada visita.
// ----------------------------------------------------------------------

export const COLECCION_CONFIG_LANDING = 'configuracion_landing_registro';
export const DOC_CUENTA_REGRESIVA = 'cuenta_regresiva';

const DESFASE_MS = -4 * 60 * 60 * 1000;

export const CUENTA_REGRESIVA_DE_FABRICA = Object.freeze({
  cierre: '2026-10-12T23:59:59-04:00',
  mostrar: true,
  texto: 'Resta para finalizar la actualización:',
  cerrarAlTerminar: false,
});

const aIsoSantoDomingo = (valor) => {
  const t = typeof valor === 'number' ? valor : Date.parse(valor);
  if (!Number.isFinite(t)) return null;
  return `${new Date(t + DESFASE_MS).toISOString().slice(0, 19)}-04:00`;
};

export const normalizarCuentaRegresiva = (datos = {}) => ({
  cierre: aIsoSantoDomingo(datos?.cierre) ?? CUENTA_REGRESIVA_DE_FABRICA.cierre,
  mostrar: typeof datos?.mostrar === 'boolean' ? datos.mostrar : CUENTA_REGRESIVA_DE_FABRICA.mostrar,
  texto:
    String(datos?.texto ?? '')
      .trim()
      .slice(0, 120) || CUENTA_REGRESIVA_DE_FABRICA.texto,
  cerrarAlTerminar: datos?.cerrarAlTerminar === true,
});

let enMemoria = null;

/** La configuración vigente. Si Firestore falla, la última buena o la de fábrica. */
export async function leerCuentaRegresiva() {
  if (enMemoria && Date.now() - enMemoria.en < 10_000) return enMemoria.valor;
  try {
    const snap = await db().collection(COLECCION_CONFIG_LANDING).doc(DOC_CUENTA_REGRESIVA).get();
    const valor = normalizarCuentaRegresiva(snap.exists ? snap.data() : {});
    enMemoria = { valor, en: Date.now() };
    return valor;
  } catch (error) {
    console.warn('[cuenta-regresiva] no se pudo leer; se usa la última buena', error.message);
    return enMemoria?.valor ?? { ...CUENTA_REGRESIVA_DE_FABRICA };
  }
}

/** ¿El formulario está cerrado? Solo si se pidió cerrarlo al terminar y ya pasó el cierre. */
export const formularioCerrado = (config, ahora = Date.now()) =>
  Boolean(config?.cerrarAlTerminar) && Date.parse(config.cierre) <= ahora;
