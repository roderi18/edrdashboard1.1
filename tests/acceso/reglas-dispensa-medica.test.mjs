import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

// ----------------------------------------------------------------------
// La ficha medica no es de todo el mundo.
//
// `firestore.rules` termina con un comodin que concede lectura Y escritura a
// cualquier usuario con cuenta sobre toda coleccion no listada antes. La
// Dispensa Medica caia ahi: un Usuario Comun leia y escribia la ficha medica de
// cualquier miembro —menores incluidos— desde la consola del navegador.
//
// Estas pruebas no ejecutan las reglas (haria falta el emulador); fijan que las
// colecciones sigan FUERA del comodin y con su bloque propio. Es la parte que se
// puede perder de un tiron: basta con que alguien anada una coleccion nueva y se
// olvide de excluirla, o borre el bloque al reordenar el fichero.
// ----------------------------------------------------------------------

const reglas = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');

const COLECCIONES_MEDICAS = [
  'informacion_medica_basica_miembros',
  'alergias_miembros',
  'medicamentos_miembros',
  'condiciones_medicas_miembros',
  'documentos_salud_miembros',
  'solicitudes_acceso_dispensa_medica',
];

const COLAS_DE_APROBACION = ['solicitudes_cambio', 'solicitudes_cambio_miembro'];

const comodin = reglas.slice(reglas.indexOf('match /{coleccion}/{documento=**}'));

for (const coleccion of [...COLECCIONES_MEDICAS, ...COLAS_DE_APROBACION]) {
  test(`${coleccion} tiene su propio bloque de reglas`, () => {
    assert.ok(
      reglas.includes(`match /${coleccion}/`),
      `${coleccion} no tiene bloque propio: cae en el comodin`
    );
  });

  test(`${coleccion} esta excluida del comodin`, () => {
    assert.ok(
      comodin.includes(`coleccion != '${coleccion}'`),
      `${coleccion} no esta excluida: el comodin le devuelve la escritura a cualquiera`
    );
  });
}

test('la ficha medica se lee con el permiso del cargo, no por tener cuenta', () => {
  assert.match(reglas, /function puedeVerSalud\(\)[\s\S]{0,120}tienePermisoDeCargo\('salud\.ver'\)/);
  assert.match(reglas, /function puedeEditarSalud\(\)[\s\S]{0,120}tienePermisoDeCargo\('salud\.editar'\)/);
});

// Subir y eliminar documentos medicos son permisos distintos: esa diferencia es
// la que separa al Coordinador de los demas cargos del destacamento.
test('los documentos medicos distinguen subir de eliminar', () => {
  const bloque = reglas.slice(
    reglas.indexOf('match /documentos_salud_miembros/'),
    reglas.indexOf('match /solicitudes_acceso_dispensa_medica/')
  );

  assert.match(bloque, /allow create, update:[\s\S]{0,160}salud\.subir_documentos/);
  assert.match(bloque, /allow delete:[\s\S]{0,160}salud\.eliminar_documentos/);
});

// Lo que impide que alguien se apruebe a si mismo el acceso a la ficha medica de
// un menor: puede marcar que gasto su permiso, y nada mas.
test('el solicitante de acceso solo puede marcar el consumo', () => {
  const bloque = reglas.slice(
    reglas.indexOf('match /solicitudes_acceso_dispensa_medica/'),
    reglas.indexOf('match /solicitudes_cambio_miembro/')
  );

  assert.match(bloque, /affectedKeys\(\)\s*\n?\s*\.hasOnly\(\['fechaConsumo', 'consumidoPorUid', 'actualizadoEnServidor'\]\)/);
  assert.doesNotMatch(bloque, /allow delete: if true/);
});

// Nadie propone a nombre de otro, y una propuesta resuelta no se borra.
for (const cola of COLAS_DE_APROBACION) {
  test(`${cola}: se crea a su nombre y no se borra`, () => {
    const desde = reglas.indexOf(`match /${cola}/`);
    const bloque = reglas.slice(desde, desde + 900);

    assert.match(bloque, /allow create:[\s\S]{0,200}solicitadoPorUid == request\.auth\.uid/);
    assert.match(bloque, /allow delete: if false/);
  });
}

// ----------------------------------------------------------------------
// La bitacora se anade a su nombre y de nadie mas.
//
// Se podia escribir "el Coordinador aprobo X" desde la cuenta de cualquiera, y
// la bitacora es justo lo que se mira cuando algo no cuadra.
// ----------------------------------------------------------------------

test('una entrada de auditoria no puede ir a nombre de otro', () => {
  const desde = reglas.indexOf('match /auditoria_sistema/');
  const bloque = reglas.slice(desde, desde + 400);

  assert.match(bloque, /allow create: if esUsuarioDelSistema\(\) && laAuditoriaVaASuNombre\(\)/);
  assert.match(bloque, /allow update, delete: if false/);
  assert.match(
    reglas,
    /realizadoPor\.idUsuario == request\.auth\.uid/
  );
});
