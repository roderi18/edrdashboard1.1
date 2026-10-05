// ----------------------------------------------------------------------
// LA OFICINA NACIONAL VE TODOS LOS DESTACAMENTOS, SECCIONES Y REGIONES.
//
// Qué se rompía: EDR-10049 recibió la Oficina Nacional cuando aún no tenía
// cuenta, así que solo quedó en `usuarios_roles/383`. La cuenta se creó después
// y su perfil por uid nació sin ella; la sincronización del cargo le dejó como
// Coordinador de Destacamento y la ficha de otro destacamento decía "Este
// destacamento no es el tuyo". Además, los guardas preguntaban por la Oficina
// Nacional solo como cargo PRINCIPAL.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { filterDestsByMemberScope, filterSectionalsByMemberScope } =
  await import('../../src/utils/member-access.js');

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

const destacamentos = [
  { id: '454', churchId: '1' },
  { id: '340', churchId: '2' },
];
const secciones = [
  { id: '10', regionalId: '1' },
  { id: '20', regionalId: '2' },
];

// Coordinador de su destacamento con la Oficina Nacional SOLO entre sus cargos.
const coordinadorConOficina = {
  uid: 'edr-10049',
  rolId: 'usuario_destacamento',
  idMiembros: 383,
  cargos: [
    { rol: 'usuario_destacamento', nivel: 'destacamento', idEntidad: '454' },
    { rol: 'oficina_nacional', nivel: 'nacional' },
  ],
  alcance: { modo: 'destacamento', destacamentos: ['454'] },
};

test('ve todos los destacamentos aunque la Oficina no sea su cargo principal', () => {
  const vistos = filterDestsByMemberScope(destacamentos, coordinadorConOficina, {
    churches: [],
    sectionals: secciones,
  });
  assert.deepEqual(
    vistos.map((d) => d.id),
    ['454', '340']
  );
});

test('ve todas las secciones aunque la Oficina no sea su cargo principal', () => {
  const vistas = filterSectionalsByMemberScope(secciones, coordinadorConOficina, {
    dests: destacamentos,
    churches: [],
  });
  assert.equal(vistas.length, 2);
});

test('la sincronización rescata el rol a mano del perfil por número de miembro', () => {
  for (const ruta of [
    'src/app/api/auth/sincronizar-rol/route.js',
    'src/app/api/admin/sincronizar-roles/route.js',
  ]) {
    const codigo = leer(ruta);
    assert.match(codigo, /rolDelNumero/, ruta);
    assert.match(codigo, /ROLES_QUE_NO_SALEN_DE_UNA_CASILLA\.includes\(rolDelNumero\)/, ruta);
  }
});
