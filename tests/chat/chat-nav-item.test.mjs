import assert from 'node:assert/strict';
import test from 'node:test';

import { getNavItem } from '../../src/sections/chat/utils/get-nav-item.js';

test('una conversación nueva sin mensajes se muestra sin lanzar excepciones', () => {
  const navItem = getNavItem({
    currentUserId: '42',
    conversation: {
      id: 'individual_42_84',
      messages: [],
      participants: [
        { id: '42', idMiembros: 42, name: 'Usuario actual' },
        { id: '84', idMiembros: 84, name: 'Contacto' },
      ],
      createdAt: '2026-08-06T12:00:00.000Z',
      updatedAt: '2026-08-06T12:01:00.000Z',
    },
  });

  assert.equal(navItem.displayName, 'Contacto');
  assert.equal(navItem.displayText, '');
  assert.equal(navItem.lastActivity, '2026-08-06T12:01:00.000Z');
});

test('tolera respuestas incompletas y conserva la actividad del último mensaje', () => {
  assert.doesNotThrow(() => getNavItem({ currentUserId: '42', conversation: {} }));

  const navItem = getNavItem({
    currentUserId: 42,
    conversation: {
      participants: [{ idMiembros: 84, name: 'Contacto' }],
      messages: [
        {
          id: 'mensaje-1',
          body: 'Hola',
          senderId: '84',
          contentType: 'text',
          createdAt: '2026-08-06T12:02:00.000Z',
        },
      ],
    },
  });

  assert.equal(navItem.displayText, 'Hola');
  assert.equal(navItem.lastActivity, '2026-08-06T12:02:00.000Z');
});
