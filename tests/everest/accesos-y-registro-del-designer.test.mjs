// ----------------------------------------------------------------------
// EXPEDITION DESIGNER: "ACCESOS" Y "REGISTRO" (solo el Administrador Global).
//
// Qué se pedía:
//  - Accesos: a quién (un usuario o un rol), a qué pestañas y para qué (crear,
//    editar, eliminar). Antes la única excepción (la Oficina Nacional en las
//    insignias) estaba escrita en el código.
//  - Registro: lo guardado, editado y eliminado en todas las pestañas, con fecha,
//    hora y persona, también lo que entre nuevo al Designer.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../soporte/resolver-alias-src.mjs';

const { sanearRegla, accesoDesigner, reglasDeAccesos, REGLAS_DE_FABRICA, documentoDeAccesos } =
  await import('../../src/utils/accesos-designer.mjs');
const { accionDelRegistro, pestanaDelRegistro, personaDelRegistro } =
  await import('../../src/utils/registro-designer.mjs');

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

const regla = (extra) =>
  sanearRegla({
    tipo: 'rol',
    clave: 'oficina_nacional',
    pestanas: ['cintas'],
    acciones: [],
    ...extra,
  });

test('sin documento valen las de fábrica: la Oficina Nacional crea y edita insignias', () => {
  const reglas = reglasDeAccesos(null);
  const oficina = accesoDesigner({ roles: ['oficina_nacional'], reglas });

  assert.deepEqual(
    reglas,
    REGLAS_DE_FABRICA.map((r) => ({ ...r }))
  );
  assert.deepEqual(oficina.pestanas, ['cintas', 'medallas', 'pines']);
  assert.equal(oficina.puede('medallas', 'crear'), true);
  assert.equal(oficina.puede('medallas', 'eliminar'), false);
  assert.equal(oficina.puede('portada', 'ver'), false);
});

test('por usuario y por rol, y varias reglas que alcanzan a la misma persona se suman', () => {
  const reglas = [
    regla({ pestanas: ['cintas'], acciones: ['crear'] }),
    sanearRegla({ tipo: 'usuario', clave: 'uid-1', pestanas: ['portada'], acciones: ['editar'] }),
  ];
  const ambas = accesoDesigner({ uid: 'uid-1', roles: ['oficina_nacional'], reglas });
  const soloRol = accesoDesigner({ uid: 'otro', roles: ['oficina_nacional'], reglas });

  assert.deepEqual(ambas.pestanas, ['portada', 'cintas']);
  assert.equal(ambas.puede('portada', 'editar'), true);
  assert.equal(soloRol.puede('portada', 'editar'), false);
  assert.equal(soloRol.puede('cintas', 'crear'), true);
});

test('sin acciones, solo ve; el Administrador Global lo puede todo', () => {
  const reglas = [regla({ pestanas: ['paleta'], acciones: [] })];
  const oficina = accesoDesigner({ roles: ['oficina_nacional'], reglas });

  assert.equal(oficina.puede('paleta', 'ver'), true);
  assert.equal(oficina.puede('paleta', 'editar'), false);
  assert.equal(
    accesoDesigner({ esAdministradorGlobal: true, reglas: [] }).puede('portada', 'eliminar'),
    true
  );
});

test('una regla sin a quién o sin pestañas no vale', () => {
  assert.equal(sanearRegla({ tipo: 'rol', clave: '', pestanas: ['cintas'] }), null);
  assert.equal(sanearRegla({ tipo: 'rol', clave: 'x', pestanas: [] }), null);
  assert.equal(sanearRegla({ tipo: 'otro', clave: 'x', pestanas: ['cintas'] }), null);
});

test('se guarda el índice que leen las reglas de seguridad', () => {
  const { permisos } = documentoDeAccesos([
    regla({ pestanas: ['cintas'], acciones: ['crear'] }),
    sanearRegla({ tipo: 'usuario', clave: 'uid-1', pestanas: ['cintas'], acciones: ['crear'] }),
  ]);

  assert.deepEqual(permisos['cintas:crear'], { usuarios: ['uid-1'], roles: ['oficina_nacional'] });
  assert.deepEqual(permisos['cintas:ver'], { usuarios: ['uid-1'], roles: ['oficina_nacional'] });
  assert.equal(permisos['cintas:eliminar'], undefined);
});

test('las reglas de seguridad leen ese índice', () => {
  const firestore = leer('firestore.rules');
  const storage = leer('storage.rules');

  assert.match(firestore, /get\(rutaAccesosDesigner\(\)\)\.data\.get\('permisos', \{\}\)/);
  assert.match(
    firestore,
    /match \/configuracion_designer\/\{documento\} \{[\s\S]*?allow write: if esAdministradorGlobal\(\);/
  );
  assert.match(firestore, /coleccion != 'configuracion_designer'/);
  assert.match(
    firestore,
    /match \/everest_publicado\/\{pantalla\} \{[\s\S]*?permisoDesigner\('portada', 'editar'\)/
  );
  assert.match(storage, /subeConAccesoDesigner\(pestanaDeCarpetaDesigner\(carpetaDesigner\)\)/);
});

test('el registro clasifica cada cambio por pestaña y acción, con la persona', () => {
  assert.equal(pestanaDelRegistro({ entidad: { tipo: 'insignia_medalla' } }), 'medallas');
  assert.equal(
    pestanaDelRegistro({ entidad: { tipo: 'configuracion_cintas', id: 'orden-pines' } }),
    'pines'
  );
  assert.equal(
    pestanaDelRegistro({ entidad: { ruta: '/dashboard/explora-designer?seccion=tarjeta' } }),
    'tarjeta'
  );
  assert.equal(
    pestanaDelRegistro({ entidad: { ruta: '/dashboard/explora-designer?bloque=x' } }),
    'portada'
  );
  assert.equal(
    accionDelRegistro({ descripcion: 'EXPEDITION Designer: se eliminó la cinta X.' }),
    'eliminar'
  );
  assert.equal(
    accionDelRegistro({ descripcion: 'EXPEDITION Designer: se editó el pin X.' }),
    'editar'
  );
  assert.equal(
    accionDelRegistro({ descripcion: 'Nueva medalla en EXPEDITION Designer: X.' }),
    'guardar'
  );
  assert.equal(personaDelRegistro({ realizadoPor: { nombre: 'Ana' } }), 'Ana');
});

test('todo lo del Designer, también el orden global, se registra con su ámbito', () => {
  ['cintas', 'medallas', 'pines'].forEach((tipo) => {
    assert.match(
      leer(`src/services/${tipo}-miembros-service.js`),
      /Es de EXPEDITION Designer: sale en su pestaña "Registro"\.\s*ambito: AMBITOS_CAMBIO\.everestDesigner,/
    );
  });
  assert.match(leer('src/services/audit-log-service.js'), /where\('modulo', '==', modulo\)/);
});

// "EXPEDITION" lleva "edit" dentro: al renombrar EXPLORA, todo lo guardado en el
// Designer empezó a salir como "Editó".
test('"EXPEDITION Designer" no hace pasar un guardado por una edición', () => {
  assert.equal(
    accionDelRegistro({ descripcion: 'Nueva medalla en EXPEDITION Designer: X.' }),
    'guardar'
  );
  assert.equal(
    accionDelRegistro({ descripcion: 'Publicó "Portada" desde EXPEDITION Designer.' }),
    'guardar'
  );
  assert.equal(
    accionDelRegistro({ descripcion: 'EXPEDITION Designer: se editó el pin X.' }),
    'editar'
  );
});
