// ----------------------------------------------------------------------
// LAS TARIFAS DE LA MEMBRESÍA 2027. Una sola fuente para la portada, el paso
// "Plan", el resumen del pedido y el servidor (que vuelve a calcularlas: el
// navegador nunca decide cuánto se cobra).
//
// Tres segmentos (Oficina Nacional, octubre 2026):
//   · No registrado en 2026 ............ RD$2,500 (con RRI TRaC). Única opción.
//   · Registrado en 2026 ............... RD$2,250 (con RRI TRaC): descuento por fidelidad.
//   · Con licencia RRI TRaC vigente .... además, RD$1,500 (solo cuota de registro),
//     esté o no registrado en 2026. Ya tiene la plataforma, no la paga dos veces.
// Qué destacamentos tienen licencia no está aquí: lo dice Firestore
// (`licenciasRriTrac`), que mantiene la Oficina Nacional.
// ----------------------------------------------------------------------

export const ANIO_MEMBRESIA = 2027;

export const VIGENCIA_MEMBRESIA = Object.freeze({
  desde: '01/01/2027',
  hasta: '31/12/2027',
});

export const CUOTA_REGISTRO = 1500;
export const PRECIO_RRI_TRAC = 1000;
export const DESCUENTO_FIDELIDAD = 250;

export const PLANES = Object.freeze({
  nuevo: Object.freeze({
    id: 'nuevo',
    nombre: 'No registrado en 2026',
    precio: CUOTA_REGISTRO + PRECIO_RRI_TRAC,
    cuotaRegistro: CUOTA_REGISTRO,
    rriTrac: PRECIO_RRI_TRAC,
    descuento: 0,
    incluyeRriTrac: true,
    detalle: 'RRI TRaC incluido',
    etiqueta: 'Única opción sin registro 2026',
    color: 'error',
    icono: 'solar:users-group-rounded-bold',
  }),
  fidelidad: Object.freeze({
    id: 'fidelidad',
    nombre: 'Registrado en 2026',
    precio: CUOTA_REGISTRO + PRECIO_RRI_TRAC - DESCUENTO_FIDELIDAD,
    cuotaRegistro: CUOTA_REGISTRO,
    rriTrac: PRECIO_RRI_TRAC,
    descuento: DESCUENTO_FIDELIDAD,
    incluyeRriTrac: true,
    detalle: 'RRI TRaC incluido',
    etiqueta: 'Descuento por fidelidad',
    color: 'primary',
    icono: 'solar:medal-star-bold',
  }),
  solo_registro: Object.freeze({
    id: 'solo_registro',
    nombre: 'Licencia RRI TRaC activa',
    precio: CUOTA_REGISTRO,
    cuotaRegistro: CUOTA_REGISTRO,
    rriTrac: 0,
    descuento: 0,
    incluyeRriTrac: false,
    detalle: 'Solo cuota de registro',
    etiqueta: 'Ya tienes la licencia',
    color: 'success',
    icono: 'solar:monitor-bold',
  }),
});

export const LISTA_DE_PLANES = Object.freeze([
  PLANES.nuevo,
  PLANES.fidelidad,
  PLANES.solo_registro,
]);

// Qué planes le tocan a un destacamento. `registrado2026` puede ser
// desconocido (null): entonces NO se supone el descuento ni la tarifa completa
// (se cobraría de más o de menos); solo se ofrece, si tiene licencia, la cuota
// de registro, que vale lo mismo en los dos casos.
export function planesDisponibles({ registrado2026, licenciaVigente }) {
  const base =
    registrado2026 === true ? PLANES.fidelidad : registrado2026 === false ? PLANES.nuevo : null;
  if (licenciaVigente === true) return base ? [PLANES.solo_registro, base] : [PLANES.solo_registro];
  return base ? [base] : [];
}

// "RD$2,250" (coma de miles, como la factura del dashboard).
export const formatearRd = (monto, { decimales = false } = {}) =>
  `RD$${Number(monto || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimales ? 2 : 0,
    maximumFractionDigits: decimales ? 2 : 0,
  })}`;

export const formatearUsd = (monto) =>
  `US$${Number(monto || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// El equivalente en dólares con la tasa del día (RD$ por US$1).
export const aDolares = (montoRd, tasa) =>
  Number.isFinite(tasa) && tasa > 0 ? Math.round((montoRd / tasa) * 100) / 100 : null;
