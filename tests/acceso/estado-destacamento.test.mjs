import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// EL ESTADO DEL DESTACAMENTO (Activo / Inactivo) LO LLEVA EL REGISTRO NACIONAL.
//
// Va junto a "Cantidad de miembros" en la ficha del destacamento y lo mueven
// solo el Administrador Global y la Oficina Nacional —por cualquiera de sus
// cargos: la Oficina Nacional es un rol a mano—. Vive en Firestore porque la API
// .NET no tiene el campo; sin regla propia habria caido en el comodin del final
// y cualquier sesion podia dar de baja un destacamento.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const { puedeCambiarEstadoDeDestacamento } = await import('../../src/utils/org-level-access.js');
const { normalizarEstadoDestacamento, etiquetaEstadoDestacamento, OPCIONES_ESTADO_DESTACAMENTO } =
  await import('../../src/utils/estado-destacamento.mjs');

const conRol = (rolId) => ({ role: 'admin', rolId, cargos: [{ rol: rolId, nivel: 'nacional' }] });

test('solo el Administrador Global y la Oficina Nacional cambian el estado', () => {
  assert.equal(puedeCambiarEstadoDeDestacamento(conRol('administrador_global')), true);
  assert.equal(puedeCambiarEstadoDeDestacamento(conRol('oficina_nacional')), true);
});

test('la Oficina Nacional como cargo a mano tambien lo cambia', () => {
  const coordinadorConOficina = {
    role: 'admin',
    rolId: 'usuario_destacamento',
    cargos: [
      { rol: 'usuario_destacamento', nivel: 'destacamento' },
      { rol: 'oficina_nacional', nivel: 'nacional' },
    ],
  };
  assert.equal(puedeCambiarEstadoDeDestacamento(coordinadorConOficina), true);
});

test('ningun otro cargo lo mueve', () => {
  [
    'usuario_destacamento',
    'usuario_destacamento_asistente',
    'coordinador_seccional',
    'sub_coordinador_seccional',
    'coordinador_regional',
    'director_nacional',
    'consejo_ejecutivo',
  ].forEach((rolId) => {
    assert.equal(
      puedeCambiarEstadoDeDestacamento(conRol(rolId)),
      false,
      `${rolId} no deberia poder cambiar el estado`
    );
  });
});

test('solo hay dos estados y lo que no se sabe es Activo', () => {
  assert.deepEqual(
    OPCIONES_ESTADO_DESTACAMENTO.map((o) => o.label),
    ['Activo', 'Inactivo']
  );
  assert.equal(normalizarEstadoDestacamento(undefined), 'activo');
  assert.equal(normalizarEstadoDestacamento('INACTIVO'), 'inactivo');
  assert.equal(normalizarEstadoDestacamento('otra cosa'), 'activo');
  assert.equal(etiquetaEstadoDestacamento('inactivo'), 'Inactivo');
});

test('el campo va junto a la cantidad de miembros y en gris para los demas', () => {
  const seccion = leer('src/components/form/dest-form/DestGeneralSection.jsx');
  const formulario = leer('src/sections/dest/dest-create-edit-form.jsx');

  assert.ok(seccion.indexOf('label="Estado"') > seccion.indexOf('label="Cantidad de miembros"'));
  assert.match(seccion, /disabled=\{estadoDisabled\}/);
  assert.match(formulario, /estadoDisabled=\{!canChangeDestStatus\}/);
  assert.match(formulario, /if \(!canChangeDestStatus \|\| !currentDest\) return;/);
});

test('la regla de Firestore solo deja escribir a esas dos manos', () => {
  const reglas = leer('firestore.rules');
  const bloque = reglas.slice(reglas.indexOf('match /estado_destacamentos/'));
  const hastaCierre = bloque.slice(0, bloque.indexOf('\n    }'));

  assert.match(hastaCierre, /allow read: if esUsuarioDelSistema\(\);/);
  assert.match(hastaCierre, /allow write: if esAdministradorGlobal\(\)/);
  assert.match(hastaCierre, /ejerceRol\('oficina_nacional'\)/);
});
