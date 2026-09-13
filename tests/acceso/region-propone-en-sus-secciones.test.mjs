import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, no una replica: ver `tests/soporte/resolver-alias-src.mjs`.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  canEditDest,
  canEditSectional,
  canManageSectionLeadership,
  soloSugiereCambiosDeSeccion,
  soloSugiereLaDirectivaDeUnaSeccion,
} = await import('src/utils/org-level-access.js');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

// ----------------------------------------------------------------------
// EL COORDINADOR REGIONAL Y SU SUB-DIRECTOR PROPONEN EN SUS SECCIONES.
//
// Antes no podian: los cargos regionales habian pasado a consulta de solo lectura
// y `REGION_SCOPED_ROLES` se dejo vacio, asi que ni la ficha de una seccion de su
// region ni su directiva se les abrian. El Coordinador Regional veia la seccion
// que gobierna sin poder proponer una sola correccion.
//
// Lo que se abre son DOS puertas y solo para DOS cargos:
//
//   - La ficha de una seccion de su region (`canEditSectional`).
//   - La directiva de esa seccion (`canManageSectionLeadership`).
//
// Y sigue sin ser edicion: ambos ambitos -`seccion` y `directiva_seccion`- los
// aprueba la Oficina Nacional. El Coordinador Regional PROPONE; el Sub-Director
// SUGIERE, que es la misma distincion que ya habia entre el Coordinador Seccional
// y su Sub-Coordinador.
//
// Los otros seis cargos del nivel region siguen siendo de consulta, y los
// destacamentos siguen cerrados para los ocho.
// ----------------------------------------------------------------------

const sesion = (rolId, regiones = ['R1']) => ({
  role: 'member',
  rol: 'miembro',
  rolId,
  memberRole: rolId,
  idMiembros: 900,
  cargos: [{ rol: rolId, nivel: 'regional', idEntidad: regiones[0] }],
  alcance: {
    modo: 'region',
    tipo: 'region',
    regiones,
    secciones: [],
    destacamentos: [],
  },
});

const COORDINADOR_REGIONAL = sesion('usuario_region');
const SUB_DIRECTOR_REGIONAL = sesion('usuario_region_asistente');

// Los seis que se quedan fuera: mismo nivel, pero cargos de consulta.
const CARGOS_REGIONALES_DE_CONSULTA = [
  'coordinador_adiestramiento_region',
  'coordinador_promocion_region',
  'coordinador_produccion_region',
  'coordinador_programa_region',
  'capellan_regional',
  'secretario_regional',
];

const SECCION_PROPIA = { id: 'S1', idSeccion: 'S1', regionalId: 'R1' };
const SECCION_DE_OTRA_REGION = { id: 'S9', idSeccion: 'S9', regionalId: 'R2' };

// ----------------------------------------------------------------------
// La ficha de la seccion.
// ----------------------------------------------------------------------

test('el Coordinador Regional y su Sub-Director proponen en la ficha de una seccion de SU region', () => {
  assert.equal(canEditSectional(COORDINADOR_REGIONAL, SECCION_PROPIA), true);
  assert.equal(canEditSectional(SUB_DIRECTOR_REGIONAL, SECCION_PROPIA), true);
});

test('no proponen en la ficha de una seccion de otra region', () => {
  assert.equal(canEditSectional(COORDINADOR_REGIONAL, SECCION_DE_OTRA_REGION), false);
  assert.equal(canEditSectional(SUB_DIRECTOR_REGIONAL, SECCION_DE_OTRA_REGION), false);
});

test('una seccion sin region no se abre: sin con que comparar se deniega', () => {
  assert.equal(canEditSectional(COORDINADOR_REGIONAL, { id: 'S1', idSeccion: 'S1' }), false);
});

test('los otros seis cargos regionales siguen siendo de consulta', () => {
  CARGOS_REGIONALES_DE_CONSULTA.forEach((rolId) => {
    assert.equal(
      canEditSectional(sesion(rolId), SECCION_PROPIA),
      false,
      `${rolId} no propone en la ficha de una seccion`
    );
  });
});

// ----------------------------------------------------------------------
// La directiva de la seccion.
// ----------------------------------------------------------------------

test('componen la directiva de una seccion de su region, comprobada por REGION', () => {
  assert.equal(canManageSectionLeadership(COORDINADOR_REGIONAL, 'S1', { regionId: 'R1' }), true);
  assert.equal(canManageSectionLeadership(SUB_DIRECTOR_REGIONAL, 'S1', { regionId: 'R1' }), true);
});

test('no componen la directiva de una seccion de otra region', () => {
  assert.equal(canManageSectionLeadership(COORDINADOR_REGIONAL, 'S9', { regionId: 'R2' }), false);
  assert.equal(canManageSectionLeadership(SUB_DIRECTOR_REGIONAL, 'S9', { regionId: 'R2' }), false);
});

test('sin la region de la seccion el guarda deniega: un llamador incompleto no autoriza', () => {
  assert.equal(canManageSectionLeadership(COORDINADOR_REGIONAL, 'S1'), false);
  assert.equal(canManageSectionLeadership(COORDINADOR_REGIONAL, 'S1', { regionId: '' }), false);
});

test('la region no sustituye al alcance seccional de los demas cargos', () => {
  CARGOS_REGIONALES_DE_CONSULTA.forEach((rolId) => {
    assert.equal(
      canManageSectionLeadership(sesion(rolId), 'S1', { regionId: 'R1' }),
      false,
      `${rolId} no compone la directiva de una seccion`
    );
  });
});

test('el Coordinador Seccional conserva su camino por el id de la seccion', () => {
  const coordinadorSeccional = {
    role: 'member',
    rolId: 'usuario_seccion',
    memberRole: 'usuario_seccion',
    cargos: [{ rol: 'usuario_seccion', nivel: 'seccional', idEntidad: 'S1' }],
    alcance: { modo: 'seccion', tipo: 'seccion', secciones: ['S1'], regiones: [] },
  };

  assert.equal(canManageSectionLeadership(coordinadorSeccional, 'S1'), true);
  assert.equal(canManageSectionLeadership(coordinadorSeccional, 'S9'), false);
});

// ----------------------------------------------------------------------
// Quien propone y quien sugiere.
// ----------------------------------------------------------------------

test('el titular propone y su asistente sugiere, en la ficha y en la directiva', () => {
  assert.equal(soloSugiereCambiosDeSeccion(COORDINADOR_REGIONAL), false);
  assert.equal(soloSugiereCambiosDeSeccion(SUB_DIRECTOR_REGIONAL), true);

  assert.equal(soloSugiereLaDirectivaDeUnaSeccion(COORDINADOR_REGIONAL), false);
  assert.equal(soloSugiereLaDirectivaDeUnaSeccion(SUB_DIRECTOR_REGIONAL), true);
});

test('quien ejerce los dos cargos habla por la entidad: propone, no sugiere', () => {
  const losDos = {
    role: 'member',
    rolId: 'usuario_region_asistente',
    memberRole: 'usuario_region_asistente',
    cargos: [
      { rol: 'usuario_region_asistente', nivel: 'regional', idEntidad: 'R1' },
      { rol: 'usuario_region', nivel: 'regional', idEntidad: 'R1' },
    ],
    alcance: { modo: 'region', tipo: 'region', regiones: ['R1'], secciones: [] },
  };

  assert.equal(soloSugiereCambiosDeSeccion(losDos), false);
  assert.equal(soloSugiereLaDirectivaDeUnaSeccion(losDos), false);
});

test('el Sub-Coordinador Seccional sigue sugiriendo la ficha y PROPONIENDO su directiva', () => {
  const subCoordinador = {
    role: 'member',
    rolId: 'usuario_seccion_asistente',
    memberRole: 'usuario_seccion_asistente',
    cargos: [{ rol: 'usuario_seccion_asistente', nivel: 'seccional', idEntidad: 'S1' }],
    alcance: { modo: 'seccion', tipo: 'seccion', secciones: ['S1'], regiones: [] },
  };

  assert.equal(soloSugiereCambiosDeSeccion(subCoordinador), true);
  // A proposito: componer la directiva de SU seccion es una propuesta desde que
  // existe el organigrama, y esta regla nueva no se la cambia.
  assert.equal(soloSugiereLaDirectivaDeUnaSeccion(subCoordinador), false);
});

// ----------------------------------------------------------------------
// Lo que NO se abrio.
// ----------------------------------------------------------------------

test('los destacamentos siguen cerrados para los ocho cargos regionales', () => {
  const destacamento = { id: 'D1', idDestacamento: 'D1', sectionalId: 'S1', regionalId: 'R1' };

  ['usuario_region', 'usuario_region_asistente', ...CARGOS_REGIONALES_DE_CONSULTA].forEach(
    (rolId) => {
      assert.equal(
        canEditDest(sesion(rolId), destacamento),
        false,
        `${rolId} no edita destacamentos`
      );
    }
  );
});

test('REGION_SCOPED_ROLES sigue vacia: la puerta nueva va en su propia lista', () => {
  const fuente = leer('src/utils/org-level-access.js');

  assert.match(fuente, /const REGION_SCOPED_ROLES = \[\];/);
  assert.match(
    fuente,
    /const REGION_SECTION_PROPOSER_ROLES = \[ROLES\.USUARIO_REGION, ROLES\.USUARIO_REGION_ASISTENTE\];/
  );
});

// ----------------------------------------------------------------------
// La propuesta llega a la Oficina Nacional.
// ----------------------------------------------------------------------

test('los dos ambitos que tocan estos cargos los aprueba la Oficina Nacional', () => {
  const puerta = leer('src/services/solicitudes-cambio-service.js');

  assert.match(
    puerta,
    /AMBITOS_QUE_APRUEBA_OFICINA_NACIONAL = \[[\s\S]*?AMBITOS_CAMBIO\.seccion,[\s\S]*?\];/
  );
  assert.match(
    puerta,
    /AMBITOS_QUE_APRUEBA_OFICINA_NACIONAL = \[[\s\S]*?AMBITOS_CAMBIO\.directivaSeccion,[\s\S]*?\];/
  );
});

test('el servicio de directivas comprueba la region en el servidor, no se fia de la pantalla', () => {
  const servicio = leer('src/services/directivas-organizacionales-service.js');

  // La region la resuelve el propio servicio a partir de la seccion: si llegara
  // por argumento, bastaria un formulario armado a mano para colarse en la
  // directiva de una seccion de otra region.
  assert.match(servicio, /const regionDeLaSeccion = async \(idSeccion\)/);
  assert.match(servicio, /regionId: await regionDeLaSeccion\(idEntidad\)/);
  assert.match(servicio, /sugerenciaDelSubDirectorRegional/);
  assert.match(
    servicio,
    /esSugerencia: propuestaNacionalSobreDestacamento \|\| sugerenciaDelSubDirectorRegional,/
  );
});

test('la pantalla del organigrama le pasa la region de la seccion al guarda', () => {
  const vista = leer('src/sections/sectional/leadership/sectional-leadership-view.jsx');

  assert.match(
    vista,
    /canManageSectionLeadership\(user, sectionalId, \{\s*regionId: sectionalRegionId,?\s*\}\)/
  );
  assert.match(vista, /setSectionalRegionId\(sectional\?\.regionalId/);
});
