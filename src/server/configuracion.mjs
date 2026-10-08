import { db } from './firebase.mjs';

export const todayInRD = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export function bankConfig() {
  return {
    name: process.env.ONERRD_BANK_NAME || '',
    accountName: process.env.ONERRD_BANK_ACCOUNT_NAME || '',
    accountType: process.env.ONERRD_BANK_ACCOUNT_TYPE || '',
    accountNumber: process.env.ONERRD_BANK_ACCOUNT_NUMBER || '',
  };
}

export const lanzamientoHabilitado = () => process.env.ONERRD_LANZAMIENTO_HABILITADO === 'true';

export async function paypalConfig() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) return null;
  const snap = await db().collection('configuracionMembresia2027').doc('tasa').get();
  const data = snap.data() || {};
  const rate = Number(data.rdPorUsd);
  if (data.fecha !== todayInRD() || !Number.isFinite(rate) || rate <= 0) return null;
  return { rate, date: data.fecha, usd: (rd) => (rd / rate).toFixed(2) };
}

export function paypalBaseUrl() {
  return process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}
