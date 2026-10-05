// LAS PERSONAS DE UN ENVÍO DE ACTUALIZACIÓN SE DAN DE ALTA AL CARGARLO.
//
// La carga no tocaba al coordinador ni a quien enviaba: el coordinador escrito
// como "persona nueva" no existía en la aplicación y su casilla seguía con el
// de antes. Ahora se crean y la bandeja dice a quién: "Se creó nuevo
// Coordinador", "Se creó persona que envía" o "Se crearon ambas personas".
// Si quien envía ES el coordinador, es una sola persona y se crea una vez.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cambiosDeFicha,
  personasDelEnvio,
  esLaMismaPersona,
  esElMiembroDelEnvio,
  textoPersonasCreadas,
  esDestacamentoProvisional,
} from '../../src/utils/personas-del-envio.mjs';

const envio = ({ coordinador, enviadoPor, miembro }) => ({
  datos: { coordinador },
  enviadoPor,
  miembro,
});

test('quien envía y el coordinador nuevos con el mismo teléfono son una sola persona', () => {
  const { coordinador, enviador, mismaPersona } = personasDelEnvio(
    envio({
      coordinador: {
        idMiembro: null,
        nombres: 'Jainel',
        apellidos: 'Solano',
        telefono: '+18294802555',
      },
      enviadoPor: { nombre: 'Jainel Solano', idMiembro: null, telefono: '+18294802555' },
      miembro: { nombres: 'Jainel', apellidos: 'Solano' },
    })
  );
  assert.equal(coordinador.idMiembro, null);
  assert.deepEqual([enviador.nombres, enviador.apellidos], ['Jainel', 'Solano']);
  assert.equal(mismaPersona, true);
});

test('un coordinador nuevo y quien envía ya registrado son dos personas', () => {
  const { coordinador, enviador, mismaPersona } = personasDelEnvio(
    envio({
      coordinador: {
        idMiembro: null,
        nombres: 'Diner',
        apellidos: 'Rodriguez',
        telefono: '+18296765468',
      },
      enviadoPor: { nombre: 'Eliezer García', idMiembro: '383', telefono: '+18293835534' },
      miembro: { nombres: 'Eliezer', apellidos: 'García' },
    })
  );
  assert.equal(coordinador.nombres, 'Diner');
  assert.equal(enviador.idMiembro, '383');
  assert.equal(mismaPersona, false);
});

test('sin el nombre partido, el de quien envía se parte como el del Pastor', () => {
  const { enviador } = personasDelEnvio(
    envio({ enviadoPor: { nombre: 'Cristhina Esther Pérez Reynoso', idMiembro: null } })
  );
  assert.deepEqual([enviador.nombres, enviador.apellidos], ['Cristhina Esther', 'Pérez Reynoso']);
});

test('el nombre se compara sin tildes ni mayúsculas', () => {
  assert.equal(
    esLaMismaPersona(
      { nombres: 'Joaquín', apellidos: 'Martínez' },
      { nombres: 'joaquin', apellidos: 'MARTINEZ' }
    ),
    true
  );
  assert.equal(esLaMismaPersona({ idMiembro: '1' }, { idMiembro: '2' }), false);
});

test('"Wagner Antonio Betances" del envío es el "Wagner Betances" del padrón', () => {
  assert.equal(
    esElMiembroDelEnvio(
      { nombres: 'Wagner Antonio', apellidos: 'Betances' },
      { nombres: 'Wagner', apellidos: 'Betances', telefono: '' }
    ),
    true
  );
  assert.equal(
    esElMiembroDelEnvio(
      { nombres: 'Carlos', apellidos: 'González' },
      { nombres: 'Carla', apellidos: 'González' }
    ),
    false
  );
});

test('el destacamento Provisional se reconoce por su nombre', () => {
  assert.equal(esDestacamentoProvisional({ nombre: 'Provisional ' }), true);
  assert.equal(esDestacamentoProvisional({ nombre: 'Tigres' }), false);
});

test('la bandeja dice a quién se creó', () => {
  const coordinador = { idMiembro: '900', nombre: 'Diner Rodriguez' };
  const enviador = { idMiembro: '901', nombre: 'Federico Muñoz' };
  assert.equal(textoPersonasCreadas({ coordinador }), 'Se creó nuevo Coordinador');
  assert.equal(textoPersonasCreadas({ enviador }), 'Se creó persona que envía');
  assert.equal(textoPersonasCreadas({ coordinador, enviador }), 'Se crearon ambas personas');
  // La misma persona en los dos papeles: se creó una sola.
  assert.equal(
    textoPersonasCreadas({ coordinador, enviador: { ...coordinador } }),
    'Se creó nuevo Coordinador'
  );
  assert.equal(textoPersonasCreadas({}), '');
  assert.equal(textoPersonasCreadas(undefined), '');
});

// Rolando Figuereo (coordinador) y Enrique Rodríguez (quien envió) ya existían:
// la carga no les ponía el teléfono del formulario y Enrique seguía en
// "Provisional" siendo de Los Tira Piedras.
test('quien envía deja su teléfono aunque la ficha tuviera otro', () => {
  const { ponerTelefono } = cambiosDeFicha({
    destacamentoFicha: '516',
    telefonoFicha: '+18090000001',
    telefonoEnvio: '+18098973930',
    esSuyo: true,
    idProvisional: '234',
  });
  assert.equal(ponerTelefono, true);
});

test('el teléfono del coordinador solo llena un hueco', () => {
  const base = { destacamentoFicha: '516', telefonoEnvio: '+18298109763', esSuyo: false };
  assert.equal(cambiosDeFicha({ ...base, telefonoFicha: '' }).ponerTelefono, true);
  assert.equal(cambiosDeFicha({ ...base, telefonoFicha: '+18095550000' }).ponerTelefono, false);
});

test('el mismo número escrito distinto no se vuelve a guardar', () => {
  const { ponerTelefono } = cambiosDeFicha({
    destacamentoFicha: '516',
    telefonoFicha: '8098973930',
    telefonoEnvio: '+18098973930',
    esSuyo: true,
  });
  assert.equal(ponerTelefono, false);
});

test('quien está en Provisional pasa al destacamento del envío', () => {
  assert.equal(cambiosDeFicha({ destacamentoFicha: '234', idProvisional: '234' }).mover, true);
  assert.equal(cambiosDeFicha({ destacamentoFicha: '516', idProvisional: '234' }).mover, false);
});
