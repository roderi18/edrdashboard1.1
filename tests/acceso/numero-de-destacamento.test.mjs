import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// EL NUMERO DEL DESTACAMENTO LO LLEVA EL REGISTRO NACIONAL.
//
// Es el identificador con el que se nombra al destacamento en todo el pais. Lo
// pone la Oficina Nacional —y el Administrador Global, que manda sobre todo—; el
// resto de cargos ni lo asignan ni lo cambian, tampoco al CREAR el destacamento,
// que es lo que si es de la seccion.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const { puedeAsignarNumeroDeDestacamento } = await import('../../src/utils/org-level-access.js');

const conRol = (rolId) => ({ role: 'admin', rolId, cargos: [{ rol: rolId, nivel: 'nacional' }] });

test('solo la Oficina Nacional y el Administrador Global asignan el numero', () => {
  assert.equal(puedeAsignarNumeroDeDestacamento(conRol('oficina_nacional')), true);
  assert.equal(puedeAsignarNumeroDeDestacamento(conRol('administrador_global')), true);
});

test('ningun otro cargo lo pone, ni el que crea el destacamento', () => {
  [
    'coordinador_seccional',
    'sub_coordinador_seccional',
    'coordinador_regional',
    'usuario_destacamento',
    'usuario_destacamento_asistente',
    'director_nacional',
  ].forEach((rolId) => {
    assert.equal(
      puedeAsignarNumeroDeDestacamento(conRol(rolId)),
      false,
      `${rolId} no deberia poder asignar el numero`
    );
  });
});

test('el campo va en gris y lo que se envia es el numero que ya tenia', () => {
  const seccion = leer('src/components/form/dest-form/DestGeneralSection.jsx');
  const formulario = leer('src/sections/dest/dest-create-edit-form.jsx');

  assert.match(seccion, /numberDisabled = disabled/);
  assert.match(seccion, /disabled=\{numberDisabled\}/);
  // Las dos vistas, creacion y edicion.
  assert.equal((formulario.match(/numberDisabled=\{!canAssignDestNumber\}/g) || []).length, 2);
  // Un campo en gris no impide reescribir el formulario por otro lado.
  assert.match(formulario, /destNumber: canAssignDestNumber/);
  assert.match(formulario, /: \(currentDest\?\.destNumber \?\? ''\)/);
});

test('la hoja de importacion tampoco es una puerta trasera', () => {
  const toolbar = leer('src/sections/dest/dest-table-toolbar.jsx');
  const lista = leer('src/sections/dest/view/dest-list-view.jsx');

  assert.match(toolbar, /canAssignDestNumber = false/);
  assert.match(toolbar, /numero: canAssignDestNumber/);
  assert.match(lista, /canAssignDestNumber=\{puedeAsignarNumeroDeDestacamento\(user\)\}/);
});

test('el aviso va al registro nacional y a la seccion y region del destacamento', () => {
  const servicio = leer('src/services/notification-service.js');
  const formulario = leer('src/sections/dest/dest-create-edit-form.jsx');

  assert.match(servicio, /export async function crearNotificacionNumeroDestacamento/);
  assert.match(servicio, /ROLES\.ADMINISTRADOR_GLOBAL,\s*\n\s*ROLES\.OFICINA_NACIONAL,\s*\n\s*\.\.\.ROLES_CONSEJO_EJECUTIVO,/);
  assert.match(servicio, /rolesConAlcance\(ALCANCES\.SECCION\)/);
  assert.match(servicio, /rolesConAlcance\(ALCANCES\.REGION\)/);
  // Ni los de otra seccion ni los de otra region.
  assert.match(servicio, /cargo\.idEntidad === seccion : seccionesDelPerfil\.has\(seccion\)/);
  assert.match(servicio, /cargo\.idEntidad === region : regionesDelPerfil\.has\(region\)/);
  // Solo cuando el numero cambia de verdad.
  assert.match(servicio, /if \(!numero \|\| numero === anterior\) return null;/);
  assert.match(formulario, /crearNotificacionNumeroDestacamento\(\{/);
});
