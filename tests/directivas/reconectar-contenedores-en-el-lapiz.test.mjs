// ----------------------------------------------------------------------
// UNA LÍNEA QUITADA SE PUEDE VOLVER A HACER.
//
// Qué se rompía (lápiz de la jerarquía, los cuatro organigramas): se unía, por
// ejemplo, Capellán Nacional a un contenedor, se desconectaba, y al volver a
// unirlos la línea no aparecía; con un contenedor que nunca se había unido sí.
// Al desconectar, "¿era una línea a mano?" se calculaba dentro de un `set...`,
// y React aplicaba antes la lista de escondidas: la línea se borraba Y quedaba
// escondida, y la escondida tapaba la nueva para siempre.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editor = readFileSync(
  new URL('../../src/sections/common/leadership-layout-editor.jsx', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const funcion = (nombre) => {
  const inicio = editor.indexOf(`const ${nombre} = useCallback(`);

  assert.ok(inicio >= 0, nombre);

  return editor.slice(inicio, editor.indexOf('\n  }, [', inicio) + 80);
};

test('desconectar decide con el estado actual: una línea a mano se borra y no se esconde', () => {
  const desvincular = funcion('desvincularConexion');

  assert.match(desvincular, /const eraAMano = extraConnections\.some\(/);
  assert.doesNotMatch(desvincular, /eraAMano = quedan\.length/);
  assert.match(desvincular, /\}, \[guardarParaDeshacer, extraConnections\]\);/);
});

test('conectar deja de esconder esa línea, también en organigramas ya guardados', () => {
  const agregar = funcion('agregarVinculo');

  assert.match(agregar, /setExtraConnections/);
  assert.match(agregar, /setHiddenConnections\(\(actuales\) =>\s*actuales\.filter/);
  // Las dos formas de conectar (dos clics y arrastrar de esquina) pasan por ahí.
  assert.match(funcion('marcarExtremoDeVinculo'), /agregarVinculo\(\{ from: origen, to: nodeId \}\)/);
  assert.match(funcion('soltarArrastreDeVinculo'), /agregarVinculo\(\{/);
});
