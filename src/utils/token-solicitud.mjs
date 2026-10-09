import { randomBytes } from 'node:crypto';

// 96 bits aleatorios, agrupados para leer o dictar el enlace. El código sigue
// siendo privado: conocer el número del destacamento no permite adivinarlo.
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TOKEN_ANTERIOR = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TOKEN_NUEVO = /^M27-(?:[0-9A-HJ-KM-NP-TV-Z]{5}-){3}[0-9A-HJ-KM-NP-TV-Z]{5}$/;

export function crearTokenSolicitud() {
  let valor = BigInt(`0x${randomBytes(12).toString('hex')}`);
  let caracteres = '';
  for (let i = 0; i < 20; i += 1) {
    caracteres = ALFABETO[Number(valor % 32n)] + caracteres;
    valor /= 32n;
  }
  return `M27-${caracteres.match(/.{5}/g).join('-')}`;
}

export const tokenSolicitudValido = (token) =>
  typeof token === 'string' && (TOKEN_ANTERIOR.test(token) || TOKEN_NUEVO.test(token));
