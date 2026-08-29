import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const CARGOS_REGIONALES = [
  'usuario_region',
  'usuario_region_asistente',
  'coordinador_adiestramiento_region',
  'coordinador_promocion_region',
  'coordinador_produccion_region',
  'coordinador_programa_region',
  'capellan_regional',
  'secretario_regional',
];

const CARGOS_SECCIONALES = [
  'usuario_seccion',
  'usuario_seccion_asistente',
  'coordinador_adiestramiento_seccion',
  'coordinador_promocion_seccion',
  'coordinador_produccion_seccion',
  'coordinador_programa_seccion',
  'capellan_seccional',
  'zonas',
  'grupos_locales',
];

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
];

const puedeProponer = (user, nivel, idEntidad) => {
  if (CONSEJO_EJECUTIVO.includes(user.rolId)) return true;
  if (nivel === 'regional') {
    return CARGOS_REGIONALES.includes(user.rolId) && user.regiones?.includes(idEntidad);
  }
  if (nivel === 'seccional') {
    return CARGOS_SECCIONALES.includes(user.rolId) && user.secciones?.includes(idEntidad);
  }
  return false;
};

test('todo cargo regional propone en su propia region y nunca aplica directamente', () => {
  CARGOS_REGIONALES.forEach((rolId) => {
    assert.equal(puedeProponer({ rolId, regiones: ['1'] }, 'regional', '1'), true);
    assert.equal(puedeProponer({ rolId, regiones: ['1'] }, 'regional', '2'), false);
  });
});

test('todo cargo seccional propone en su propia seccion', () => {
  CARGOS_SECCIONALES.forEach((rolId) => {
    assert.equal(puedeProponer({ rolId, secciones: ['10'] }, 'seccional', '10'), true);
    assert.equal(puedeProponer({ rolId, secciones: ['10'] }, 'seccional', '11'), false);
  });
});

test('los diez cargos del Consejo Ejecutivo proponen en cualquier nivel inferior', () => {
  CONSEJO_EJECUTIVO.forEach((rolId) => {
    assert.equal(puedeProponer({ rolId }, 'regional', '99'), true);
    assert.equal(puedeProponer({ rolId }, 'seccional', '88'), true);
    assert.equal(puedeProponer({ rolId }, 'destacamento', '77'), true);
  });
});

test('el codigo enumera exactamente los diez cargos del Consejo Ejecutivo', () => {
  const acceso = leer('src/utils/org-level-access.js');
  const bloque = acceso.match(/export const ROLES_CONSEJO_EJECUTIVO = \[([\s\S]*?)\];/)?.[1];

  assert.ok(bloque);
  CONSEJO_EJECUTIVO.forEach((rolId) => {
    assert.ok(bloque.includes(`ROLES.${rolId.toUpperCase()}`));
  });
  assert.equal((bloque.match(/ROLES\./g) ?? []).length, CONSEJO_EJECUTIVO.length);
});

test('una aprobacion de Oficina Nacional avisa al Consejo Ejecutivo', () => {
  const solicitudes = leer('src/services/solicitudes-cambio-service.js');
  const notificaciones = leer('src/services/notificar-oficina-nacional-service.js');

  assert.match(solicitudes, /estado === ESTADOS_CAMBIO\.aprobada && isOficinaNacional\(usuario\)/);
  assert.match(solicitudes, /notificarCambioAprobadoAlConsejoEjecutivo/);
  assert.match(notificaciones, /roles: ROLES_CONSEJO_EJECUTIVO/);
  assert.match(notificaciones, /tipoNotificacion: 'cambio_aprobado_consejo_ejecutivo'/);
});

test('el aviso al Consejo Ejecutivo excluye a quien aprobo', () => {
  const notificaciones = leer('src/services/notificar-oficina-nacional-service.js');

  assert.match(notificaciones, /excluirIds: \[idAprobador\]/);
});

test('ya no existe permiso para aplicar directamente la directiva regional', () => {
  const catalogo = leer('src/auth/permissions/permissions.js');
  const reparto = leer('src/auth/permissions/role-permissions.js');
  const acceso = leer('src/utils/org-level-access.js');

  assert.doesNotMatch(catalogo, /DIRECTIVA_REGION_EDITAR|directiva\.region_editar/);
  assert.doesNotMatch(reparto, /DIRECTIVA_REGION_EDITAR/);
  assert.doesNotMatch(acceso, /componeLaDirectivaDeSuRegion/);
});

test('el servicio solo aplica directo cuando actua un aprobador', () => {
  const servicio = leer('src/services/directivas-organizacionales-service.js');

  assert.match(servicio, /aplicarDirecto: esAprobador/);
  assert.doesNotMatch(servicio, /escribeSuDirectivaRegional|componeLaDirectivaDeSuRegion/);
});

test('Firestore no permite escrituras regionales directas por cargo', () => {
  const reglas = leer('firestore.rules');

  assert.doesNotMatch(reglas, /componeLaDirectivaDeSuRegion|directiva\.region_editar/);
  assert.match(
    reglas,
    /esAdministradorGlobal\(\)[\s\S]{0,180}esOficinaNacional\(\)[\s\S]{0,220}componeLaDirectivaDeSuDestacamento/
  );
});

test('las pantallas separan propuesta y edicion visual', () => {
  const seccion = leer('src/sections/sectional/leadership/sectional-leadership-view.jsx');
  const region = leer('src/sections/regional/leadership/regional-leadership-view.jsx');

  assert.match(seccion, /canManageSectionLeadership\(user, sectionalId\)/);
  assert.match(region, /canManageRegionLeadership\(user, params\?\.id\)/);
  assert.match(seccion, /canManage: canManageLayout/);
  assert.match(region, /canManage: canManageLayout/);
});
