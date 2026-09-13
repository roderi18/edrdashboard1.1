import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const REGLAS = fs.readFileSync('firestore.rules', 'utf8');

// ----------------------------------------------------------------------
// AL ADMINISTRADOR GLOBAL NINGUNA REGLA LE DICE QUE NO.
//
// Le salia "Missing or insufficient permissions" en sus propias pantallas. Eran
// dos agujeros distintos, y los dos se cierran aqui:
//
//   1. Cada bloque de reglas nombra a quien puede entrar, y basta que UNO se
//      olvide del Administrador Global para cerrarle la puerta. Arreglarlo bloque
//      por bloque deja el mismo agujero abierto para el siguiente que se escriba.
//   2. `esAdministradorGlobal()` solo miraba el claim del token y el campo
//      `rolId`. Las cuentas anteriores al catalogo de cargos llevan
//      `rol: 'administrador'` y nada mas: las reglas no las reconocian.
//
// Las reglas de Firestore se SUMAN, asi que el comodin del final no debilita
// nada de lo de arriba: nadie mas gana acceso.
// ----------------------------------------------------------------------

test('el Administrador Global tiene un pase que ninguna regla puede negar', () => {
  // Dos bloques: el simple no alcanza a las subcolecciones.
  assert.match(
    REGLAS,
    /match \/\{coleccion\}\/\{documento\} \{\s*allow read, write: if coleccion != 'secretos_acceso' && esAdministradorGlobal\(\);\s*\}/
  );
  assert.match(
    REGLAS,
    /match \/\{coleccion\}\/\{documento\}\/\{resto=\*\*\} \{\s*allow read, write: if coleccion != 'secretos_acceso' && esAdministradorGlobal\(\);\s*\}/
  );
});

test('las huellas de las contraseñas siguen sin abrirse para nadie', () => {
  // No es desconfianza: leerlas no devuelve ninguna clave, pero se pueden atacar
  // SIN CONEXION si se filtran. Ni el Administrador Global entra.
  assert.match(REGLAS, /match \/secretos_acceso\/\{idUsuario\} \{\s*allow read, write: if false;/);

  const pases = REGLAS.match(/coleccion != 'secretos_acceso' && esAdministradorGlobal\(\)/g) || [];
  assert.equal(pases.length, 2, 'los dos bloques del pase excluyen la coleccion');
});

test('se reconoce tambien a las cuentas anteriores al catalogo de cargos', () => {
  assert.match(REGLAS, /function rolHeredadoDelDocumento\(\)/);
  assert.match(REGLAS, /rolHeredadoDelDocumento\(\) == 'administrador_global'/);
  assert.match(REGLAS, /rolHeredadoDelDocumento\(\) == 'administrador'/);
});

test('el campo heredado se lee de usuarios_roles, NUNCA de users', () => {
  const funcion = REGLAS.slice(
    REGLAS.indexOf('function rolHeredadoDelDocumento()'),
    REGLAS.indexOf('function esAdministradorGlobal()')
  );

  // `usuarios_roles` es `allow write: if false` para el cliente, asi que lo que
  // diga es del servidor. En `users/{uid}` hay un campo `rol` parecido que se lo
  // escribe el propio navegador: leerlo ahi seria dejar que cualquiera se pusiera
  // 'administrador'.
  assert.match(funcion, /rutaAsignacion\(\)/);
  assert.doesNotMatch(funcion, /documents\/users\//);
  assert.match(
    REGLAS,
    /match \/usuarios_roles\/\{idUsuario\} \{\s*allow read: if esUsuarioDelSistema\(\);\s*allow write: if false;/
  );
});

test('la cuenta del selector de rol se queda con documento propio', () => {
  const ruta = fs.readFileSync('src/app/api/auth/sincronizar-rol/route.js', 'utf8');

  // Salia sin escribir nada, y si su ficha estaba guardada por numero de miembro
  // —como la mayoria de las antiguas— se quedaba sin el documento que miran las
  // reglas para saber su cargo.
  assert.match(ruta, /if \(existente\.exists\) \{/);
  assert.match(ruta, /rolId: 'administrador_global'/);
  // Y si ya existe no se toca: ahi esta su seleccion manual de rol.
  const bloque = ruta.slice(
    ruta.indexOf('if (puedeUsarSelectorDeRol(caller.email))'),
    ruta.indexOf('// Solo se sincroniza a si misma')
  );
  assert.ok(
    bloque.indexOf('if (existente.exists)') < bloque.indexOf('await suyo.set('),
    'primero se comprueba que no exista y solo despues se escribe'
  );
});

test('las llaves del archivo de reglas cuadran', () => {
  // El pase nuevo son dos bloques mas: si alguno quedara sin cerrar, el archivo
  // no desplegaria y el fallo se veria en produccion, no aqui.
  const abiertas = (REGLAS.match(/\{/g) || []).length;
  const cerradas = (REGLAS.match(/\}/g) || []).length;

  assert.equal(abiertas, cerradas);
});
