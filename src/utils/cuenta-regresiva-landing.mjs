// ----------------------------------------------------------------------
// LA CUENTA ATRÁS DE LA PÁGINA DE REGISTRO (landing errd-registro).
//
// La fecha de cierre ya no está escrita en el código de la landing: el
// Administrador Global y la Oficina Nacional la eligen desde la bandeja de
// actualizaciones del dashboard y la landing la aplica en unos segundos, sin
// publicar nada. Vive en Firestore, en `configuracion_landing_registro/
// cuenta_regresiva`, y la landing la lee por su servidor (Admin SDK).
//
// El mismo contrato está copiado en `errd-registro/src/server/cuenta-regresiva.mjs`:
// si cambia un campo aquí, cambia allí.
//
// - `cierre`: ISO con la zona de Santo Domingo ("2026-10-12T23:59:59-04:00").
// - `mostrar`: si la landing enseña la cuenta atrás.
// - `texto`: la frase de encima ("Resta para finalizar la actualización:").
// - `cerrarAlTerminar`: llegado el cierre, el formulario deja de aceptar envíos
//   (y el servidor de la landing también los rechaza).
// ----------------------------------------------------------------------

export const COLECCION_CONFIG_LANDING = 'configuracion_landing_registro';
export const DOC_CUENTA_REGRESIVA = 'cuenta_regresiva';

// República Dominicana no cambia de hora: siempre UTC-4.
const DESFASE_MS = -4 * 60 * 60 * 1000;

export const CUENTA_REGRESIVA_DE_FABRICA = Object.freeze({
  cierre: '2026-10-12T23:59:59-04:00',
  mostrar: true,
  texto: 'Resta para finalizar la actualización:',
  cerrarAlTerminar: false,
});

const ms = (valor) => {
  if (!valor) return null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  const n = typeof valor === 'number' ? valor : Date.parse(valor);
  return Number.isFinite(n) ? n : null;
};

/** Un instante como "AAAA-MM-DDTHH:mm:ss-04:00" (hora de Santo Domingo). */
export const aIsoSantoDomingo = (valor) => {
  const t = ms(valor);
  if (t === null) return null;
  return `${new Date(t + DESFASE_MS).toISOString().slice(0, 19)}-04:00`;
};

/** Lo guardado con la forma de siempre; lo que no cuadra, de fábrica. */
export const normalizarCuentaRegresiva = (datos = {}) => ({
  cierre: aIsoSantoDomingo(datos?.cierre) ?? CUENTA_REGRESIVA_DE_FABRICA.cierre,
  mostrar: typeof datos?.mostrar === 'boolean' ? datos.mostrar : CUENTA_REGRESIVA_DE_FABRICA.mostrar,
  texto:
    String(datos?.texto ?? '')
      .trim()
      .slice(0, 120) || CUENTA_REGRESIVA_DE_FABRICA.texto,
  cerrarAlTerminar: datos?.cerrarAlTerminar === true,
});

/** Días, horas, minutos y segundos que faltan (nunca negativos). */
export const partesDeLoQueFalta = (restanteMs) => {
  const s = Math.max(0, Math.floor((Number(restanteMs) || 0) / 1000));
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    minutos: Math.floor((s % 3600) / 60),
    segundos: s % 60,
  };
};

export const ETIQUETAS_CUENTA_REGRESIVA = {
  cierre: 'Cierre',
  mostrar: 'Mostrar la cuenta atrás',
  texto: 'Texto',
  cerrarAlTerminar: 'Cerrar el formulario al terminar',
};

/** Los campos que cambian, para Historial. */
export const cambiosDeCuentaRegresiva = (antes = {}, despues = {}) => {
  const a = normalizarCuentaRegresiva(antes);
  const d = normalizarCuentaRegresiva(despues);
  return Object.keys(ETIQUETAS_CUENTA_REGRESIVA)
    .filter((campo) => a[campo] !== d[campo])
    .map((campo) => ({
      campo,
      etiqueta: ETIQUETAS_CUENTA_REGRESIVA[campo],
      antes: String(a[campo]),
      despues: String(d[campo]),
    }));
};
