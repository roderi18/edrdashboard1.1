import { PERMISOS } from './permissions';
import { ROLES, ALCANCES } from './roles';

const RESTRICCIONES_BASE = {
  soloLectura: false,
  requierePermisoParaMenores: false,
  eliminarDocumentosRequiereAprobacion: true,
  puedeAsignarNumeroOficial: false,
};

// Restriccion compartida por los coordinadores de area (adiestramiento,
// promocion, produccion, programa) tanto seccionales como regionales.
const RESTRICCIONES_COORDINADOR_AREA = {
  ...RESTRICCIONES_BASE,
  requierePermisoParaMenores: true,
};

// Codigos de los coordinadores de area por nivel (para asignar los mismos
// permisos/restricciones/alcance a los 4 de cada nivel).
const COORDINADORES_AREA_SECCION = [
  ROLES.COORDINADOR_ADIESTRAMIENTO_SECCION,
  ROLES.COORDINADOR_PROMOCION_SECCION,
  ROLES.COORDINADOR_PRODUCCION_SECCION,
  ROLES.COORDINADOR_PROGRAMA_SECCION,
];

const COORDINADORES_AREA_REGION = [
  ROLES.COORDINADOR_ADIESTRAMIENTO_REGION,
  ROLES.COORDINADOR_PROMOCION_REGION,
  ROLES.COORDINADOR_PRODUCCION_REGION,
  ROLES.COORDINADOR_PROGRAMA_REGION,
];

// Cargos de nivel región. Todos comparten el perfil de consulta de solo lectura
// del Consejo Nacional (Director Nacional): ven la estructura y los miembros
// (adultos y menores) pero no editan nada. Su alcance regional (ALCANCES.REGION)
// solo acota QUÉ miembros ven (los de su región), no lo que pueden hacer.
const CARGOS_REGIONALES_PERFIL_DIRECTOR = [
  ROLES.USUARIO_REGION,
  ROLES.USUARIO_REGION_ASISTENTE,
  ...COORDINADORES_AREA_REGION,
  // Capellán Regional: consulta de solo lectura de nivel región.
  ROLES.CAPELLAN_REGIONAL,
  // Secretario Regional: cargo de nivel REGIÓN, no de sección. Consulta toda su
  // región con el mismo perfil de solo lectura que los coordinadores de área
  // regional (p. ej. el Coordinador de Programa).
  ROLES.SECRETARIO_REGIONAL,
];

// Cargos de consulta de solo lectura de nivel sección (Capellán Seccional, Zonas,
// Grupos Locales): mismo perfil que los coordinadores de área seccional (ven
// adultos, menores enmascarados/restringidos, sin editar).
const CARGOS_SECCIONALES_CONSULTA = [
  ROLES.CAPELLAN_SECCIONAL,
  ROLES.ZONAS,
  ROLES.GRUPOS_LOCALES,
];

// Coordinadores de area: solo consulta dentro de su alcance. No editan/crean/
// eliminan niveles, no editan miembros, no ven datos sensibles ni menores.
// Pueden ver (nunca editar) el Sistema de Ascenso y Padres.
const PERMISOS_COORDINADOR_AREA_SECCION = [
  // Consulta de la estructura completa de Niveles Organizacionales (Regiones y
  // Consejo Nacional incluidos), igual que el Coordinador Seccional titular. No
  // habilita edicion: estos cargos no tienen REGIONES_EDITAR.
  PERMISOS.REGIONES_VER,
  PERMISOS.SECCIONES_VER,
  PERMISOS.DESTACAMENTOS_VER,
  PERMISOS.MIEMBROS_VER,
  PERMISOS.MIEMBROS_VER_ADULTOS,
  PERMISOS.DOCUMENTOS_VER,
  PERMISOS.REPORTES_VER_LOCALES,
  PERMISOS.REPORTES_VER_SECCIONALES,
  PERMISOS.TIENDA_VER,
  PERMISOS.ASCENSO_VER,
  PERMISOS.PADRES_VER,
];

// Cargos mostrados en el desplegable de Consejo Nacional. Todos comparten el
// mismo perfil de permisos y restricciones del Director Nacional.
const CARGOS_CONSEJO_NACIONAL_PERFIL_DIRECTOR = [
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
];

// Perfil compartido del Consejo Nacional: consulta la estructura del país y ve
// la Dispensa Médica de adultos y menores. Salud es estrictamente de solo
// lectura: no edita ni gestiona documentos.
const PERMISOS_DIRECTOR_NACIONAL = [
  PERMISOS.REGIONES_VER,
  PERMISOS.SECCIONES_VER,
  PERMISOS.DESTACAMENTOS_VER,
  PERMISOS.MIEMBROS_VER,
  PERMISOS.MIEMBROS_VER_ADULTOS,
  PERMISOS.MIEMBROS_VER_MENORES,
  PERMISOS.REPORTES_VER_LOCALES,
  PERMISOS.REPORTES_VER_SECCIONALES,
  PERMISOS.REPORTES_VER_REGIONALES,
  PERMISOS.REPORTES_VER_NACIONALES,
  PERMISOS.TIENDA_VER,
  PERMISOS.SALUD_VER,
  PERMISOS.ASCENSO_VER,
];

const RESTRICCIONES_DIRECTOR_NACIONAL = {
  ...RESTRICCIONES_BASE,
  soloLectura: true,
  requierePermisoParaMenores: true,
};

const fromCodes = (codes, value) => Object.fromEntries(codes.map((code) => [code, value]));

// Grupos de permisos de Dispensa Médica, Sistema de Ascenso y Padres. El "editar"
// de salud/ascenso está separado del "ver" para poder concederlos por separado.
// (El que estos cargos editen por aprobación o directo lo sigue decidiendo la app
// por rol; el catálogo solo declara la capacidad.)
const PERMISOS_SALUD_APROBACION = [
  PERMISOS.SALUD_VER,
  PERMISOS.SALUD_EDITAR,
  PERMISOS.SALUD_SUBIR_DOCUMENTOS,
];
const PERMISOS_SALUD_COMPLETO = [
  ...PERMISOS_SALUD_APROBACION,
  PERMISOS.SALUD_ELIMINAR_DOCUMENTOS,
  PERMISOS.SALUD_AUTORIZAR_ACCESO_MENORES,
];
const PERMISOS_ASCENSO_EDITOR = [PERMISOS.ASCENSO_VER, PERMISOS.ASCENSO_EDITAR];
const PERMISOS_PADRES_EDITOR = [PERMISOS.PADRES_VER, PERMISOS.PADRES_EDITAR];
// Coordinador/Sub-Coordinador Seccional: consultan salud, ascenso y padres de su
// alcance pero NO editan (solo lectura).
const PERMISOS_SALUD_ASCENSO_PADRES_LECTURA = [
  PERMISOS.SALUD_VER,
  PERMISOS.ASCENSO_VER,
  PERMISOS.PADRES_VER,
];

// Cargos de nivel destacamento que comparten el perfil del Coordinador de
// Destacamento (mismos permisos, alcance y restricciones).
const CARGOS_DESTACAMENTO = [
  ROLES.PASTOR_DESTACAMENTO,
  ROLES.CONSEJO_DESTACAMENTO,
  ROLES.CAPELLAN_DESTACAMENTO,
  ROLES.LIDER_GRUPO,
  ROLES.LIDER_ASISTENTE_GRUPO,
];

// Lider de Grupo y Lider Asistente de Grupo: perfil operativo base + crear
// miembros, ver regiones, reportes seccionales y enviar correos.
const LIDERES_GRUPO = [ROLES.LIDER_GRUPO, ROLES.LIDER_ASISTENTE_GRUPO];

const PERMISOS_CARGO_DESTACAMENTO = [
  PERMISOS.DESTACAMENTOS_VER,
  PERMISOS.SECCIONES_VER,
  PERMISOS.MIEMBROS_VER,
  PERMISOS.MIEMBROS_VER_ADULTOS,
  PERMISOS.MIEMBROS_VER_MENORES,
  // SIN `miembros.ver_datos_sensibles`: el Lider de Grupo y su asistente ven la
  // ficha con los datos personales ENMASCARADOS (direccion, telefono y correo).
  // La fecha de nacimiento es la unica excepcion y se resuelve en la vista con
  // `canViewMemberBirthdateWhenMasked`, porque la necesitan para la division.
  PERMISOS.MIEMBROS_EDITAR,
  PERMISOS.MIEMBROS_SUBIR_FOTO,
  PERMISOS.DOCUMENTOS_VER,
  PERMISOS.DOCUMENTOS_SUBIR,
  PERMISOS.DOCUMENTOS_SOLICITAR_ELIMINACION,
  PERMISOS.ASISTENCIA_VER,
  PERMISOS.ASISTENCIA_CREAR,
  PERMISOS.ASISTENCIA_EDITAR,
  PERMISOS.REPORTES_VER_LOCALES,
  PERMISOS.REPORTES_VER_REGIONALES,
  PERMISOS.REPORTES_VER_NACIONALES,
  PERMISOS.TIENDA_VER,
  // Salud (editan vía aprobación, suben documentos, no eliminan), ascenso y padres.
  ...PERMISOS_SALUD_APROBACION,
  ...PERMISOS_ASCENSO_EDITOR,
  ...PERMISOS_PADRES_EDITOR,
];

// Lider de Grupo / Asistente: base + crear miembros, ver regiones, reportes
// seccionales y enviar correos. (Sus ediciones siguen yendo a aprobacion del
// Coordinador; eso lo controla la app por rol, no el catalogo de permisos.)
const PERMISOS_LIDER_GRUPO = [
  ...PERMISOS_CARGO_DESTACAMENTO,
  PERMISOS.MIEMBROS_CREAR,
  PERMISOS.REGIONES_VER,
  PERMISOS.REPORTES_VER_SECCIONALES,
  PERMISOS.CORREOS_ENVIAR,
];

const RESTRICCIONES_CARGO_DESTACAMENTO = {
  ...RESTRICCIONES_BASE,
  requierePermisoParaMenores: true,
  eliminarDocumentosRequiereAprobacion: true,
};

// Perfil del Coordinador de Destacamento (titular). El Coordinador Asistente
// comparte EXACTAMENTE este perfil: gestionan a los miembros de su destacamento
// de forma directa (crear/editar sin aprobacion), Dispensa Medica completa,
// aprueban cambios de otros cargos, ven datos sensibles y menores, y eliminan
// documentos directamente.
const PERMISOS_COORDINADOR_DESTACAMENTO = [
  PERMISOS.DESTACAMENTOS_VER,
  PERMISOS.SECCIONES_VER,
  PERMISOS.REGIONES_VER,
  PERMISOS.MIEMBROS_VER,
  PERMISOS.MIEMBROS_VER_ADULTOS,
  PERMISOS.MIEMBROS_VER_MENORES,
  PERMISOS.MIEMBROS_VER_DATOS_SENSIBLES,
  PERMISOS.MIEMBROS_CREAR,
  PERMISOS.MIEMBROS_EDITAR,
  PERMISOS.MIEMBROS_SUBIR_FOTO,
  PERMISOS.DOCUMENTOS_VER,
  PERMISOS.DOCUMENTOS_SUBIR,
  PERMISOS.DOCUMENTOS_SOLICITAR_ELIMINACION,
  PERMISOS.DOCUMENTOS_ELIMINAR,
  PERMISOS.ASISTENCIA_VER,
  PERMISOS.ASISTENCIA_CREAR,
  PERMISOS.ASISTENCIA_EDITAR,
  PERMISOS.REPORTES_VER_LOCALES,
  PERMISOS.REPORTES_VER_SECCIONALES,
  PERMISOS.REPORTES_VER_REGIONALES,
  PERMISOS.REPORTES_VER_NACIONALES,
  PERMISOS.TIENDA_VER,
  PERMISOS.CORREOS_ENVIAR,
  ...PERMISOS_SALUD_COMPLETO,
  ...PERMISOS_ASCENSO_EDITOR,
  PERMISOS.MIEMBROS_APROBAR_CAMBIOS,
  ...PERMISOS_PADRES_EDITOR,
];

const RESTRICCIONES_COORDINADOR_DESTACAMENTO = {
  ...RESTRICCIONES_BASE,
  requierePermisoParaMenores: true,
  // Coordinador (y equivalentes): elimina documentos de sus miembros directamente.
  eliminarDocumentosRequiereAprobacion: false,
};

// Pastor, Consejo y Capellán: mismo perfil OPERATIVO que el Líder de Grupo. Editan
// a los miembros de su destacamento y sus cambios (General y Dispensa Médica) van
// a APROBACION del Coordinador de Destacamento y su Asistente; los campos
// estructurales/sensibles quedan bloqueados igual que al líder. Conservan además la
// vista de regiones y reportes seccionales que ya tenían. NO crean miembros ni
// envían correos (eso es exclusivo del líder). El Consejo y el Capellán ven los
// datos personales enmascarados; el Pastor los ve completos (ver
// `MIEMBROS_VER_DATOS_SENSIBLES` en su perfil).
// Sistema de Ascenso queda en SOLO LECTURA para estos tres cargos: consultan el
// avance del miembro (`ascenso.ver`) pero no lo modifican. Es la diferencia con el
// Líder de Grupo, que sí edita el ascenso.
const PERMISOS_CARGO_DESTACAMENTO_APROBACION = [
  ...PERMISOS_CARGO_DESTACAMENTO.filter((permiso) => permiso !== PERMISOS.ASCENSO_EDITAR),
  PERMISOS.REGIONES_VER,
  PERMISOS.REPORTES_VER_SECCIONALES,
];

// Pastor: además de editar/enviar a aprobación, ve los datos personales sensibles
// en claro (dirección, teléfono, correo).
const PERMISOS_PASTOR_APROBACION = [
  ...PERMISOS_CARGO_DESTACAMENTO_APROBACION,
  PERMISOS.MIEMBROS_VER_DATOS_SENSIBLES,
];

export const RESTRICCIONES_ROL = {
  [ROLES.USUARIO_COMUN]: {
    ...RESTRICCIONES_BASE,
    requierePermisoParaMenores: true,
  },
  [ROLES.USUARIO_DESTACAMENTO]: RESTRICCIONES_COORDINADOR_DESTACAMENTO,
  [ROLES.USUARIO_DESTACAMENTO_ASISTENTE]: RESTRICCIONES_COORDINADOR_DESTACAMENTO,
  // Pastor, Consejo y Capellán heredan aquí las restricciones del cargo de
  // destacamento (editable, con eliminación de documentos por aprobación): editan y
  // envían cambios a aprobación igual que el Líder de Grupo.
  ...fromCodes(CARGOS_DESTACAMENTO, RESTRICCIONES_CARGO_DESTACAMENTO),
  [ROLES.USUARIO_SECCION]: {
    ...RESTRICCIONES_BASE,
    requierePermisoParaMenores: true,
  },
  [ROLES.USUARIO_SECCION_ASISTENTE]: {
    ...RESTRICCIONES_BASE,
    requierePermisoParaMenores: true,
  },
  ...fromCodes(COORDINADORES_AREA_SECCION, RESTRICCIONES_COORDINADOR_AREA),
  // Cargos seccionales de consulta: como el de área pero explícitamente solo
  // lectura (el .NET rechaza sus escrituras vía el claim soloLectura).
  ...fromCodes(CARGOS_SECCIONALES_CONSULTA, {
    ...RESTRICCIONES_COORDINADOR_AREA,
    soloLectura: true,
  }),
  // Cargos regionales: perfil de consulta de solo lectura del Consejo Nacional.
  ...fromCodes(CARGOS_REGIONALES_PERFIL_DIRECTOR, RESTRICCIONES_DIRECTOR_NACIONAL),
  [ROLES.CONSEJO_NACIONAL]: {
    ...RESTRICCIONES_BASE,
    requierePermisoParaMenores: true,
    soloLectura: true,
  },
  ...fromCodes(CARGOS_CONSEJO_NACIONAL_PERFIL_DIRECTOR, RESTRICCIONES_DIRECTOR_NACIONAL),
  [ROLES.CONSEJO_EJECUTIVO]: {
    ...RESTRICCIONES_BASE,
    soloLectura: true,
  },
  [ROLES.ADMINISTRADOR_GLOBAL]: {
    ...RESTRICCIONES_BASE,
    eliminarDocumentosRequiereAprobacion: false,
    puedeAsignarNumeroOficial: true,
  },
  [ROLES.ADMINISTRADOR_FUNCIONAL]: {
    ...RESTRICCIONES_BASE,
    eliminarDocumentosRequiereAprobacion: true,
  },
  [ROLES.ADMINISTRADOR_TIENDA]: {
    ...RESTRICCIONES_BASE,
  },
};

export const ALCANCE_PREDETERMINADO_ROL = {
  [ROLES.USUARIO_COMUN]: ALCANCES.DESTACAMENTO,
  [ROLES.USUARIO_DESTACAMENTO]: ALCANCES.DESTACAMENTO,
  [ROLES.USUARIO_DESTACAMENTO_ASISTENTE]: ALCANCES.DESTACAMENTO,
  ...fromCodes(CARGOS_DESTACAMENTO, ALCANCES.DESTACAMENTO),
  [ROLES.USUARIO_SECCION]: ALCANCES.SECCION,
  [ROLES.USUARIO_SECCION_ASISTENTE]: ALCANCES.SECCION,
  [ROLES.USUARIO_REGION]: ALCANCES.REGION,
  [ROLES.USUARIO_REGION_ASISTENTE]: ALCANCES.REGION,
  ...fromCodes(COORDINADORES_AREA_SECCION, ALCANCES.SECCION),
  ...fromCodes(CARGOS_SECCIONALES_CONSULTA, ALCANCES.SECCION),
  // Todos los cargos de nivel región (titular, asistente, coordinadores de área,
  // Capellán Regional y Secretario Regional) comparten el alcance regional. Se
  // deriva de la lista para que agregar un cargo regional no exija tocar esto.
  ...fromCodes(CARGOS_REGIONALES_PERFIL_DIRECTOR, ALCANCES.REGION),
  [ROLES.CONSEJO_NACIONAL]: ALCANCES.NACIONAL,
  ...fromCodes(CARGOS_CONSEJO_NACIONAL_PERFIL_DIRECTOR, ALCANCES.NACIONAL),
  [ROLES.CONSEJO_EJECUTIVO]: ALCANCES.NACIONAL,
  [ROLES.ADMINISTRADOR_GLOBAL]: ALCANCES.GLOBAL,
  [ROLES.ADMINISTRADOR_FUNCIONAL]: ALCANCES.GLOBAL,
  [ROLES.ADMINISTRADOR_TIENDA]: ALCANCES.GLOBAL,
};

export const PERMISOS_POR_ROL = {
  [ROLES.USUARIO_COMUN]: [
    PERMISOS.DESTACAMENTOS_VER,
    PERMISOS.MIEMBROS_VER_ADULTOS,
    PERMISOS.MIEMBROS_VER_MENORES,
    PERMISOS.REPORTES_VER_LOCALES,
    PERMISOS.TIENDA_VER,
    // Sistema de Ascenso: solo lectura.
    PERMISOS.ASCENSO_VER,
  ],
  // Coordinador de Destacamento: gestiona a los miembros de su destacamento
  // (crear, editar), sus documentos (subir/eliminar) y asistencia; ve regiones y
  // reportes de todos los niveles; puede enviar correos. No elimina miembros.
  [ROLES.USUARIO_DESTACAMENTO]: PERMISOS_COORDINADOR_DESTACAMENTO,
  // Coordinador Asistente de Destacamento: identico al titular (apoyo operativo).
  [ROLES.USUARIO_DESTACAMENTO_ASISTENTE]: PERMISOS_COORDINADOR_DESTACAMENTO,
  // Pastor: edita y envía cambios a aprobación (como el Líder de Grupo) y ve los
  // datos sensibles en claro.
  [ROLES.PASTOR_DESTACAMENTO]: PERMISOS_PASTOR_APROBACION,
  // Consejo y Capellan: editan y envían a aprobación (como el Líder de Grupo), pero
  // con los datos personales enmascarados (solo fecha de nacimiento visible).
  [ROLES.CONSEJO_DESTACAMENTO]: PERMISOS_CARGO_DESTACAMENTO_APROBACION,
  [ROLES.CAPELLAN_DESTACAMENTO]: PERMISOS_CARGO_DESTACAMENTO_APROBACION,
  // Líder de Grupo y Líder Asistente: base + crear miembros, ver regiones,
  // reportes seccionales y enviar correos.
  ...fromCodes(LIDERES_GRUPO, PERMISOS_LIDER_GRUPO),
  [ROLES.USUARIO_SECCION]: [
    // Ve todos los niveles organizacionales (el alcance propio-vs-ajeno para
    // editar lo aplican los predicados de org-level-access).
    PERMISOS.REGIONES_VER,
    PERMISOS.SECCIONES_VER,
    PERMISOS.SECCIONES_EDITAR,
    PERMISOS.DESTACAMENTOS_VER,
    PERMISOS.DESTACAMENTOS_CREAR,
    PERMISOS.DESTACAMENTOS_EDITAR,
    PERMISOS.DESTACAMENTOS_SUBIR_FOTO,
    // Puede ver la lista completa de miembros de todos los niveles, sin editar.
    PERMISOS.MIEMBROS_VER,
    PERMISOS.MIEMBROS_VER_ADULTOS,
    PERMISOS.DOCUMENTOS_VER,
    PERMISOS.REPORTES_VER_LOCALES,
    PERMISOS.REPORTES_VER_SECCIONALES,
    PERMISOS.REPORTES_VER_REGIONALES,
    PERMISOS.TIENDA_VER,
    // Dispensa Médica, Sistema de Ascenso y Padres: solo lectura (no editan).
    ...PERMISOS_SALUD_ASCENSO_PADRES_LECTURA,
  ],
  // Sub-Coordinador Seccional: apoyo del titular. Crea/edita destacamentos de su
  // seccion, pero NO edita la seccion misma (eso queda para el Coordinador).
  [ROLES.USUARIO_SECCION_ASISTENTE]: [
    PERMISOS.REGIONES_VER,
    PERMISOS.SECCIONES_VER,
    PERMISOS.DESTACAMENTOS_VER,
    PERMISOS.DESTACAMENTOS_CREAR,
    PERMISOS.DESTACAMENTOS_EDITAR,
    PERMISOS.DESTACAMENTOS_SUBIR_FOTO,
    PERMISOS.MIEMBROS_VER,
    PERMISOS.MIEMBROS_VER_ADULTOS,
    PERMISOS.DOCUMENTOS_VER,
    PERMISOS.REPORTES_VER_LOCALES,
    PERMISOS.REPORTES_VER_SECCIONALES,
    PERMISOS.REPORTES_VER_REGIONALES,
    PERMISOS.TIENDA_VER,
    // Dispensa Médica, Sistema de Ascenso y Padres: solo lectura (no editan).
    ...PERMISOS_SALUD_ASCENSO_PADRES_LECTURA,
  ],
  ...fromCodes(COORDINADORES_AREA_SECCION, PERMISOS_COORDINADOR_AREA_SECCION),
  ...fromCodes(CARGOS_SECCIONALES_CONSULTA, PERMISOS_COORDINADOR_AREA_SECCION),
  // Cargos regionales (Coordinador/Sub-Director Regional y coordinadores de área
  // regional): mismo perfil de consulta de solo lectura del Consejo Nacional
  // (Director Nacional). Ven la estructura y los miembros (adultos y menores) pero
  // no editan nada; su alcance regional solo acota qué miembros ven (los de su
  // región), lo que aplican los filtros de lista en member-access.js.
  ...fromCodes(CARGOS_REGIONALES_PERFIL_DIRECTOR, PERMISOS_DIRECTOR_NACIONAL),
  [ROLES.CONSEJO_NACIONAL]: [
    PERMISOS.DESTACAMENTOS_VER,
    PERMISOS.MIEMBROS_VER_ADULTOS,
    PERMISOS.REPORTES_VER_LOCALES,
    PERMISOS.REPORTES_VER_SECCIONALES,
    PERMISOS.REPORTES_VER_REGIONALES,
    PERMISOS.REPORTES_VER_NACIONALES,
  ],
  // Todos los cargos del desplegable de Consejo Nacional comparten el perfil del
  // Director Nacional.
  ...fromCodes(CARGOS_CONSEJO_NACIONAL_PERFIL_DIRECTOR, PERMISOS_DIRECTOR_NACIONAL),
  [ROLES.CONSEJO_EJECUTIVO]: [
    PERMISOS.DESTACAMENTOS_VER,
    PERMISOS.MIEMBROS_VER,
    PERMISOS.MIEMBROS_VER_ADULTOS,
    PERMISOS.MIEMBROS_VER_MENORES,
    PERMISOS.MIEMBROS_VER_DATOS_SENSIBLES,
    PERMISOS.MIEMBROS_SUBIR_FOTO,
    PERMISOS.DOCUMENTOS_VER,
    PERMISOS.REPORTES_VER_LOCALES,
    PERMISOS.REPORTES_VER_SECCIONALES,
    PERMISOS.REPORTES_VER_REGIONALES,
    PERMISOS.REPORTES_VER_NACIONALES,
    PERMISOS.ADMINISTRACION_VER_AUDITORIA,
  ],
  [ROLES.ADMINISTRADOR_GLOBAL]: Object.values(PERMISOS),
  [ROLES.ADMINISTRADOR_FUNCIONAL]: [
    PERMISOS.MIEMBROS_VER,
    PERMISOS.MIEMBROS_VER_ADULTOS,
    PERMISOS.MIEMBROS_SUBIR_FOTO,
    PERMISOS.DESTACAMENTOS_VER,
    PERMISOS.DOCUMENTOS_VER,
    PERMISOS.REPORTES_VER_LOCALES,
    PERMISOS.REPORTES_VER_SECCIONALES,
    PERMISOS.REPORTES_VER_REGIONALES,
    PERMISOS.REPORTES_VER_NACIONALES,
    PERMISOS.ADMINISTRACION_GESTIONAR_USUARIOS,
    PERMISOS.ADMINISTRACION_GESTIONAR_ROLES,
    PERMISOS.ADMINISTRACION_VER_AUDITORIA,
    PERMISOS.CORREOS_ENVIAR,
  ],
  [ROLES.ADMINISTRADOR_TIENDA]: [
    PERMISOS.TIENDA_VER,
    PERMISOS.TIENDA_GESTIONAR,
    PERMISOS.TIENDA_ACCESO_ADMINISTRATIVO,
    PERMISOS.ADMINISTRACION_VER_AUDITORIA,
  ],
};

export const crearDefinicionRol = (rol) => ({
  ...rol,
  permisos: PERMISOS_POR_ROL[rol.codigo] || [],
  restricciones: RESTRICCIONES_ROL[rol.codigo] || RESTRICCIONES_BASE,
});
