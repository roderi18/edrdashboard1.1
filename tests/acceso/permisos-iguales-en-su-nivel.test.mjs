import fs from 'node:fs';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, no una replica: ver `tests/soporte/resolver-alias-src.mjs`.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const ma = await import('src/utils/member-access.js');
const ol = await import('src/utils/org-level-access.js');
const { PERMISOS_POR_ROL, RESTRICCIONES_ROL, ALCANCE_PREDETERMINADO_ROL } =
  await import('src/auth/permissions/role-permissions.js');

// ----------------------------------------------------------------------
// CARGOS QUE OCUPAN EL MISMO SITIO TIENEN QUE PODER LO MISMO.
//
// Al comparar cargo por cargo dentro de cada nivel aparecieron tres parejas que
// se suponian iguales y no lo eran, cada una por una lista a la que le faltaba un
// nombre:
//
//   - El PASTOR veia menos estructura que el Consejo y el Capellan, que ocupan su
//     mismo sitio en el desplegable del Coordinador.
//   - El CAPELLAN SECCIONAL, ZONAS y GRUPOS LOCALES arrastraban `soloLectura` y
//     les faltaba la Academia Ministerial, aunque su catalogo de permisos ya era
//     el mismo que el de los coordinadores de area.
//   - Los cargos del CONSEJO EJECUTIVO tenian `salud.ver` pero la Dispensa les
//     llegaba bloqueada, pidiendo permiso a un Coordinador de Destacamento.
//
// Este test compara los guardas REALES en lote: si manana alguien anade un cargo
// a una de esas listas y se olvida de las otras, aqui se nota.
// ----------------------------------------------------------------------

const NIVEL_DE_ALCANCE = {
  destacamento: 'destacamento',
  seccion: 'seccional',
  region: 'regional',
  nacional: 'nacional',
};

const sesion = (codigo) => {
  const alcance = ALCANCE_PREDETERMINADO_ROL[codigo] ?? 'destacamento';
  const nivel = NIVEL_DE_ALCANCE[alcance] ?? 'destacamento';
  const idEntidad = { destacamento: 'D1', seccional: 'S1', regional: 'R1', nacional: '' }[nivel];

  return {
    role: 'member',
    rol: 'miembro',
    rolId: codigo,
    memberRole: codigo,
    idMiembros: 900,
    idDestacamento: 'D1',
    cargos: [{ rol: codigo, nivel, idEntidad }],
    permisosRol: PERMISOS_POR_ROL[codigo] ?? [],
    restricciones: RESTRICCIONES_ROL[codigo] ?? {},
    alcance: {
      modo: alcance,
      tipo: alcance,
      destacamentos: ['D1'],
      secciones: ['S1'],
      regiones: ['R1'],
    },
  };
};

const DEST = { id: 'D1', idDestacamento: 'D1', sectionalId: 'S1', regionalId: 'R1' };
const SECCION = { id: 'S1', idSeccion: 'S1', regionalId: 'R1' };
const MIEMBRO = { idMiembros: 901, id: '901', edad: 30, idDestacamento: 'D1' };

// La bateria que se compara. Son los guardas donde aparecieron las diferencias,
// mas los de edicion, que es lo que NO debe moverse al igualar la consulta.
const BATERIA = {
  've la ficha completa': (u) => ma.canViewMemberSensitiveData(u),
  've el nacimiento enmascarado': (u) => ma.canViewMemberBirthdateWhenMasked(u),
  've las secciones de su region': (u) => ma.isRegionWideSectionViewer(u),
  've contacto de adultos': (u) => ma.canViewAdultMemberContactData(u),
  'abre menores': (u) => ma.canAccessMinorMembers(u),
  'los menores le salen marcados': (u) => ma.shouldDisableMinorMembers(u),
  've salud': (u) => ma.canViewHealth(u),
  've la pestana de salud': (u) => ma.canViewMemberHealthTab(u),
  've el expediente entero': (u) => ma.veElExpedienteMedicoCompleto(u),
  've ascenso': (u) => ma.canViewAwards(u),
  've padres': (u) => ma.canViewParents(u),
  'edita Academia Ministerial': (u) => ma.canEditAcademiaMinisterial(u),
  'edita miembros': (u) => ma.canEditMembers(u),
  'edita salud': (u) => ma.canEditHealth(u),
  'sube documentos de salud': (u) => ma.canUploadHealthDocuments(u),
  'borra documentos de salud': (u) => ma.canDeleteHealthDocuments(u),
  'edita ascenso': (u) => ma.canEditAwards(u),
  'aprueba cambios de miembro': (u) => ma.canApproveMemberChanges(u),
  'es de solo lectura': (u) => Boolean(RESTRICCIONES_ROL[u.rolId]?.soloLectura),
  'edita su destacamento': (u) => ol.canEditDest(u, DEST),
  'propone en una seccion': (u) => ol.canEditSectional(u, SECCION),
  've al miembro': (u) => ma.esMiembroDeSuAlcance(u, MIEMBRO),
};

const huella = (codigo) => {
  const u = sesion(codigo);
  const marcas = Object.fromEntries(
    Object.entries(BATERIA).map(([nombre, fn]) => [nombre, Boolean(fn(u))])
  );

  return {
    marcas,
    permisos: [...(PERMISOS_POR_ROL[codigo] ?? [])].sort(),
  };
};

/** Falla nombrando la capacidad concreta en la que dos cargos se separan. */
const mismoPerfil = (cargos, etiqueta) => {
  const [referencia, ...resto] = cargos;
  const base = huella(referencia);

  resto.forEach((codigo) => {
    const otra = huella(codigo);

    Object.keys(BATERIA).forEach((nombre) => {
      assert.equal(
        otra.marcas[nombre],
        base.marcas[nombre],
        `${etiqueta}: ${codigo} y ${referencia} difieren en "${nombre}"`
      );
    });

    assert.deepEqual(
      otra.permisos,
      base.permisos,
      `${etiqueta}: ${codigo} y ${referencia} no tienen el mismo catalogo de permisos`
    );
  });
};

// ----------------------------------------------------------------------
// Destacamento.
// ----------------------------------------------------------------------

test('el Pastor puede lo mismo que el Consejo y el Capellan de su destacamento', () => {
  mismoPerfil(
    ['pastor_destacamento', 'consejo_destacamento', 'capellan_destacamento'],
    'cargos del destacamento'
  );
});

test('el Coordinador y su Asistente siguen siendo los unicos que aprueban', () => {
  assert.equal(ma.canApproveMemberChanges(sesion('usuario_destacamento')), true);
  assert.equal(ma.canApproveMemberChanges(sesion('usuario_destacamento_asistente')), true);

  ['pastor_destacamento', 'consejo_destacamento', 'capellan_destacamento', 'lider_grupo'].forEach(
    (codigo) => {
      assert.equal(ma.canApproveMemberChanges(sesion(codigo)), false, `${codigo} no aprueba`);
    }
  );
});

// ----------------------------------------------------------------------
// Seccion.
// ----------------------------------------------------------------------

const COORDINADORES_DE_AREA = [
  'coordinador_adiestramiento_seccion',
  'coordinador_promocion_seccion',
  'coordinador_produccion_seccion',
  'coordinador_programa_seccion',
];

test('Capellan Seccional, Zonas y Grupos Locales pueden lo mismo que los coordinadores de area', () => {
  mismoPerfil(
    [...COORDINADORES_DE_AREA, 'capellan_seccional', 'zonas', 'grupos_locales'],
    'cargos de seccion'
  );
});

test('ninguno de los siete edita: igualar la consulta no abrio la escritura', () => {
  [...COORDINADORES_DE_AREA, 'capellan_seccional', 'zonas', 'grupos_locales'].forEach((codigo) => {
    const u = sesion(codigo);

    assert.equal(ma.canEditMembers(u), false, `${codigo} no edita miembros`);
    assert.equal(ma.canEditHealth(u), false, `${codigo} no edita salud`);
    assert.equal(ol.canEditSectional(u, SECCION), false, `${codigo} no propone en la seccion`);
  });
});

test('a los nueve cargos de seccion los menores les salen marcados en la lista', () => {
  [
    'usuario_seccion',
    'usuario_seccion_asistente',
    ...COORDINADORES_DE_AREA,
    'capellan_seccional',
    'zonas',
    'grupos_locales',
  ].forEach((codigo) => {
    const u = sesion(codigo);

    assert.equal(ma.canAccessMinorMembers(u), false, `${codigo} no abre la ficha de un menor`);
    assert.equal(ma.shouldDisableMinorMembers(u), true, `${codigo} los ve deshabilitados`);
  });
});

// ----------------------------------------------------------------------
// Nacional: el Consejo Ejecutivo y el expediente medico.
// ----------------------------------------------------------------------

const CONSEJO_EJECUTIVO = [
  'ministerios_infantiles_nacional',
  'director_nacional',
  'capellan_nacional',
  'coordinador_adiestramiento_nacional',
  'subdirector_nacional',
  'coordinador_promocion_nacional',
  'coordinador_produccion_nacional',
  'coordinador_programa_nacional',
  'comites_especiales_nacional',
  'oficiales_adiestramientos_especiales_nacional',
  'consejo_ejecutivo',
];

test('los once cargos del Consejo Ejecutivo ven el expediente medico entero', () => {
  CONSEJO_EJECUTIVO.forEach((codigo) => {
    const u = sesion(codigo);

    assert.equal(ma.veElExpedienteMedicoCompleto(u), true, `${codigo} ve el expediente`);
    assert.equal(ma.canViewHealth(u), true, `${codigo} ve salud`);
    assert.equal(ma.canViewMemberHealthTab(u), true, `${codigo} ve la pestana`);
  });
});

test('el rol Consejo Ejecutivo ve TODAS las pestanas de la ficha', () => {
  const u = sesion('consejo_ejecutivo');

  assert.equal(ma.canViewMemberSensitiveData(u), true);
  assert.equal(ma.canViewMemberHealthTab(u), true);
  assert.equal(ma.canViewMemberAwardsTab(u), true);
  assert.equal(ma.canViewMemberParentsTab(u), true);
});

test('ver el expediente no es tocarlo: el Consejo Ejecutivo sigue sin editar salud', () => {
  CONSEJO_EJECUTIVO.forEach((codigo) => {
    const u = sesion(codigo);

    assert.equal(ma.canEditHealth(u), false, `${codigo} no edita salud`);
    assert.equal(ma.canUploadHealthDocuments(u), false, `${codigo} no sube documentos`);
    assert.equal(ma.canDeleteHealthDocuments(u), false, `${codigo} no borra documentos`);
    assert.equal(ma.canEditMembers(u), false, `${codigo} no edita la ficha`);
  });
});

test('el expediente abierto es solo del Consejo Ejecutivo, no de toda la supervision', () => {
  [
    'consejo_nacional',
    'oficina_nacional',
    'usuario_region',
    'usuario_region_asistente',
    'secretario_regional',
    'usuario_seccion',
    'usuario_seccion_asistente',
    'capellan_seccional',
  ].forEach((codigo) => {
    assert.equal(
      ma.veElExpedienteMedicoCompleto(sesion(codigo)),
      false,
      `${codigo} sigue pidiendo acceso a la Dispensa`
    );
  });
});

test('la Dispensa deja de pedirles acceso solo a ellos', () => {
  const pantalla = fs.readFileSync('src/sections/member/member-edit-health-form.jsx', 'utf8');

  assert.match(pantalla, /veElExpedienteMedicoCompleto\(user\)/);
  assert.match(
    pantalla,
    /supervisoryNeedsHealthAccess =\s*\(isSupervisoryViewerRole \|\| esAdministradorDeSistema\(user\)\) && !veElExpedienteEntero;/
  );
  assert.match(pantalla, /isMinor && isSupervisoryViewerRole && !veElExpedienteEntero;/);
});
