import { centavosArriba } from './configuracion-membresia.mjs';

// ----------------------------------------------------------------------
// Cómo se escriben los montos en la landing. Las tarifas y los planes NO están
// aquí: los decide la Oficina Nacional desde el dashboard (pestaña ONERRD →
// "Membresía 2027 · landing") y llegan por /api/configuracion
// (`src/utils/configuracion-membresia.mjs`).
// ----------------------------------------------------------------------

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

// El equivalente en dólares con la tasa del día (RD$ por US$1), redondeado
// hacia arriba al centavo, igual que lo que cobra PayPal.
export const aDolares = (montoRd, tasa) =>
  Number.isFinite(tasa) && tasa > 0 ? centavosArriba(montoRd, tasa) : null;
