import fs from 'node:fs/promises';
import path from 'node:path';
import { register } from 'node:module';

import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

register(new URL('../../tests/soporte/resolver-alias-src.mjs', import.meta.url));

const { ROLES, ROLES_CATALOGO, ALCANCES } = await import('src/auth/permissions/roles.js');
const { PERMISOS, PERMISOS_CATALOGO } = await import('src/auth/permissions/permissions.js');
const {
  ALCANCE_PREDETERMINADO_ROL,
  PERMISOS_POR_ROL,
  RESTRICCIONES_ROL,
} = await import('src/auth/permissions/role-permissions.js');
const { can, isReadOnlyRole } = await import('src/auth/permissions/can.js');
const member = await import('src/utils/member-access.js');
const org = await import('src/utils/org-level-access.js');

const outputDir = path.resolve('outputs/01a06500-permissions-matrix');
const outputPath = path.join(outputDir, 'matriz-completa-acceso-roles.xlsx');
const previewDir = path.join(outputDir, 'qa');

const YES = 'Sí';
const NO = 'No';
const OWN_DEST = 'Destacamento propio';
const OWN_SECTION = 'Sección propia';
const OWN_REGION = 'Región propia';
const COUNTRY = 'Todo el país';

const levelLabel = {
  [ALCANCES.DESTACAMENTO]: 'Destacamento',
  [ALCANCES.SECCION]: 'Sección',
  [ALCANCES.REGION]: 'Región',
  [ALCANCES.NACIONAL]: 'Nacional',
  [ALCANCES.GLOBAL]: 'Global',
};

const nationalProposers = new Set([
  ROLES.MINISTERIOS_INFANTILES_NACIONAL,
  ROLES.DIRECTOR_NACIONAL,
  ROLES.CAPELLAN_NACIONAL,
  ROLES.COORDINADOR_ADIESTRAMIENTO_NACIONAL,
  ROLES.SUBDIRECTOR_NACIONAL,
  ROLES.COORDINADOR_PROMOCION_NACIONAL,
  ROLES.COORDINADOR_PRODUCCION_NACIONAL,
  ROLES.COORDINADOR_PROGRAMA_NACIONAL,
  ROLES.COMITES_ESPECIALES_NACIONAL,
  ROLES.OFICIALES_ADIESTRAMIENTOS_ESPECIALES_NACIONAL,
]);

const adminRoles = new Set([
  ROLES.ADMINISTRADOR_GLOBAL,
  ROLES.ADMINISTRADOR_FUNCIONAL,
  ROLES.ADMINISTRADOR_TIENDA,
]);

const buildUser = (roleCode) => {
  const scope = ALCANCE_PREDETERMINADO_ROL[roleCode] || ALCANCES.DESTACAMENTO;
  const memberRole = !adminRoles.has(roleCode);
  const cargoLevel = {
    [ALCANCES.DESTACAMENTO]: 'destacamento',
    [ALCANCES.SECCION]: 'seccional',
    [ALCANCES.REGION]: 'regional',
    [ALCANCES.NACIONAL]: 'nacional',
  }[scope];

  return {
    role: memberRole ? 'member' : 'admin',
    rol: memberRole ? 'miembro' : 'admin',
    rolId: roleCode,
    memberRole: roleCode,
    idMiembros: 900,
    idDestacamento: 'D1',
    idSeccion: 'S1',
    idRegion: 'R1',
    cargos:
      memberRole && roleCode !== ROLES.USUARIO_COMUN
        ? [{ rol: roleCode, nivel: cargoLevel, idEntidad: cargoLevel === 'destacamento' ? 'D1' : cargoLevel === 'seccional' ? 'S1' : 'R1' }]
        : [],
    alcance: {
      tipo: scope,
      modo: scope,
      nacional: scope === ALCANCES.NACIONAL || scope === ALCANCES.GLOBAL,
      destacamentos: scope === ALCANCES.DESTACAMENTO ? ['D1'] : [],
      secciones: scope === ALCANCES.SECCION ? ['S1'] : [],
      regiones: scope === ALCANCES.REGION ? ['R1'] : [],
    },
  };
};

const has = (user, permission) => can(user, permission);
const yesNo = (value) => (value ? YES : NO);

const memberScope = (roleCode, user) => {
  if (!has(user, PERMISOS.MIEMBROS_VER)) return NO;
  if (
    [ROLES.ADMINISTRADOR_GLOBAL, ROLES.ADMINISTRADOR_FUNCIONAL, ROLES.OFICINA_NACIONAL].includes(roleCode)
  ) return COUNTRY;

  const scope = ALCANCE_PREDETERMINADO_ROL[roleCode];
  if (scope === ALCANCES.NACIONAL || scope === ALCANCES.GLOBAL) return COUNTRY;
  if (scope === ALCANCES.REGION) return OWN_REGION;
  if (scope === ALCANCES.SECCION) return OWN_SECTION;
  return OWN_DEST;
};

const destScope = (roleCode, user) => {
  if (!has(user, PERMISOS.DESTACAMENTOS_VER)) return NO;
  const scope = ALCANCE_PREDETERMINADO_ROL[roleCode];
  if (roleCode === ROLES.USUARIO_COMUN) return OWN_SECTION;
  if ([ALCANCES.NACIONAL, ALCANCES.GLOBAL].includes(scope)) return COUNTRY;
  return OWN_REGION;
};

const sectionScope = (roleCode, user) => {
  if ([ROLES.ADMINISTRADOR_GLOBAL, ROLES.ADMINISTRADOR_FUNCIONAL].includes(roleCode)) return COUNTRY;
  if (!has(user, PERMISOS.SECCIONES_VER)) return NO;
  const scope = ALCANCE_PREDETERMINADO_ROL[roleCode];
  if ([ALCANCES.NACIONAL, ALCANCES.GLOBAL, ALCANCES.REGION].includes(scope)) return COUNTRY;
  return OWN_REGION;
};

const regionScope = (roleCode, user) => {
  const canOpen = has(user, PERMISOS.REGIONES_VER) || has(user, PERMISOS.REPORTES_VER_NACIONALES);
  if (!canOpen) return NO;
  const scope = ALCANCE_PREDETERMINADO_ROL[roleCode];
  if (
    [ALCANCES.REGION, ALCANCES.NACIONAL].includes(scope) ||
    [ROLES.ADMINISTRADOR_GLOBAL, ROLES.ADMINISTRADOR_FUNCIONAL].includes(roleCode)
  ) return COUNTRY;
  return OWN_REGION;
};

const consejoAccess = (user) =>
  yesNo(has(user, PERMISOS.REGIONES_VER) || has(user, PERMISOS.REPORTES_VER_NACIONALES));

const editFlow = (user, allowed) => {
  if (!allowed) return NO;
  if (member.isDestacamentoApprovalRole(user)) return 'Sí · aprobación';
  return 'Sí · directo';
};

const directivaFlow = (roleCode, canManage, level) => {
  if (!canManage) {
    if (roleCode === ROLES.OFICINA_NACIONAL) return 'Revisa / aprueba';
    return NO;
  }
  if (roleCode === ROLES.ADMINISTRADOR_GLOBAL) return 'Directo';
  if (nationalProposers.has(roleCode)) return 'Propone · país';
  if (level === 'dest' && [ROLES.USUARIO_DESTACAMENTO, ROLES.USUARIO_DESTACAMENTO_ASISTENTE].includes(roleCode)) {
    return 'Directo · propio';
  }
  if (level === 'dest') return 'Cambio con aviso · propio';
  return 'Propone · alcance propio';
};

const permissionLabel = (value) => (value ? '✓' : '—');

const rows = ROLES_CATALOGO.map((role) => {
  const roleCode = role.codigo;
  const user = buildUser(roleCode);
  const defaultScope = ALCANCE_PREDETERMINADO_ROL[roleCode];
  const ownMember = { id: 901, idMiembros: 901, idDestacamento: 'D1', destId: 'D1', edad: 25 };
  const supervisory = member.isSupervisoryMemberViewer(user);
  const healthTab = member.canViewMemberHealthTab(user);
  const history = member.canViewMemberHistoryTab(user, ownMember);
  const canEditGeneral = member.canEditMembers(user);
  const canEditHealth = member.canEditHealth(user);
  const canEditAwards = member.canEditAwards(user);
  const canEditParents = member.canEditParents(user);
  const canManageDest = member.canManageDestLeadership(user, 'D1');
  const canManageSection = org.canManageSectionLeadership(user, 'S1');
  const canManageRegion = org.canManageRegionLeadership(user, 'R1');
  const canManageNational = org.canManageNationalLeadership(user);

  let healthView = NO;
  if (healthTab && supervisory) healthView = 'Solicitar acceso';
  else if (healthTab) healthView = 'Sí · según alcance';

  let healthRequest = NO;
  if (healthTab && supervisory) healthRequest = 'Sí · expediente restringido';

  const isPastoralDocs = [
    ROLES.PASTOR_DESTACAMENTO,
    ROLES.CONSEJO_DESTACAMENTO,
    ROLES.CAPELLAN_DESTACAMENTO,
  ].includes(roleCode);

  return {
    role,
    roleCode,
    user,
    defaultScope,
    profile: {
      level: levelLabel[defaultScope] || defaultScope,
      role: role.nombre,
      code: roleCode,
      scope: levelLabel[defaultScope] || defaultScope,
      readOnly: yesNo(isReadOnlyRole(user)),
      description: role.descripcion,
    },
    levels: {
      level: levelLabel[defaultScope] || defaultScope,
      role: role.nombre,
      code: roleCode,
      readOnly: yesNo(isReadOnlyRole(user)),
      members: memberScope(roleCode, user),
      dests: destScope(roleCode, user),
      sections: sectionScope(roleCode, user),
      regions: regionScope(roleCode, user),
      council: consejoAccess(user),
      destCreate: yesNo(org.canCreateDestInSection(user, 'S1', { regionId: 'R1' })),
      destEdit: yesNo(org.canEditDest(user, { id: 'D1', idSeccion: 'S1', idRegion: 'R1' })),
      destPhoto: yesNo(has(user, PERMISOS.DESTACAMENTOS_SUBIR_FOTO) && org.canEditDest(user, { id: 'D1', idSeccion: 'S1', idRegion: 'R1' })),
      destDelete: yesNo(org.canDeleteOrgLevel(user)),
      officialNumber: yesNo(has(user, PERMISOS.DESTACAMENTOS_ASIGNAR_NUMERO_OFICIAL)),
      sectionCreate: yesNo(org.canCreateSectionalInRegion(user, 'R1')),
      sectionEdit: yesNo(org.canEditSectional(user, { id: 'S1', idSeccion: 'S1', idRegion: 'R1' })),
      regionEdit: yesNo(org.canEditRegional(user)),
      regionPhoto: yesNo(org.puedeSugerirFotoDeRegion(user, { id: 'R1' })),
      approveOrg: yesNo(org.puedeAprobarCambiosDeOrganizacion(user)),
    },
    person: {
      level: levelLabel[defaultScope] || defaultScope,
      role: role.nombre,
      code: roleCode,
      memberScope: memberScope(roleCode, user),
      adults: yesNo(has(user, PERMISOS.MIEMBROS_VER_ADULTOS)),
      minors: yesNo(member.canAccessMinorMembers(user)),
      sensitive: yesNo(member.canViewMemberSensitiveData(user)),
      requestGeneral: has(user, PERMISOS.MIEMBROS_VER) && !member.canViewMemberSensitiveData(user) ? 'Sí · si está bloqueada' : NO,
      create: yesNo(has(user, PERMISOS.MIEMBROS_CREAR)),
      edit: editFlow(user, canEditGeneral),
      photo: editFlow(user, canEditGeneral && has(user, PERMISOS.MIEMBROS_SUBIR_FOTO)),
      delete: yesNo(has(user, PERMISOS.MIEMBROS_ELIMINAR)),
      approve: yesNo(member.canApproveMemberChanges(user)),
      healthView,
      healthRequest,
      healthEdit: editFlow(user, canEditHealth),
      healthUpload: isPastoralDocs ? 'Solicitar acceso' : editFlow(user, member.canUploadHealthDocuments(user)),
      healthDelete: yesNo(member.canDeleteHealthDocuments(user)),
      authorizeMinorHealth: yesNo(member.canAuthorizeMinorHealthAccess(user)),
      awardsView: yesNo(member.canViewMemberAwardsTab(user)),
      awardsEdit: editFlow(user, canEditAwards),
      parentsView: yesNo(member.canViewMemberParentsTab(user)),
      parentsEdit: editFlow(user, member.canEditMemberTutors(user)),
      parentsDelete: yesNo(member.canDeleteMemberTutors(user)),
      historyView: history ? (roleCode === ROLES.ADMINISTRADOR_GLOBAL ? COUNTRY : OWN_DEST) : NO,
      historyRequest: has(user, PERMISOS.MIEMBROS_VER) ? (history ? 'No requerido' : 'Sí · si la ficha es visible') : NO,
    },
    directives: {
      level: levelLabel[defaultScope] || defaultScope,
      role: role.nombre,
      code: roleCode,
      destView: destScope(roleCode, user),
      destAction: directivaFlow(roleCode, canManageDest, 'dest'),
      sectionView: sectionScope(roleCode, user),
      sectionAction: directivaFlow(roleCode, canManageSection, 'section'),
      regionView: regionScope(roleCode, user),
      regionAction: directivaFlow(roleCode, canManageRegion, 'region'),
      nationalView: consejoAccess(user),
      nationalAction: directivaFlow(roleCode, canManageNational, 'national'),
      approves: yesNo(org.puedeAprobarCambiosDeOrganizacion(user)),
    },
  };
});

const workbook = Workbook.create();
const guide = workbook.worksheets.add('Guía');
const levelsSheet = workbook.worksheets.add('Niveles org');
const personSheet = workbook.worksheets.add('Ficha miembro');
const directivaSheet = workbook.worksheets.add('Directivas');
const rawSheet = workbook.worksheets.add('Permisos crudos');

const COLORS = {
  navy: '#16324F',
  blue: '#245B78',
  lightBlue: '#DCEAF2',
  green: '#DFF2E1',
  greenText: '#1E6B32',
  red: '#FBE2E2',
  redText: '#9B1C1C',
  amber: '#FFF1CC',
  amberText: '#7A5200',
  gray: '#EDF1F4',
  darkGray: '#44515C',
  white: '#FFFFFF',
};

const title = (sheet, range, text, subtitle) => {
  sheet.getRange(range).merge();
  const cell = sheet.getRange(range.split(':')[0]);
  cell.values = [[text]];
  cell.format = {
    fill: COLORS.navy,
    font: { bold: true, color: COLORS.white, size: 18 },
    verticalAlignment: 'center',
  };
  cell.format.rowHeight = 34;
  if (subtitle) {
    const row = Number(range.match(/\d+/)[0]) + 1;
    const endCol = range.split(':')[1].replace(/\d+/, '');
    sheet.getRange(`A${row}:${endCol}${row}`).merge();
    const sub = sheet.getRange(`A${row}`);
    sub.values = [[subtitle]];
    sub.format = {
      fill: COLORS.lightBlue,
      font: { color: COLORS.darkGray, italic: true, size: 10 },
      wrapText: true,
      verticalAlignment: 'center',
    };
    sub.format.rowHeight = 30;
  }
};

const applyHeader = (range) => {
  range.format = {
    fill: COLORS.blue,
    font: { bold: true, color: COLORS.white, size: 10 },
    wrapText: true,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    borders: { preset: 'all', style: 'thin', color: '#B8C7D1' },
  };
  range.format.rowHeight = 42;
};

const applyBody = (range) => {
  range.format = {
    font: { color: '#25313A', size: 9 },
    verticalAlignment: 'center',
    wrapText: true,
    borders: {
      insideHorizontal: { style: 'thin', color: '#D9E1E6' },
      bottom: { style: 'thin', color: '#D9E1E6' },
    },
  };
  range.format.rowHeight = 30;
};

const addStatusFormatting = (range) => {
  range.conditionalFormats.add('containsText', {
    text: 'Sí',
    format: { fill: COLORS.green, font: { color: COLORS.greenText, bold: true } },
  });
  range.conditionalFormats.add('containsText', {
    text: 'No',
    format: { fill: COLORS.red, font: { color: COLORS.redText } },
  });
  range.conditionalFormats.add('containsText', {
    text: 'Solicitar',
    format: { fill: COLORS.amber, font: { color: COLORS.amberText, bold: true } },
  });
  range.conditionalFormats.add('containsText', {
    text: 'aprobación',
    format: { fill: COLORS.amber, font: { color: COLORS.amberText } },
  });
  range.conditionalFormats.add('containsText', {
    text: 'Propone',
    format: { fill: COLORS.amber, font: { color: COLORS.amberText } },
  });
};

// Guía y resumen
guide.showGridLines = false;
title(
  guide,
  'A1:H1',
  'Matriz completa de acceso por rol',
  'Estado actual del código · cada fila representa un rol ejercido por separado, dentro de su propio alcance.'
);
guide.getRange('A4:B8').values = [
  ['Indicador', 'Valor'],
  ['Roles catalogados', null],
  ['Roles con acceso a miembros', null],
  ['Roles con destacamentos de todo el país', null],
  ['Roles marcados solo lectura', null],
];
guide.getRange('B5').formulas = [[`=COUNTA('Niveles org'!B5:B${rows.length + 4})`]];
guide.getRange('B6').formulas = [[`=COUNTIF('Niveles org'!F5:F${rows.length + 4},"<>No")`]];
guide.getRange('B7').formulas = [[`=COUNTIF('Niveles org'!G5:G${rows.length + 4},"Todo el país")`]];
guide.getRange('B8').formulas = [[`=COUNTIF('Niveles org'!D5:D${rows.length + 4},"Sí")`]];
applyHeader(guide.getRange('A4:B4'));
applyBody(guide.getRange('A5:B8'));
guide.getRange('A10:H10').merge();
guide.getRange('A10').values = [['Cómo leer la matriz']];
guide.getRange('A10').format = { fill: COLORS.blue, font: { bold: true, color: COLORS.white } };
guide.getRange('A11:H17').values = [
  ['Etiqueta', 'Significado', '', '', '', '', '', ''],
  [COUNTRY, 'Acceso sin filtro territorial dentro del módulo indicado.', '', '', '', '', '', ''],
  [OWN_REGION, 'Acceso a la estructura o personas pertenecientes a la región propia.', '', '', '', '', '', ''],
  [OWN_SECTION, 'Acceso limitado a la sección propia.', '', '', '', '', '', ''],
  [OWN_DEST, 'Acceso limitado al destacamento propio.', '', '', '', '', '', ''],
  ['Sí · aprobación', 'Puede editar, pero el cambio debe ser aprobado por el Coordinador de Destacamento.', '', '', '', '', '', ''],
  ['Solicitar acceso', 'La ficha o expediente aparece bloqueado y ofrece un flujo para justificar la solicitud.', '', '', '', '', '', ''],
];
guide.getRange('B11:H17').merge(true);
applyHeader(guide.getRange('A11:H11'));
applyBody(guide.getRange('A12:H17'));
guide.getRange('A19:H19').merge();
guide.getRange('A19').values = [['Advertencias de alcance']];
guide.getRange('A19').format = { fill: COLORS.blue, font: { bold: true, color: COLORS.white } };
guide.getRange('A20:H25').values = [
  ['1', 'Ver una entidad no autoriza automáticamente a ver sus miembros ni sus datos sensibles.', '', '', '', '', '', ''],
  ['2', 'Los cargos seccionales ven actualmente la estructura de destacamentos de su región, pero sus miembros siguen limitados a su sección.', '', '', '', '', '', ''],
  ['3', 'Los cargos regionales y nacionales de supervisión pueden abrir la pestaña de Dispensa Médica, pero deben solicitar acceso al expediente restringido.', '', '', '', '', '', ''],
  ['4', 'Los permisos directos, exclusiones individuales y combinaciones de cargos pueden ampliar o reducir el resultado de una cuenta concreta.', '', '', '', '', '', ''],
  ['5', 'La matriz evalúa el rol solo y un recurso dentro de su alcance. No representa combinaciones de dos o más cargos.', '', '', '', '', '', ''],
  ['6', 'Administrador de Gestión de Tienda incluye el cambio solicitado: ve todos los destacamentos del país, sin gestionarlos.', '', '', '', '', '', ''],
];
guide.getRange('B20:H25').merge(true);
applyBody(guide.getRange('A20:H25'));
guide.getRange('A27:H27').merge();
guide.getRange('A27').values = [['Fuentes del código']];
guide.getRange('A27').format = { fill: COLORS.blue, font: { bold: true, color: COLORS.white } };
guide.getRange('A28:H33').values = [
  ['Archivo', 'Contenido auditado', '', '', '', '', '', ''],
  ['src/auth/permissions/roles.js', 'Catálogo, nombres y alcance predeterminado de los roles.', '', '', '', '', '', ''],
  ['src/auth/permissions/permissions.js', 'Catálogo canónico de capacidades.', '', '', '', '', '', ''],
  ['src/auth/permissions/role-permissions.js', 'Permisos y restricciones asignados a cada rol.', '', '', '', '', '', ''],
  ['src/utils/member-access.js', 'Alcance efectivo de miembros, pestañas, solicitudes e historial.', '', '', '', '', '', ''],
  ['src/utils/org-level-access.js', 'Edición de niveles, fotos, directivas y aprobaciones.', '', '', '', '', '', ''],
];
guide.getRange('B28:H33').merge(true);
applyHeader(guide.getRange('A28:H28'));
applyBody(guide.getRange('A29:H33'));
guide.getRange('A1:H33').format.wrapText = true;
guide.getRange('A:A').format.columnWidth = 28;
guide.getRange('B:H').format.columnWidth = 17;
guide.getRange('B5:B8').format.numberFormat = '0';
guide.freezePanes.freezeRows(3);

// Niveles organizacionales
const levelHeaders = [
  'Nivel del rol', 'Rol', 'Código', 'Solo lectura', 'Alcance predeterminado',
  'Miembros visibles', 'Destacamentos visibles', 'Secciones visibles', 'Regiones visibles',
  'Consejo Nacional', 'Crear destacamento', 'Editar destacamento', 'Cambiar foto destacamento',
  'Eliminar nivel', 'Asignar número oficial', 'Crear sección', 'Editar sección',
  'Editar región', 'Sugerir foto región', 'Aprobar cambios organización',
];
const levelValues = rows.map(({ levels, defaultScope }) => [
  levels.level, levels.role, levels.code, levels.readOnly, levelLabel[defaultScope], levels.members,
  levels.dests, levels.sections, levels.regions, levels.council, levels.destCreate, levels.destEdit,
  levels.destPhoto, levels.destDelete, levels.officialNumber, levels.sectionCreate, levels.sectionEdit,
  levels.regionEdit, levels.regionPhoto, levels.approveOrg,
]);
levelsSheet.showGridLines = false;
title(levelsSheet, 'A1:T1', 'Niveles organizacionales', 'Acceso efectivo a Miembros, Destacamentos, Secciones, Regiones y Consejo Nacional.');
levelsSheet.getRange('A4:T4').values = [levelHeaders];
levelsSheet.getRange(`A5:T${rows.length + 4}`).values = levelValues;
applyHeader(levelsSheet.getRange('A4:T4'));
applyBody(levelsSheet.getRange(`A5:T${rows.length + 4}`));
addStatusFormatting(levelsSheet.getRange(`D5:T${rows.length + 4}`));
levelsSheet.tables.add(`A4:T${rows.length + 4}`, true, 'NivelesOrganizacionales');
levelsSheet.freezePanes.freezeRows(4);
levelsSheet.freezePanes.freezeColumns(3);
levelsSheet.getRange('A:A').format.columnWidth = 15;
levelsSheet.getRange('B:B').format.columnWidth = 32;
levelsSheet.getRange('C:C').format.columnWidth = 35;
levelsSheet.getRange('D:T').format.columnWidth = 17;

// Ficha de miembro
const personHeaders = [
  'Nivel', 'Rol', 'Código', 'Alcance de miembros', 'Ver adultos', 'Ver menores',
  'Datos sensibles', 'Solicitar datos generales', 'Crear miembro', 'Editar General',
  'Cambiar foto miembro', 'Eliminar miembro', 'Aprobar cambios', 'Dispensa: ver',
  'Dispensa: solicitar', 'Dispensa: editar', 'Dispensa: subir documentos',
  'Dispensa: eliminar documentos', 'Dispensa: autorizar menor', 'Ascenso: ver',
  'Ascenso: editar', 'Padres: ver', 'Padres: agregar/corregir', 'Padres: eliminar',
  'Historial: ver', 'Historial: solicitar',
];
const personValues = rows.map(({ person }) => Object.values(person));
personSheet.showGridLines = false;
title(personSheet, 'A1:Z1', 'Ficha de miembro y módulos internos', 'General, foto, Dispensa Médica, Sistema de Ascenso, Padres e Historial.');
personSheet.getRange('A4:Z4').values = [personHeaders];
personSheet.getRange(`A5:Z${rows.length + 4}`).values = personValues;
applyHeader(personSheet.getRange('A4:Z4'));
applyBody(personSheet.getRange(`A5:Z${rows.length + 4}`));
addStatusFormatting(personSheet.getRange(`D5:Z${rows.length + 4}`));
personSheet.tables.add(`A4:Z${rows.length + 4}`, true, 'FichaMiembroAcceso');
personSheet.freezePanes.freezeRows(4);
personSheet.freezePanes.freezeColumns(3);
personSheet.getRange('A:A').format.columnWidth = 15;
personSheet.getRange('B:B').format.columnWidth = 32;
personSheet.getRange('C:C').format.columnWidth = 35;
personSheet.getRange('D:Z').format.columnWidth = 18;

// Directivas
const directiveHeaders = [
  'Nivel', 'Rol', 'Código', 'Ver directiva destacamento', 'Acción directiva destacamento',
  'Ver directiva sección', 'Acción directiva sección', 'Ver directiva región',
  'Acción directiva región', 'Ver Consejo Nacional', 'Acción directiva nacional',
  'Aprueba propuestas organización',
];
const directiveValues = rows.map(({ directives }) => Object.values(directives));
directivaSheet.showGridLines = false;
title(directivaSheet, 'A1:L1', 'Directivas por nivel', 'Ver, cambiar directamente, proponer o revisar/aprobar según el rol.');
directivaSheet.getRange('A4:L4').values = [directiveHeaders];
directivaSheet.getRange(`A5:L${rows.length + 4}`).values = directiveValues;
applyHeader(directivaSheet.getRange('A4:L4'));
applyBody(directivaSheet.getRange(`A5:L${rows.length + 4}`));
addStatusFormatting(directivaSheet.getRange(`D5:L${rows.length + 4}`));
directivaSheet.tables.add(`A4:L${rows.length + 4}`, true, 'DirectivasAcceso');
directivaSheet.freezePanes.freezeRows(4);
directivaSheet.freezePanes.freezeColumns(3);
directivaSheet.getRange('A:A').format.columnWidth = 15;
directivaSheet.getRange('B:B').format.columnWidth = 32;
directivaSheet.getRange('C:C').format.columnWidth = 35;
directivaSheet.getRange('D:L').format.columnWidth = 23;

// Catálogo crudo: auditoría exacta de todos los permisos por rol.
const rawHeaders = ['Nivel', 'Rol', 'Código', ...PERMISOS_CATALOGO.map((item) => item.codigo)];
const rawValues = rows.map(({ profile, user }) => [
  profile.level,
  profile.role,
  profile.code,
  ...PERMISOS_CATALOGO.map((permission) => permissionLabel(has(user, permission.codigo))),
]);
const rawLastColumn = (() => {
  let n = rawHeaders.length;
  let result = '';
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
})();
rawSheet.showGridLines = false;
title(rawSheet, `A1:${rawLastColumn}1`, 'Permisos crudos del catálogo', '✓ = el rol contiene el permiso canónico; — = no lo contiene. No sustituye las restricciones de alcance.');
rawSheet.getRange(`A4:${rawLastColumn}4`).values = [rawHeaders];
rawSheet.getRange(`A5:${rawLastColumn}${rows.length + 4}`).values = rawValues;
applyHeader(rawSheet.getRange(`A4:${rawLastColumn}4`));
applyBody(rawSheet.getRange(`A5:${rawLastColumn}${rows.length + 4}`));
rawSheet.getRange(`D5:${rawLastColumn}${rows.length + 4}`).conditionalFormats.add('containsText', {
  text: '✓',
  format: { fill: COLORS.green, font: { color: COLORS.greenText, bold: true } },
});
rawSheet.getRange(`D5:${rawLastColumn}${rows.length + 4}`).conditionalFormats.add('containsText', {
  text: '—',
  format: { fill: COLORS.gray, font: { color: '#7A8791' } },
});
rawSheet.tables.add(`A4:${rawLastColumn}${rows.length + 4}`, true, 'PermisosCrudos');
rawSheet.freezePanes.freezeRows(4);
rawSheet.freezePanes.freezeColumns(3);
rawSheet.getRange('A:A').format.columnWidth = 15;
rawSheet.getRange('B:B').format.columnWidth = 32;
rawSheet.getRange('C:C').format.columnWidth = 35;
rawSheet.getRange(`D:${rawLastColumn}`).format.columnWidth = 14;

await fs.mkdir(previewDir, { recursive: true });

const inspections = [];
inspections.push(
  await workbook.inspect({
    kind: 'table',
    range: 'Niveles org!A1:T12',
    include: 'values,formulas',
    tableMaxRows: 12,
    tableMaxCols: 20,
    maxChars: 12000,
  })
);
inspections.push(
  await workbook.inspect({
    kind: 'table',
    range: 'Ficha miembro!A1:Z10',
    include: 'values,formulas',
    tableMaxRows: 10,
    tableMaxCols: 26,
    maxChars: 12000,
  })
);
const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'final formula error scan',
  maxChars: 4000,
});

for (const [sheetName, range, fileName] of [
  ['Guía', 'A1:H33', 'guia.png'],
  ['Niveles org', 'A1:T18', 'niveles-org.png'],
  ['Ficha miembro', 'A1:Z16', 'ficha-miembro.png'],
  ['Directivas', 'A1:L18', 'directivas.png'],
  ['Permisos crudos', `A1:${rawLastColumn}12`, 'permisos-crudos.png'],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(path.join(previewDir, fileName), new Uint8Array(await preview.arrayBuffer()));
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(JSON.stringify({
  outputPath,
  roles: rows.length,
  permissions: PERMISOS_CATALOGO.length,
  inspections: inspections.map((item) => item.ndjson?.slice(0, 2500)),
  errors: errors.ndjson,
}, null, 2));
