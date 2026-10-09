import test from 'node:test';
import assert from 'node:assert/strict';

import { crearTokenSolicitud, tokenSolicitudValido } from '../src/utils/token-solicitud.mjs';

test('el enlace nuevo usa un código legible y difícil de adivinar', () => {
  const tokens = new Set(Array.from({ length: 100 }, crearTokenSolicitud));
  assert.equal(tokens.size, 100);
  for (const token of tokens) {
    assert.match(token, /^M27-(?:[0-9A-HJ-KM-NP-TV-Z]{5}-){3}[0-9A-HJ-KM-NP-TV-Z]{5}$/);
    assert.equal(tokenSolicitudValido(token), true);
  }
});

test('los enlaces UUID existentes siguen abriendo solicitudes', () => {
  assert.equal(tokenSolicitudValido('5ea1543d-9076-4944-993d-0cf27461b20d'), true);
  assert.equal(tokenSolicitudValido('M27-IOOOO-AAAAA-AAAAA-AAAAA'), false);
  assert.equal(tokenSolicitudValido('M27-AAAAA-AAAAA-AAAAA-AAAA'), false);
});
