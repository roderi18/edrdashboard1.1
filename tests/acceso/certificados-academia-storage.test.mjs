import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// QUIEN EDITA LA ACADEMIA PUEDE SUBIR SU CERTIFICADO.
//
// Consejo y Capellán de Destacamento editan la Academia Ministerial, pero las
// reglas de Storage solo dejaban subir certificados a quien tiene `ascenso.editar`:
// la pantalla les ofrecía el botón y la subida moría en las reglas. Ahora la
// carpeta `certificados/academia` la escriben los cargos de
// `canEditAcademiaMinisterial`, y esta prueba impide que las dos listas se separen.
// La del Sistema de Ascenso NO cambia: allí Consejo y Capellán siguen de consulta.

const { canEditAcademiaMinisterial } = await import('src/utils/member-access.js');
const { ROLES } = await import('src/auth/permissions/roles.js');

const reglas = fs.readFileSync('storage.rules', 'utf8');

const listaDeLasReglas = () => {
  const cuerpo = /function rolesQueEditanAcademia\(\)\s*\{\s*return\s*\[([\s\S]*?)\];/.exec(reglas);
  assert.ok(cuerpo, 'storage.rules debe declarar rolesQueEditanAcademia()');

  return [...cuerpo[1].matchAll(/'([^']+)'/g)].map(([, codigo]) => codigo).sort();
};

test('la lista de storage.rules es exactamente la de canEditAcademiaMinisterial', () => {
  const deLaAplicacion = Object.values(ROLES)
    .filter((codigo) => codigo !== ROLES.ADMINISTRADOR_GLOBAL)
    .filter((codigo) => canEditAcademiaMinisterial({ rolId: codigo, role: 'admin' }))
    .sort();

  assert.deepEqual(listaDeLasReglas(), deLaAplicacion);
});

test('Consejo y Capellán de Destacamento están en la lista de la Academia', () => {
  const lista = listaDeLasReglas();

  assert.ok(lista.includes(ROLES.CONSEJO_DESTACAMENTO));
  assert.ok(lista.includes(ROLES.CAPELLAN_DESTACAMENTO));
});

test('la carpeta de la Academia mira todos los cargos y limita tamaño y tipo', () => {
  const bloque = reglas.slice(reglas.indexOf('match /certificados/academia/'));

  assert.match(reglas, /rolesQueEjerce', \[\]\)\s*\.hasAny\(rolesQueEditanAcademia\(\)\)/);
  assert.match(bloque, /esCertificadoPermitido\(\)/);
  assert.match(reglas, /request\.resource\.size < 10 \* 1024 \* 1024/);
});

test('los certificados del Sistema de Ascenso siguen con su regla de siempre', () => {
  assert.match(
    reglas,
    /match \/certificados\/\{allPaths=\*\*\} \{\s*allow read: if estaAutenticado\(\);\s*allow write: if estaAutenticado\(\) && puedeGestionarCertificadosAscenso\(\);/
  );
});
