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
