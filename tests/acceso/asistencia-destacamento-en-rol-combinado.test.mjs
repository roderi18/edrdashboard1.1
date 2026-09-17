import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

// ----------------------------------------------------------------------
// ASISTENCIA: EL ADMINISTRADOR GLOBAL PROBANDO UN ROL COMBINADO ELIGE DESTACAMENTO.
//
// La prueba de dos cargos deja la sesion en el destacamento de ejemplo (Tribu de
// Juda 18). Con eso la asistencia se acotaba a el y el desplegable de
// destacamentos desaparecia: para mirar otro habia que apagar la prueba.
//
// Ahora, mientras prueba, ve el selector con todos los destacamentos, y el que
// elige queda grabado en su perfil (`preferencias_usuarios/<uid>`) hasta que lo
// cambie. Solo el Administrador Global puede encender la prueba, asi que detras
// hay siempre alguien que ya ve todos los destacamentos.
// ----------------------------------------------------------------------

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

test('probando un rol combinado no se acota el destacamento y se enseña el selector', () => {
  const vista = leer('src/sections/attendance/view/attendance-quick-view.jsx');

  assert.ok(vista.includes('const probandoRolCombinado = Boolean(user?.simulacion?.activa);'));
  assert.ok(/probandoRolCombinado\s*\?\s*null\s*:\s*getMemberAllowedDestIds\(/.test(vista));
  assert.ok(
    /probandoRolCombinado \|\| \(!scopedToDest && puedeElegirDestacamento\(user\)\)/.test(vista)
  );
});

test('el destacamento elegido se guarda en su perfil y se recupera', () => {
  const vista = leer('src/sections/attendance/view/attendance-quick-view.jsx');
  const servicio = leer('src/services/preferencias-usuario-service.js');

  assert.ok(vista.includes('onChange={(event) => handleCambiarDestacamento(event.target.value)}'));
  assert.ok(vista.includes('guardarDestacamentoDeAsistencia(user.uid, idDestacamento)'));
  assert.ok(vista.includes('obtenerDestacamentoDeAsistencia(user.uid)'));
  assert.ok(
    servicio.includes("export const COLECCION_PREFERENCIAS_USUARIOS = 'preferencias_usuarios';")
  );
  assert.ok(servicio.includes('asistencia: { idDestacamento: String(idDestacamento) }'));
});

test('las reglas: cada uno solo sus preferencias, y el comodin no las abre', () => {
  const reglas = leer('firestore.rules');
  const bloque = reglas.match(/match \/preferencias_usuarios\/\{uid\} \{([\s\S]*?)\n    \}/);

  assert.ok(bloque, 'falta el bloque de preferencias_usuarios');
  assert.ok(bloque[1].includes('allow get: if estaAutenticado() && request.auth.uid == uid;'));
  assert.ok(bloque[1].includes('allow list: if false;'));
  assert.ok(bloque[1].includes('request.resource.data.uid == uid'));
  assert.ok(reglas.includes("&& coleccion != 'preferencias_usuarios'"));
});
