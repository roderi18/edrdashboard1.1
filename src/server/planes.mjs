export const YEAR = 2027;

export const PLANES = Object.freeze([
  { id: 'nuevo', nombre: 'No registrado en 2026', precio: 2500, cuotaRegistro: 1500, rriTrac: 1000, descuento: 0, detalle: 'Cuota de registro + RRI TRaC' },
  { id: 'fidelidad', nombre: 'Registrado en 2026', precio: 2250, cuotaRegistro: 1500, rriTrac: 1000, descuento: 250, detalle: 'RRI TRaC con descuento por fidelidad' },
  { id: 'licencia', nombre: 'Licencia RRI TRaC vigente', precio: 1500, cuotaRegistro: 1500, rriTrac: 0, descuento: 0, detalle: 'Solo cuota de registro' },
  { id: 'licencia_con_trac', nombre: 'Licencia vigente + RRI TRaC', precio: 2250, cuotaRegistro: 1500, rriTrac: 750, descuento: 0, detalle: 'Cuota de registro + RRI TRaC' },
]);

export function planesDisponibles({ registrado2026, licenciaVigente }) {
  if (licenciaVigente === true) return [PLANES[2], PLANES[3]];
  if (registrado2026 === true) return [PLANES[1]];
  if (registrado2026 === false) return [PLANES[0]];
  return [];
}
