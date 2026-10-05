// ----------------------------------------------------------------------
// LA FICHA `users/{uid}` YA NO LA ESCRIBE CUALQUIERA.
//
// Qué se rompía: `users` no tenía bloque propio y caía en el comodín del final
// de `firestore.rules`, que deja leer y escribir a toda sesión del sistema. Con
// eso, desde la consola del navegador:
//  - se le cambiaba el nombre o el correo a otra persona;
//  - uno se ponía `rol: 'administrador'` y salía en la lista de administradores
//    y recibía sus avisos (`firebase-admins.js` los busca en `users`);
//  - uno se ponía el `idMiembros` de otro, y `esSuIdMiembro` le dejaba cambiar
//    la foto de perfil de ese otro;
//  - se le ponía `codigoMiembro` a una cuenta suelta, que con eso pasaba
//    `tieneAltaDelServidor()` y entraba a todo el comodín.
// Estas pruebas cuidan que `users` siga fuera del comodín, que la propia
// persona no toque los campos que dan poder o identidad, y que solo quien entra
// a Administración escriba la ficha de otro (y solo el espejo de administrador).
// Son comprobaciones del texto de las reglas, como el resto de `tests/acceso`.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8').replace(
  /\r\n/g,
  '\n'
);

const bloqueUsers = reglas.match(/match \/users\/\{uid\} \{([\s\S]*?)\n    \}/)?.[1] || '';
const funcion = (nombre) =>
  reglas.match(new RegExp(`function ${nombre}\\(\\) \\{([\\s\\S]*?)\\n    \\}`))?.[1] || '';

test('users tiene bloque propio y el comodín ya no lo abre', () => {
  assert.ok(bloqueUsers, 'falta el bloque match /users/{uid}');
  assert.match(reglas, /coleccion != 'users'/);
});

test('la propia persona no se pone rol, permisos ni la identidad de otro', () => {
  const protegidos = funcion('camposProtegidosDeUsers');

  for (const campo of [
    'rol',
    'role',
    'rolId',
    'rolesQueEjerce',
    'permisos',
    'permissions',
    'codigoMiembro',
    'idMiembros',
    'codigoUsuario',
  ]) {
    assert.match(protegidos, new RegExp(`'${campo}'`), campo);
  }

  // Se mira lo que CAMBIA: reenviar el mismo rol no es cambiarlo
  // (`account-general.jsx` lo manda siempre).
  assert.match(
    bloqueUsers,
    /request\.auth\.uid == uid\s*&& !request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\s*\.hasAny\(camposProtegidosDeUsers\(\)\)/
  );
  assert.match(
    bloqueUsers,
    /request\.auth\.uid == uid\s*&& !request\.resource\.data\.keys\(\)\.hasAny\(camposProtegidosDeUsers\(\)\)/
  );
});

test('la ficha de otro solo la escribe quien entra a Administración, y solo el espejo', () => {
  assert.match(funcion('entraAAdministracion'), /ejerceRol\('oficina_nacional'\)/);
  assert.match(funcion('entraAAdministracion'), /ejerceRol\('administrador_funcional'\)/);
  assert.match(
    bloqueUsers,
    /entraAAdministracion\(\)\s*&& request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\s*\.hasOnly\(camposDelEspejoDeAdministracion\(\)\)/
  );

  // El espejo no trae lo que el servidor guarda en `usuarios_roles`.
  const espejo = funcion('camposDelEspejoDeAdministracion');
  assert.doesNotMatch(espejo, /'idMiembros'|'rolesQueEjerce'|'cargos'/);
});

test('el uid de dentro es el de la ruta y nadie borra fichas', () => {
  assert.match(bloqueUsers, /uidCoincide\(uid\)/);
  assert.match(funcion('uidCoincide') || reglas, /request\.resource\.data\.uid == uid/);
  assert.match(bloqueUsers, /allow delete: if false;/);
});

test('las pantallas que escriben users mandan campos que la regla acepta', () => {
  const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

  // Vincular cuentas: nada protegido en su payload.
  const vincular = leer('src/sections/account/account-change-password.jsx');
  const payloadVincular = vincular.match(/const payload = \{([\s\S]*?)\n {4}\};/)?.[1] || '';
  assert.ok(payloadVincular, 'no se encontró el payload de vincular cuentas');
  assert.doesNotMatch(payloadVincular, /\b(rol|role|permisos|codigoMiembro|idMiembros):/);

  // Dar administrador: solo campos del espejo.
  const admins = leer('src/utils/firebase-admins.js');
  const espejo = admins.match(
    /doc\(FIRESTORE, (?:'users'|COLECCIONES\.usuarios), uid\),\s*\{([\s\S]*?)\},\s*\{ merge: true \}/
  )?.[1];
  assert.ok(espejo, 'no se encontró el espejo de administrador en users');
  const camposEspejo = funcion('camposDelEspejoDeAdministracion');
  for (const [, campo] of espejo.matchAll(/^\s*(\w+)[,:]/gm)) {
    assert.match(camposEspejo, new RegExp(`'${campo}'`), campo);
  }
});
