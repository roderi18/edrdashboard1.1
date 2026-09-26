// ----------------------------------------------------------------------
// OFICIAL ESPECIAL + REGIÓN O SECCIÓN, Y ASIGNAR AL INSTANTE.
//
// Qué se rompía:
//  - Stalin Peralta, Subdirector Regional, salía apagado en "Asignar miembros"
//    de Oficiales Especiales ("nadie en dos consejos"), y forzarlo le quitaba la
//    región. Ser Oficial Especial convive con un cargo de región o de sección.
//  - Asignar a alguien en cualquier directiva tardaba: 600 ms de espera de
//    cortesía por persona, y el destacamento además esperaba a Firestore con el
//    diálogo abierto. Tiene que ser instantáneo (pintado optimista).
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { esOficialEspecial, sonCargosCompatibles } =
  await import('src/utils/cargos-compatibles.mjs');

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

const oficial = { nivel: 'nacional', idPosicionDirectiva: 'nacional-oficial-especial-3' };
const subdirectorRegional = { nivel: 'regional', idPosicionDirectiva: 'regional-subdirector' };
const seccional = {
  nivel: 'seccional',
  idPosicionDirectiva: 'seccional-sub-coordinador-seccional',
};
const directorNacional = { nivel: 'nacional', idPosicionDirectiva: 'nacional-director-nacional' };

test('Oficial Especial convive con un cargo de región o de sección, en los dos sentidos', () => {
  assert.equal(sonCargosCompatibles(oficial, subdirectorRegional), true);
  assert.equal(sonCargosCompatibles(subdirectorRegional, oficial), true);
  assert.equal(sonCargosCompatibles(seccional, oficial), true);
});

test('lo demás sigue siendo un solo consejo', () => {
  // Dentro del Consejo Ejecutivo, un cargo por persona.
  assert.equal(sonCargosCompatibles(oficial, directorNacional), false);
  assert.equal(sonCargosCompatibles(subdirectorRegional, seccional), false);
  assert.equal(sonCargosCompatibles(directorNacional, seccional), false);
  assert.equal(esOficialEspecial('nacional-oficial-especial-21'), false);
  assert.equal(esOficialEspecial('nacional-oficial-especial-20'), true);
});

test('el servicio no lo bloquea ni lo retira al dar el otro cargo', () => {
  const servicio = leer('src/services/directivas-organizacionales-service.js');

  assert.match(servicio, /!\(nuevo && sonCargosCompatibles\(asignacion, nuevo\)\)/);
  assert.match(servicio, /nuevo: \{ nivel, idPosicionDirectiva \}/);
  assert.match(servicio, /!\(compatibleCon && sonCargosCompatibles\(asignacion, compatibleCon\)\)/);

  const hook = leer('src/sections/common/use-leadership-assignments.js');
  assert.match(hook, /compatibleCon: \{ nivel, idPosicionDirectiva: position\.idCargo \}/);

  const ficha = leer('src/sections/member/member-create-edit-form.jsx');
  assert.match(ficha, /compatibleCon: \{\s*nivel: cargo\.nivel,/);
});

test('"Asignar miembros" solo apaga a quien tiene otro cargo del Consejo Ejecutivo', () => {
  const dialogo = leer('src/sections/national/leadership/asignar-oficiales-dialog.jsx');

  assert.match(
    dialogo,
    /const tieneOtroCargo = \(opcion\) => !yaEsOficial\(opcion\) && Boolean\(opcion\?\.rolActual\);/
  );
  assert.match(dialogo, /Sigue siendo \{opcion\.rolEnOtroConsejo\}/);
});

test('asignar es instantáneo en las cuatro directivas', () => {
  const hook = leer('src/sections/common/use-leadership-assignments.js');
  assert.match(hook, /export const RETARDO_ASIGNACION_MS = 0;/);

  // El destacamento pinta la casilla provisional antes de escribir.
  const destacamento = leer('src/app/dashboard/level/dest/[id]/edit/leadership/page.jsx');
  const pinta = destacamento.indexOf('return aplicarCasilla(provisional)(current);');
  const escribe = destacamento.indexOf('await guardarAsignacionDirectiva({', pinta);
  assert.ok(pinta > 0 && escribe > pinta, 'pinta antes de esperar a Firestore');

  // "Asignar miembros" devuelve en el acto y guarda en paralelo por detrás.
  const vista = leer('src/sections/national/leadership/national-leadership-view.jsx');
  assert.match(vista, /const deshacerTitulos = pintarTitulosYa\(/);
  assert.match(vista, /await Promise\.all\(\s*nuevos\.map\(/);
});
