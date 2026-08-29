import test from 'node:test';
import assert from 'node:assert/strict';

// Se prueba la regla, no el modulo entero: `member-access` arrastra Firebase y
// no se puede importar en una prueba suelta. La logica es la misma que la del
// filtro: la ficha propia siempre, y del resto solo los de su destacamento.
const normalizar = (valor) => String(valor ?? '').trim();

const filtrar = (miembros, user) => {
  const propios = new Set([normalizar(user.idDestacamento)].filter(Boolean));
  const idPropio = normalizar(user.idMiembros);

  // Quien solo ejerce cargos por encima del destacamento no lleva ninguno en su
  // alcance: se saca de su propia ficha, que ya viene en la lista.
  if (!propios.size && idPropio) {
    const suFicha = miembros.find((miembro) => normalizar(miembro.id) === idPropio);
    const suDestacamento = normalizar(suFicha?.idDestacamento);

    if (suDestacamento) propios.add(suDestacamento);
  }

  return miembros.filter((miembro) => {
    if (idPropio && normalizar(miembro.id) === idPropio) return true;

    const suDest = normalizar(miembro.idDestacamento);

    return Boolean(suDest) && propios.has(suDest);
  });
};

const MIEMBROS = [
  { id: 326, nombre: 'Roderi', idDestacamento: 231 },
  { id: 340, nombre: 'Daniel', idDestacamento: 231 },
  { id: 323, nombre: 'Stalin', idDestacamento: 233 },
  { id: 999, nombre: 'Sin destacamento', idDestacamento: null },
];

const USUARIO = { idMiembros: 326, idDestacamento: 231 };

test('solo ve a los de su destacamento', () => {
  const vistos = filtrar(MIEMBROS, USUARIO).map((m) => m.nombre);

  assert.deepEqual(vistos, ['Roderi', 'Daniel']);
});

test('los de otro destacamento no aparecen', () => {
  assert.equal(
    filtrar(MIEMBROS, USUARIO).some((m) => m.nombre === 'Stalin'),
    false
  );
});

test('quien no tiene destacamento no aparece para nadie mas', () => {
  assert.equal(
    filtrar(MIEMBROS, USUARIO).some((m) => m.nombre === 'Sin destacamento'),
    false
  );
});

test('su propia ficha aparece aunque no tenga destacamento', () => {
  const huerfano = { idMiembros: 999, idDestacamento: '' };

  assert.deepEqual(
    filtrar(MIEMBROS, huerfano).map((m) => m.nombre),
    ['Sin destacamento']
  );
});

// Un cargo de seccion, region o Consejo Nacional no tiene destacamento en su
// alcance —ese alcance se arma con sus cargos—, pero pertenece a uno y a los
// suyos los ve.
test('un cargo de otro nivel ve a los de su propio destacamento', () => {
  const coordinadorSeccional = { idMiembros: 340, idDestacamento: '' };

  assert.deepEqual(
    filtrar(MIEMBROS, coordinadorSeccional).map((m) => m.nombre),
    ['Roderi', 'Daniel']
  );
});

test('y sigue sin ver los de otro destacamento', () => {
  const coordinadorSeccional = { idMiembros: 340, idDestacamento: '' };

  assert.equal(
    filtrar(MIEMBROS, coordinadorSeccional).some((m) => m.nombre === 'Stalin'),
    false
  );
});

test('un cargo que ya tiene destacamento propio no cambia de alcance', () => {
  const conCargoLocal = { idMiembros: 323, idDestacamento: 233 };

  assert.deepEqual(
    filtrar(MIEMBROS, conCargoLocal).map((m) => m.nombre),
    ['Stalin']
  );
});
