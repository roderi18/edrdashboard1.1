// "Corregir datos" del paso 1. Se rompía o se podía romper: que el navegador
// colara campos que no se corrigen (estado, id…), que un valor igual al del
// padrón contara como cambio (y mandara a revisión un pago sin cambios), o que
// un texto enorme llegara a la membresía.
import assert from 'node:assert/strict';
import test from 'node:test';

import { hayCorrecciones, sanearCorrecciones, describirCorrecciones } from '../src/server/correcciones.mjs';

const padron = { id: '231', numero: '18', nombre: 'Tribu de Judá', pastor: '', estado: 'activo' };

test('solo guarda los campos corregibles que de verdad cambian', () => {
  const c = sanearCorrecciones(
    { nombre: 'Tribu de Judá', pastor: 'Pastor Pérez', estado: 'inactivo', id: '1' },
    padron
  );
  assert.deepEqual(c, { pastor: { antes: '', despues: 'Pastor Pérez' } });
  assert.equal(hayCorrecciones(c), true);
});

test('sin cambios reales no hay revisión', () => {
  assert.equal(hayCorrecciones(sanearCorrecciones({ numero: ' 18 ' }, padron)), false);
  assert.equal(hayCorrecciones(sanearCorrecciones('no es json', padron)), false);
});

test('acepta JSON del formulario, recorta y describe', () => {
  const c = sanearCorrecciones(JSON.stringify({ nombre: `  ${'x'.repeat(300)}  ` }), padron);
  assert.equal(c.nombre.despues.length, 120);
  assert.match(describirCorrecciones({ numero: { antes: '18', despues: '19' } }), /Número oficial: «18» → «19»/);
});
