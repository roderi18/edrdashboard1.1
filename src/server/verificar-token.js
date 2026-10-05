import 'server-only';

import { getAdminAuth } from 'src/server/firebase-admin';
import { tokenRevocado } from 'src/server/verificar-token-core.mjs';

// ----------------------------------------------------------------------
// Verifica un token de sesión Y que no esté revocado ni la cuenta deshabilitada.
//
// `verifyIdToken(token, true)` hace una lectura de la cuenta en CADA llamada, y
// casi todas las rutas la usan: sumaba un viaje entero a Firebase a cada
// petición. Se recuerda lo que dice la cuenta unos segundos por proceso: una
// revocación surte efecto en medio minuto, no en una hora.
// ----------------------------------------------------------------------

const VIGENCIA_MS = 30 * 1000;
const MAXIMO_EN_MEMORIA = 5000;

const recordadas = () => {
  if (!globalThis.__estadoDeCuentasParaTokens) {
    globalThis.__estadoDeCuentasParaTokens = new Map();
  }

  return globalThis.__estadoDeCuentasParaTokens;
};

const estadoDeLaCuenta = async (uid) => {
  const memoria = recordadas();
  const ahora = Date.now();
  const guardado = memoria.get(uid);

  if (guardado && ahora - guardado.en < VIGENCIA_MS) return guardado.cuenta;

  const cuenta = await getAdminAuth().getUser(uid);
  const resumen = {
    disabled: cuenta.disabled === true,
    tokensValidAfterTime: cuenta.tokensValidAfterTime ?? null,
  };

  if (memoria.size >= MAXIMO_EN_MEMORIA) memoria.clear();
  memoria.set(uid, { en: ahora, cuenta: resumen });

  return resumen;
};

/** Olvida lo recordado de una cuenta (p. ej. justo después de revocarle las sesiones). */
export const olvidarEstadoDeCuenta = (uid) => {
  recordadas().delete(String(uid));
};

/**
 * Devuelve el token decodificado o lanza si no vale (firma, caducidad,
 * revocación o cuenta deshabilitada).
 */
export const verificarTokenDeSesion = async (token, { graciaPrimerAcceso = false } = {}) => {
  const decodificado = await getAdminAuth().verifyIdToken(token);
  const cuenta = await estadoDeLaCuenta(decodificado.uid);

  if (tokenRevocado(decodificado, cuenta, { graciaPrimerAcceso })) {
    const error = new Error('La sesión fue revocada.');
    error.code = 'auth/id-token-revoked';
    throw error;
  }

  return decodificado;
};
