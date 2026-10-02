// ----------------------------------------------------------------------
// EDITAR Y ELIMINAR CINTAS, MEDALLAS Y PINES (también los de fábrica).
//
// Qué se pedía: en EXPLORA Designer → Cintas, Medallas y Pines, editar y eliminar
// todas. Las de fábrica viven en `public/` y en producción no se tocan: se guarda
// un AJUSTE (nombre, descripción, imagen u `oculta`). Una añadida se elimina
// marcándola `activo: false`: las ya asignadas siguen apuntando a su id, pero
// dejan de pintarse. Agregan y editan Administrador Global y Oficina Nacional;
// eliminar y ordenar, solo el Administrador Global.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../soporte/resolver-alias-src.mjs';

const {
  aplicarAjustes,
  separarInsignias,
  idDeAjusteDeFabrica,
  ajusteDesdeDocumento,
  insigniaDesdeDocumento,
} = await import('../../src/utils/insignias-personalizadas.mjs');
const { catalogoDeCintas, obtenerCintaPerfil, registrarCintasPersonalizadas } =
  await import('../../src/utils/cintas-perfil.mjs');

const SRC = 'https://firebasestorage.googleapis.com/v0/b/x/o/everest%2Finsignias-medalla%2Fa.webp';
const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('el ajuste de una de fábrica cambia nombre, descripción e imagen', () => {
  const catalogo = [
    { id: '7', nombre: 'Vieja', descripcion: '', src: '/m/7.webp', srcPequena: '/m/7s.webp' },
  ];
  const [medalla] = aplicarAjustes(catalogo, {
    7: { nombre: 'Nueva', descripcion: 'Texto', src: SRC, oculta: false },
  });

  assert.equal(medalla.nombre, 'Nueva');
  assert.equal(medalla.descripcion, 'Texto');
  assert.equal(medalla.src, SRC);
  assert.equal(medalla.srcPequena, SRC);
});

test('una de fábrica eliminada deja de estar en el catálogo', () => {
  assert.deepEqual(aplicarAjustes([{ id: '7' }, { id: '8' }], { 7: { oculta: true } }), [
    { id: '8' },
  ]);
});

test('una imagen que no es de nuestro Storage no reemplaza a la de la carpeta', () => {
  const ajuste = ajusteDesdeDocumento({
    fabrica: true,
    tipo: 'medalla',
    idFabrica: '7',
    src: 'https://otro.sitio/x.png',
  });

  assert.equal(ajuste.src, undefined);
});

test('una añadida eliminada no se pinta, y los ajustes se separan por tipo', () => {
  const viva = { id: 'p1', tipo: 'medalla', nombre: 'Viva', src: SRC };

  assert.equal(insigniaDesdeDocumento({ ...viva, activo: false }), null);

  const { medallas, ajustes } = separarInsignias([
    viva,
    {
      id: idDeAjusteDeFabrica('pin', 'a/b'),
      fabrica: true,
      tipo: 'pin',
      idFabrica: 'a/b',
      oculta: true,
    },
  ]);

  assert.equal(medallas.length, 1);
  assert.equal(ajustes.pin['a/b'].oculta, true);
  assert.equal(idDeAjusteDeFabrica('pin', 'a/b'), 'f-pin-a-b');
});

test('las cintas de fábrica toman su ajuste y la eliminada no se encuentra', () => {
  const [primera, segunda] = catalogoDeCintas();

  registrarCintasPersonalizadas([], {
    [primera.id]: { nombre: 'Cinta renombrada' },
    [segunda.id]: { oculta: true },
  });

  assert.equal(obtenerCintaPerfil(primera.id).nombre, 'Cinta renombrada');
  assert.equal(obtenerCintaPerfil(segunda.id), null);
  assert.ok(!catalogoDeCintas().some((cinta) => cinta.id === segunda.id));

  registrarCintasPersonalizadas([], {});
  assert.ok(obtenerCintaPerfil(segunda.id));
});

// Quién agrega, edita y elimina lo decide "Accesos" (`accesos-designer.mjs`);
// cambiar el orden global sigue siendo solo del Administrador Global.
test('crear, editar y eliminar insignias siguen a "Accesos"; ordenar, solo el Administrador Global', () => {
  const acceso = leer('src/utils/org-level-access.js');
  const reglas = leer('firestore.rules');
  const acciones = leer('src/sections/everest/acciones-de-insignia.jsx');

  assert.match(
    acceso,
    /puedeCrearInsignia = \(user, tipo\) =>\s*puedeEnDesigner\(user, PESTANA_DE_INSIGNIA\[tipo\], 'crear'\)/
  );
  assert.match(
    acceso,
    /puedeEliminarInsignia = \(user, tipo\) =>\s*puedeEnDesigner\(user, PESTANA_DE_INSIGNIA\[tipo\], 'eliminar'\)/
  );
  assert.match(
    acceso,
    /puedeOrdenarInsignias = \(user = \{\}\) => ejerceAdministradorGlobal\(user\)/
  );
  assert.match(
    reglas,
    /permisoDesigner\(pestanaDeInsignia\(request\.resource\.data\.tipo\), accionSobreInsignia\(\)\)/
  );
  assert.match(acciones, /\{puedeEliminar && \(/);
});

// ----------------------------------------------------------------------
// EL NÚMERO DORADO DE "VECES GANADA": cada cinta y medalla dice si lo lleva
// (`llevaNumero`, en su ficha del Designer). Por defecto las cintas sí y las
// medallas no; las medallas que lo llevan guardan sus veces al asignarlas.
// ----------------------------------------------------------------------

const { llevaNumeroDorado } = await import('../../src/utils/insignias-personalizadas.mjs');
const { construirMedallasAsignadas, configuracionDeMedallas } =
  await import('../../src/utils/medallas-perfil.mjs');

test('por defecto las cintas llevan número y las medallas no; la ficha manda', () => {
  assert.equal(llevaNumeroDorado({}, 'cinta'), true);
  assert.equal(llevaNumeroDorado({}, 'medalla'), false);
  assert.equal(llevaNumeroDorado({ llevaNumero: false }, 'cinta'), false);
  assert.equal(llevaNumeroDorado({ llevaNumero: true }, 'medalla'), true);
});

test('el ajuste de una de fábrica lleva si tiene número', () => {
  const [cinta] = aplicarAjustes([{ id: '3' }], { 3: { llevaNumero: false } });

  assert.equal(cinta.llevaNumero, false);
});

test('las medallas guardan y leen cuántas veces se ganaron', () => {
  const [medalla] = construirMedallasAsignadas([], [{ id: 'm1', veces: 3 }], 'hoy');

  assert.equal(medalla.veces, 3);
  assert.equal(configuracionDeMedallas([medalla]).get('m1').veces, 3);
  assert.equal(configuracionDeMedallas([{ id: 'm2' }]).get('m2').veces, 1);
});

test('la cinta y la medalla pintan el número solo si lo llevan', () => {
  assert.match(
    leer('src/components/insignias-perfil/cintas-de-miembro.jsx'),
    /llevaNumeroDorado\(cinta, 'cinta'\) \? digitosDeVeces\(veces\) : \[\]/
  );
  assert.match(
    leer('src/components/insignias-perfil/medallas-de-miembro.jsx'),
    /llevaNumeroDorado\(medalla, 'medalla'\) \? digitosDeVeces\(veces\) : \[\]/
  );
  assert.match(
    leer('src/sections/everest/agregar-insignia-dialog.jsx'),
    /Lleva número \(veces ganada\)/
  );
});
