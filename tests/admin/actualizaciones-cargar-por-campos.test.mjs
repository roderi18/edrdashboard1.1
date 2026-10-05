// CARGAR POR CAMPOS: SOLO LO ELEGIDO, Y SOLO LO QUE DIFIERE.
//
// La carga aplicaba el envío entero: para arreglar un teléfono se volvían a
// escribir el nombre, la dirección y el resto, aunque alguien los hubiera
// corregido a mano (Tigres volvía a "Tigres del 104"). Ahora se eligen los
// campos y lo que ya coincide no cuenta como cambio.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  camposElegidos,
  TODOS_LOS_CAMPOS,
  destacamentoConCampos,
  diferenciasDeDestacamento,
} from '../../src/utils/campos-de-carga.mjs';

const antes = {
  name: 'Tigres',
  destNumber: '104',
  direccion: 'Santo Domingo, Este, , C/ 1',
  registradoOfnc: true,
  rritrackActivo: false,
  destMeetingDays: 'Sábados',
  destMeetingTimes: '17:00:00',
  telefono: '',
};
const datos = {
  nombre: 'Tigres del 104',
  numero: '104',
  registradoOfnc: false,
  diaReunion: 'Sábados',
  horaReunion: '17:00',
  pastor: { telefono: '+18293618531' },
};

test('sin lista de campos se aplican todos (la carga de siempre)', () => {
  assert.equal(camposElegidos().size, TODOS_LOS_CAMPOS.length);
  assert.deepEqual([...camposElegidos(['destTelefono', 'inventado'])], ['destTelefono']);
});

test('eligiendo solo el teléfono, el nombre corregido a mano no se toca', () => {
  const despues = destacamentoConCampos({
    antes,
    datos,
    direccion: '',
    campos: camposElegidos(['destTelefono']),
  });
  assert.equal(despues.name, 'Tigres');
  assert.equal(despues.registradoOfnc, true);
  assert.deepEqual(
    diferenciasDeDestacamento(antes, despues).map((c) => [c.etiqueta, c.despues]),
    [['Teléfono', '+18293618531']]
  );
});

test('"17:00" y "17:00:00" son la misma hora: no es un cambio', () => {
  const despues = destacamentoConCampos({
    antes,
    datos,
    campos: camposElegidos(['destHora', 'destDia']),
  });
  assert.deepEqual(diferenciasDeDestacamento(antes, despues), []);
});

test('el teléfono del pastor no pisa el que el destacamento ya tiene', () => {
  const conTelefono = { ...antes, telefono: '+18095550000' };
  const despues = destacamentoConCampos({
    antes: conTelefono,
    datos,
    campos: camposElegidos(['destTelefono']),
  });
  assert.equal(despues.telefono, '+18095550000');
});

test('con todos los campos, el envío entero se ve como cambios legibles', () => {
  const despues = destacamentoConCampos({ antes, datos, campos: camposElegidos() });
  const cambios = diferenciasDeDestacamento(antes, despues).map((c) => c.etiqueta);
  assert.deepEqual(cambios, ['Nombre', 'Registrado en Oficina Nacional', 'Teléfono']);
  assert.equal(
    diferenciasDeDestacamento(antes, despues).find((c) => c.campo === 'registradoOfnc').despues,
    'No'
  );
});

// Qué se rompía: un envío que corregía la sección (Este Central II) se guardaba
// bien, pero al cargarlo la iglesia se reenviaba con su sección vieja y el
// destacamento seguía en Este Central I.
test('la sección del envío manda al cargar si se elige ese campo', async () => {
  const { seccionConCampos } = await import('../../src/utils/campos-de-carga.mjs');
  const enviada = { id: '12', nombre: 'Este Central II' };
  assert.equal(
    seccionConCampos({ idSeccionAntes: '11', seccionEnviada: enviada, campos: camposElegidos() }),
    '12'
  );
  assert.equal(
    seccionConCampos({
      idSeccionAntes: '11',
      seccionEnviada: enviada,
      campos: camposElegidos(['iglesiaNombre']),
    }),
    '11'
  );
  assert.equal(
    seccionConCampos({ idSeccionAntes: '11', seccionEnviada: null, campos: camposElegidos() }),
    '11'
  );
});
