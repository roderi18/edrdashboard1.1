// ----------------------------------------------------------------------
// LA FOTO NO SE QUEDA ENGANCHADA ABAJO.
//
// Qué se rompía: la foto se colocaba antes de cargarse; al crecer, quedaba
// cortada abajo, la lista dejaba de darse por "al fondo" y los mensajes nuevos
// ya no la movían. Ahora: al cargar una imagen o un video se vuelve al fondo (si
// se estaba ahí), un mensaje propio baja siempre la lista, y la escucha del
// scroll se engancha aunque la lista aparezca después del esqueleto.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('al cargar una imagen o un video, la lista vuelve al fondo', () => {
  const hook = leer('src/sections/chat/hooks/use-messages-scroll.js');

  assert.match(hook, /addEventListener\('load', handleMediaLoaded, true\)/);
  assert.match(hook, /addEventListener\('loadeddata', handleMediaLoaded, true\)/);
  assert.match(hook, /if \(shouldStickToBottomRef\.current\) scrollToBottom\(\)/);
});

test('un mensaje propio baja siempre la lista', () => {
  const hook = leer('src/sections/chat/hooks/use-messages-scroll.js');
  const lista = leer('src/sections/chat/chat-message-list.jsx');

  assert.match(hook, /hasNewMessage && \(shouldStickToBottomRef\.current \|\| ultimoEsPropio\)/);
  assert.match(lista, /useMessagesScroll\(sortedMessages, \{\s*idPropio:/);
});

test('la escucha del scroll se engancha cuando aparece la lista', () => {
  const hook = leer('src/sections/chat/hooks/use-messages-scroll.js');

  assert.match(hook, /\}, \[scrollElement, scrollToBottom\]\);/);
});
