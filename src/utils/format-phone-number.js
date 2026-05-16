import { parsePhoneNumber } from 'libphonenumber-js';

// ----------------------------------------------------------------------

export function formatPhoneNumber(phoneNumber, fallback = '') {
  if (!phoneNumber) return fallback;

  const phoneText = String(phoneNumber).trim();
  if (!phoneText) return fallback;

  try {
    return parsePhoneNumber(phoneText.startsWith('+') ? phoneText : `+1${phoneText}`)
      ?.formatNational() || phoneText;
  } catch {
    return phoneText;
  }
}

export function getPhoneHref(phoneNumber) {
  if (!phoneNumber) return '';

  const phoneText = String(phoneNumber).trim();
  const digits = phoneText.replace(/\D/g, '');

  if (!digits) return '';
  if (phoneText.startsWith('+')) return `tel:${phoneText.replace(/[^\d+]/g, '')}`;

  return `tel:+1${digits}`;
}
