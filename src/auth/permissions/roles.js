export const ROLES = {
  USUARIO_COMUN: 'usuario_comun',
  USUARIO_DESTACAMENTO: 'usuario_destacamento',
  USUARIO_SECCION: 'usuario_seccion',
  USUARIO_REGION: 'usuario_region',
  CONSEJO_NACIONAL: 'consejo_nacional',
  CONSEJO_EJECUTIVO: 'consejo_ejecutivo',

  ADMINISTRADOR_GLOBAL: 'administrador_global',
  ADMINISTRADOR_FUNCIONAL: 'administrador_funcional',
  ADMINISTRADOR_TIENDA: 'administrador_tienda',
};

export const ALCANCES = {
  DESTACAMENTO: 'destacamento',
  SECCION: 'seccion',
  REGION: 'region',
  NACIONAL: 'nacional',
  GLOBAL: 'global',
};

export const ROLES_CATALOGO = [
  {
    codigo: ROLES.USUARIO_COMUN,
    nombre: 'Usuario Comun',
    descripcion: 'Acceso basico a su destacamento y datos publicos de destacamentos de su seccion.',
    alcancePredeterminado: ALCANCES.DESTACAMENTO,
    asignableDesdeAdministradores: true,
    activo: true,
  },
  {
    codigo: ROLES.USUARIO_DESTACAMENTO,
    nombre: 'Coordinador de Destacamento',
    descripcion: 'Gestion operativa de miembros y documentos dentro de un destacamento.',
    alcancePredeterminado: ALCANCES.DESTACAMENTO,
    asignableDesdeAdministradores: true,
    activo: true,
  },
  {
    codigo: ROLES.USUARIO_SECCION,
    nombre: 'Coordinador Seccional',
    descripcion: 'Supervision de destacamentos y miembros adultos dentro de una seccion.',
    alcancePredeterminado: ALCANCES.SECCION,
    asignableDesdeAdministradores: true,
    activo: true,
  },
  {
    codigo: ROLES.USUARIO_REGION,
    nombre: 'Director Regional',
    descripcion: 'Supervision regional de secciones, destacamentos e indicadores.',
    alcancePredeterminado: ALCANCES.REGION,
    asignableDesdeAdministradores: true,
    activo: true,
  },
  {
    codigo: ROLES.CONSEJO_NACIONAL,
    nombre: 'Consejo Nacional',
    descripcion: 'Consulta estrategica nacional para cargos organizacionales de nivel zonal hacia arriba.',
    alcancePredeterminado: ALCANCES.NACIONAL,
    asignableDesdeAdministradores: true,
    activo: true,
  },
  {
    codigo: ROLES.CONSEJO_EJECUTIVO,
    nombre: 'Consejo Ejecutivo',
    descripcion: 'Consulta nacional completa sin modificacion directa de informacion.',
    alcancePredeterminado: ALCANCES.NACIONAL,
    asignableDesdeAdministradores: true,
    activo: true,
  },
  {
    codigo: ROLES.ADMINISTRADOR_GLOBAL,
    nombre: 'Administrador Global',
    descripcion: 'Control total de la plataforma.',
    alcancePredeterminado: ALCANCES.GLOBAL,
    asignableDesdeAdministradores: false,
    activo: true,
  },
  {
    codigo: ROLES.ADMINISTRADOR_FUNCIONAL,
    nombre: 'Administrador Funcional',
    descripcion: 'Mantenimiento, respaldo, configuracion y correos sin acceso administrativo a tienda.',
    alcancePredeterminado: ALCANCES.GLOBAL,
    asignableDesdeAdministradores: false,
    activo: true,
  },
  {
    codigo: ROLES.ADMINISTRADOR_TIENDA,
    nombre: 'Administrador de Gestion de Tienda',
    descripcion: 'Gestion comercial de productos, ventas, ordenes e inventario.',
    alcancePredeterminado: ALCANCES.GLOBAL,
    asignableDesdeAdministradores: false,
    activo: true,
  },
];

export const ROLES_ASIGNABLES_CATALOGO = ROLES_CATALOGO.filter(
  (rol) => rol.asignableDesdeAdministradores
);

export const ROLES_POR_CODIGO = Object.fromEntries(ROLES_CATALOGO.map((rol) => [rol.codigo, rol]));
