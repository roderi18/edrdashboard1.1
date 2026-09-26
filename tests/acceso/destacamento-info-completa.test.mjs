import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// "DEST. INFO. COMPLETA": COORDINADOR, PASTOR, IGLESIA Y DIRECCIÓN.
//
// El Listado Nacional se carga con "Desconocido Desconocido" y "Desconocida"
// donde falta el dato. Eso deja crear el destacamento, pero no es información:
// sin esta regla uno con todo "Desconocido" contaba como completo. El porcentaje
// lo ven solo la Oficina Nacional y el Administrador Global; el aviso sobre la
// foto sale en la lista y en la cuadrícula.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const { esDatoReal, direccionCompleta, faltantesDeDestacamento, resumenInfoCompleta, textoDeFaltantes } =
  await import('../../src/utils/destacamento-info-completa.mjs');
const { puedeVerInfoCompletaDeDestacamentos } = await import('../../src/utils/org-level-access.js');

const completo = {
  coordinador: 'Arsenio Leyba',
  pastor: 'Margarita Guillén',
  iglesia: 'Iglesia Aposento Alto, A.D.',
  direccion: 'Santo Domingo, Santo Domingo Este, Ensanche Ozama, Masonería #86',
};

test('con los cuatro datos de verdad está completo', () => {
  assert.deepEqual(faltantesDeDestacamento(completo), []);
  assert.equal(textoDeFaltantes([]), '');
});

test('"Desconocido", "Desconocida" y los rellenos de la API no cuentan', () => {
  ['Desconocido Desconocido', 'Desconocida', 'Rafael Desconocido', 'Pastor no especificado', 'N/A', '', null].forEach(
    (valor) => assert.equal(esDatoReal(valor), false, `${valor} no es un dato`)
  );
  assert.deepEqual(
    faltantesDeDestacamento({ ...completo, coordinador: 'Desconocido Desconocido', iglesia: 'Desconocida' }),
    ['coordinador', 'iglesia']
  );
});

test('la dirección necesita provincia, municipio y sector; la calle es opcional', () => {
  assert.equal(direccionCompleta('Santo Domingo, Santo Domingo Este, Ensanche Ozama'), true);
  assert.equal(direccionCompleta('La Romana, La Romana, , C/ 2da Ensanche Almeida # 56'), false);
  assert.equal(direccionCompleta('Dirección no especificada'), false);
  assert.equal(direccionCompleta('N/A'), false);
});

test('el porcentaje no cuenta los destacamentos aún sin evaluar', () => {
  const resumen = resumenInfoCompleta([
    { infoFaltante: [] },
    { infoFaltante: ['pastor'] },
    { infoFaltante: undefined },
  ]);
  assert.deepEqual(resumen, { completos: 1, total: 2, porcentaje: 50 });
  assert.equal(resumenInfoCompleta([{}]).porcentaje, null);
});

const conRol = (rolId, nivel = 'nacional') => ({ role: 'admin', rolId, cargos: [{ rol: rolId, nivel }] });

test('el porcentaje solo lo ven la Oficina Nacional y el Administrador Global', () => {
  assert.equal(puedeVerInfoCompletaDeDestacamentos(conRol('administrador_global')), true);
  assert.equal(puedeVerInfoCompletaDeDestacamentos(conRol('oficina_nacional')), true);
  ['director_nacional', 'coordinador_seccional', 'coordinador_regional', 'usuario_destacamento'].forEach((rolId) =>
    assert.equal(puedeVerInfoCompletaDeDestacamentos(conRol(rolId)), false, rolId)
  );
});

test('la lista pinta el aviso sobre la foto en lista y cuadrícula, y el porcentaje con su tip', () => {
  const lista = leer('src/sections/dest/view/dest-list-view.jsx');
  assert.match(lista, /<InfoCompletaIndicador\s+resumen=\{infoCompleta\}/);
  // El filtro Completos/Incompletos no altera el porcentaje: se calcula antes.
  assert.match(lista, /resumenInfoCompleta\(dataSinFiltroInfo\)/);
  assert.match(lista, /value="incompletos"/);
  assert.match(lista, /Dest\. Info\. Completa/);
  assert.match(lista, /TEXTO_TIP_INFO_COMPLETA/);
  assert.match(leer('src/sections/dest/dest-table-row.jsx'), /avatarAviso=\{row\.avisoInfo\}/);
  assert.match(leer('src/sections/dest/dest-card.jsx'), /avatarAviso=\{dest\?\.avisoInfo\}/);
});
