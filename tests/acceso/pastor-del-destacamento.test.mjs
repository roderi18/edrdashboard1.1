import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// El Pastor de la iglesia lo llevan los cargos del destacamento y los de la
// seccion, sobre SU destacamento, y lo aprueba la Oficina Nacional. Aqui se
// comprueban las dos mitades: quien puede tocarlo y por donde sale el cambio.

const { canEditDest, requiereRevisionDeAdministradorGlobal } = await import(
  '../../src/utils/org-level-access.js'
);
// Los servicios de Firestore se importan en cadena y hay un ciclo entre la
// puerta de cambios y las directivas (via miembros). Cargando primero las
// directivas, la puerta termina de evaluarse antes de que nadie la lea.
await import('../../src/services/directivas-organizacionales-service.js');

const { AMBITOS_CAMBIO, requiereAprobacionDeOficinaNacional } = await import(
  '../../src/services/solicitudes-cambio-service.js'
);

const DEST = { id: '231', idDestacamento: '231', idSeccion: '7', seccionId: '7' };

const conCargo = (rol, alcance) => ({
  uid: `usuario-${rol}`,
  rolId: rol,
  cargos: [{ rol, ...(alcance.idEntidad ? { idEntidad: alcance.idEntidad } : {}) }],
  alcance: alcance.sesion,
});

const CARGOS_DEL_DESTACAMENTO = ['usuario_destacamento', 'usuario_destacamento_asistente'];
const CARGOS_DE_SECCION = ['usuario_seccion', 'usuario_seccion_asistente'];

for (const rol of CARGOS_DEL_DESTACAMENTO) {
  test(`${rol} responde por su propio destacamento`, () => {
    const usuario = conCargo(rol, { idEntidad: '231', sesion: { destacamentos: ['231'] } });

    assert.equal(canEditDest(usuario, DEST), true);
  });

  test(`${rol} no responde por un destacamento ajeno`, () => {
    const usuario = conCargo(rol, { idEntidad: '999', sesion: { destacamentos: ['999'] } });

    assert.equal(canEditDest(usuario, DEST), false);
  });
}

for (const rol of CARGOS_DE_SECCION) {
  test(`${rol} responde por los destacamentos de su seccion`, () => {
    const usuario = conCargo(rol, { idEntidad: '7', sesion: { secciones: ['7'] } });

    assert.equal(canEditDest(usuario, DEST), true);
  });

  test(`${rol} no responde por los de otra seccion`, () => {
    const usuario = conCargo(rol, { idEntidad: '3', sesion: { secciones: ['3'] } });

    assert.equal(canEditDest(usuario, DEST), false);
  });
}

test('el cambio de Pastor lo aprueba la Oficina Nacional', () => {
  assert.equal(AMBITOS_CAMBIO.pastorDestacamento, 'pastor_destacamento');
  assert.equal(requiereAprobacionDeOficinaNacional(AMBITOS_CAMBIO.pastorDestacamento), true);
});

test('la Oficina Nacional con cargo en el destacamento no se firma su propio Pastor', () => {
  const usuario = {
    uid: 'oficina-con-cargo',
    rolId: 'oficina_nacional',
    cargos: [
      { rol: 'oficina_nacional', nivel: 'nacional' },
      { rol: 'usuario_destacamento', nivel: 'destacamento', idEntidad: '231' },
    ],
    alcance: { destacamentos: ['231'] },
  };

  assert.equal(requiereRevisionDeAdministradorGlobal(usuario, 'pastor_destacamento'), true);
});
