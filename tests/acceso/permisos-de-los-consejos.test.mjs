import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

// ----------------------------------------------------------------------
// El Consejo Nacional y el Consejo Ejecutivo consultan la ESTRUCTURA.
//
// `secciones.ver` es lo que abre el modulo: sin ese codigo la entrada del menu
// ni aparece, y daba igual lo que dijeran los filtros de alcance —que a ellos
// les devuelven todas las secciones—. Tenian los destacamentos y los reportes
// seccionales, pero no la lista por la que se llega a ellos.
//
// Se lee el catalogo tal cual: el fichero arrastra imports por alias y no se
// puede cargar en una prueba suelta, pero los dos cargos declaran su lista de
// permisos escrita a mano, que es justo lo que hay que fijar.
// ----------------------------------------------------------------------

const reparto = fs.readFileSync(
  path.join(process.cwd(), 'src/auth/permissions/role-permissions.js'),
  'utf8'
);

const permisosDe = (rol) => {
  const inicio = reparto.indexOf(`[ROLES.${rol}]: [`);

  assert.notEqual(inicio, -1, `no se encontró la lista de permisos de ${rol}`);

  const fin = reparto.indexOf('\n  ],', inicio);

  return reparto.slice(inicio, fin);
};

for (const consejo of ['CONSEJO_NACIONAL', 'CONSEJO_EJECUTIVO']) {
  test(`el ${consejo} ve la lista de secciones`, () => {
    assert.match(permisosDe(consejo), /PERMISOS\.SECCIONES_VER/);
  });

  test(`y sigue viendo la de destacamentos`, () => {
    assert.match(permisosDe(consejo), /PERMISOS\.DESTACAMENTOS_VER/);
  });

  // Consulta, no gobierno: ninguno de los dos edita la estructura.
  test(`el ${consejo} no edita secciones ni destacamentos`, () => {
    const suyos = permisosDe(consejo);

    assert.doesNotMatch(suyos, /PERMISOS\.SECCIONES_EDITAR/);
    assert.doesNotMatch(suyos, /PERMISOS\.DESTACAMENTOS_EDITAR/);
  });
}
