import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COLECCIONES,
  DEFINICIONES_COLECCIONES,
  VERSION_ESQUEMA_FIRESTORE,
  nombreColeccion,
} from '../../src/config/esquema-firestore.mjs';
import {
  nombreCampoCanonico,
  normalizarCamposFirestore,
} from '../../src/config/campos-firestore.mjs';

test('los nombres canonicos son camelCase sin guiones bajos', () => {
  for (const [clave, definicion] of Object.entries(DEFINICIONES_COLECCIONES)) {
    assert.match(clave, /^[a-z][A-Za-z0-9]*$/, `Clave invalida: ${clave}`);
    assert.match(
      definicion.canonico,
      /^[a-z][A-Za-z0-9]*$/,
      `Coleccion canonica invalida: ${definicion.canonico}`
    );
    assert.equal(definicion.canonico.includes('_'), false);
  }
});

test('el esquema heredado es el valor seguro por defecto', () => {
  assert.equal(VERSION_ESQUEMA_FIRESTORE, 'heredado');
  assert.equal(COLECCIONES.usuarios, 'users');
  assert.equal(COLECCIONES.usuariosRoles, 'usuarios_roles');
  assert.equal(nombreColeccion('usuarios', 'canonico'), 'usuarios');
  assert.equal(nombreColeccion('usuariosRoles', 'canonico'), 'usuariosRoles');
});

test('normaliza campos seguros y reporta colisiones', () => {
  assert.equal(nombreCampoCanonico('idMiembros'), 'idMiembro');
  assert.deepEqual(normalizarCamposFirestore({ idMiembros: 10, createdAt: 'fecha' }), {
    idMiembro: 10,
    fechaCreacion: 'fecha',
  });

  const conflictos = [];
  const resultado = normalizarCamposFirestore(
    { idMiembro: 10, idMiembros: 11 },
    conflictos
  );
  assert.deepEqual(resultado, { idMiembro: 10 });
  assert.equal(conflictos.length, 1);
});

