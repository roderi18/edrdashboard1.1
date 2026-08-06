import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chunkPresenceIds,
  derivePresenceSnapshot,
  isFreshPresenceSession,
  normalizeManualPresence,
} from '../../src/sections/chat/utils/presence-state.mjs';

const NOW = 100_000;
const STALE_AFTER_MS = 45_000;

test('agrupa presencia en listeners de hasta treinta miembros', () => {
  const chunks = chunkPresenceIds(Array.from({ length: 65 }, (_, index) => String(index + 1)));

  assert.deepEqual(chunks.map((chunk) => chunk.length), [30, 30, 5]);
});

test('una sesión visible mantiene al miembro en línea aunque otra esté oculta', () => {
  const presence = derivePresenceSnapshot({
    presence: {
      sesiones: {
        navegadorA: { visible: false, actualizadoEn: NOW - 1_000 },
        navegadorB: { visible: true, actualizadoEn: NOW - 2_000 },
      },
    },
    now: NOW,
    staleAfterMs: STALE_AFTER_MS,
  });

  assert.equal(presence.status, 'online');
});

test('al quitar ocupado vuelve a en línea y no al estado ausente legado', () => {
  const presence = derivePresenceSnapshot({
    presence: {
      estado: 'always',
      actualizadoEn: NOW - 1_000,
      sesiones: {
        sesionActual: { visible: true, actualizadoEn: NOW - 500 },
        sesionOculta: { visible: false, actualizadoEn: NOW - 500 },
      },
    },
    now: NOW,
    staleAfterMs: STALE_AFTER_MS,
  });

  assert.equal(presence.status, 'online');
});

test('el miembro queda ausente cuando todas sus sesiones están ocultas', () => {
  const presence = derivePresenceSnapshot({
    presence: {
      sesiones: {
        navegadorA: { visible: false, actualizadoEn: NOW - 1_000 },
        navegadorB: { visible: false, actualizadoEn: NOW - 2_000 },
      },
    },
    now: NOW,
    staleAfterMs: STALE_AFTER_MS,
  });

  assert.equal(presence.status, 'always');
});

test('ocupado y ausente manual prevalecen mientras exista una sesión activa', () => {
  const presence = derivePresenceSnapshot({
    presence: {
      estadoManual: 'busy',
      sesiones: { navegadorA: { visible: true, actualizadoEn: NOW - 1_000 } },
    },
    now: NOW,
    staleAfterMs: STALE_AFTER_MS,
  });

  assert.equal(presence.status, 'busy');
  assert.equal(normalizeManualPresence('always'), 'always');
  assert.equal(normalizeManualPresence('online'), null);
});

test('una sesión vencida no puede sobrescribir una sesión visible vigente', () => {
  const presence = derivePresenceSnapshot({
    presence: {
      sesiones: {
        dispositivoViejo: { visible: false, actualizadoEn: NOW - 60_000 },
        dispositivoActivo: { visible: true, actualizadoEn: NOW - 1_000 },
      },
    },
    now: NOW,
    staleAfterMs: STALE_AFTER_MS,
  });

  assert.equal(presence.status, 'online');
  assert.equal(
    isFreshPresenceSession(
      { visible: false, actualizadoEn: NOW - 60_000 },
      NOW,
      STALE_AFTER_MS
    ),
    false
  );
});

test('sin sesiones activas el estado termina desconectado', () => {
  const presence = derivePresenceSnapshot({
    presence: {
      estadoManual: 'busy',
      sesiones: { navegadorA: { visible: true, actualizadoEn: NOW - 60_000 } },
    },
    now: NOW,
    staleAfterMs: STALE_AFTER_MS,
  });

  assert.equal(presence.status, 'offline');
});
