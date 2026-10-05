/**
 * Catalogo unico del esquema de Firestore de EXPEDITION.
 *
 * `canonico` es el nombre profesional que se usara despues de la migracion.
 * `heredados` contiene los nombres fisicos que existen actualmente. Mientras
 * ESQUEMA_FIRESTORE_VERSION no sea `canonico`, la aplicacion conserva esos
 * nombres y, por tanto, su comportamiento actual.
 */

const definir = (canonico, ...heredados) =>
  Object.freeze({ canonico, heredados: Object.freeze(heredados.length ? heredados : [canonico]) });

export const DEFINICIONES_COLECCIONES = Object.freeze({
  actividadesCalendario: definir('actividadesCalendario', 'actividades_calendario'),
  actividadesAsistencia: definir('actividadesAsistencia'),
  actualizacionesDestacamentos: definir(
    'actualizacionesDestacamentos',
    'actualizaciones_destacamentos'
  ),
  administradores: definir('administradores', 'admins'),
  alergiasMiembros: definir('alergiasMiembros', 'alergias_miembros'),
  analiticasEncabezadoTienda: definir(
    'analiticasEncabezadoTienda',
    'analiticas_encabezado_tienda'
  ),
  anunciosPrincipal: definir('anunciosPrincipal', 'anuncios_principal'),
  asignacionesDirectiva: definir('asignacionesDirectiva'),
  asistencias: definir('asistencias'),
  amistades: definir('amistades'),
  auditoriaPermisos: definir('auditoriaPermisos', 'auditoria_permisos'),
  auditoriaSistema: definir('auditoriaSistema', 'auditoria_sistema'),
  // Lo escribe SOLO el servidor (Admin SDK): ver `src/server/auditoria-seguridad.js`.
  auditoriaSeguridad: definir('auditoriaSeguridad', 'auditoria_seguridad'),
  buzonesChat: definir('buzonesChat', 'buzones_chat'),
  cargosDirectiva: definir('cargosDirectiva'),
  carpetasAscenso: definir('carpetasAscenso'),
  carritos: definir('carritos'),
  casillasDirectivaPersonalizadas: definir(
    'casillasDirectivaPersonalizadas',
    'casillas_directiva_personalizadas'
  ),
  catalogoPaises: definir('catalogoPaises', 'catalogo_paises'),
  catalogoProvincias: definir('catalogoProvincias', 'catalogo_provincias'),
  categoriasProductoPersonalizadas: definir(
    'categoriasProductoPersonalizadas',
    'categorias_producto_personalizadas'
  ),
  certificados: definir('certificados', 'certificados', 'certificates'),
  registroChatSistema: definir('registroChatSistema', 'chat_sistema_registro'),
  cintasMiembros: definir('cintasMiembros', 'cintas_miembros'),
  combinacionesRoles: definir('combinacionesRoles', 'combinaciones_roles'),
  comentariosPublicaciones: definir('comentariosPublicaciones', 'comentarios_publicaciones'),
  compartidosPublicaciones: definir('compartidosPublicaciones', 'compartidos_publicaciones'),
  condicionesMedicasMiembros: definir(
    'condicionesMedicasMiembros',
    'condiciones_medicas_miembros'
  ),
  configuracionActualizacionesDestacamentos: definir(
    'configuracionActualizacionesDestacamentos',
    'configuracion_actualizaciones_destacamentos'
  ),
  configuracionCintas: definir('configuracionCintas', 'configuracion_cintas'),
  configuracionDesigner: definir('configuracionDesigner', 'configuracion_designer'),
  configuracionLandingRegistro: definir(
    'configuracionLandingRegistro',
    'configuracion_landing_registro'
  ),
  configuracionPremios: definir('configuracionPremios', 'configuracion_premios'),
  configuracionSonidos: definir('configuracionSonidos', 'configuracion_sonidos'),
  configuracionTienda: definir('configuracionTienda', 'configuracion_tienda'),
  contadoresComercio: definir('contadoresComercio', 'contadores_comercio'),
  conversacionesChat: definir('conversacionesChat', 'conversaciones_chat'),
  copiasLandingRegistro: definir('copiasLandingRegistro', 'landing_registro_copias'),
  direcciones: definir('direcciones'),
  directivasCuatrienios: definir('directivasCuatrienios', 'directiva_cuatrienios'),
  integrantesDirectivasCuatrienios: definir(
    'integrantesDirectivasCuatrienios',
    'directiva_cuatrienios_integrantes'
  ),
  historialOcupantesDirectiva: definir(
    'historialOcupantesDirectiva',
    'directiva_historial_ocupantes'
  ),
  miembrosPermanentesDirectivaNacional: definir(
    'miembrosPermanentesDirectivaNacional',
    'directiva_nacional_permanentes'
  ),
  directivasOrganizacionales: definir('directivasOrganizacionales'),
  disenosDirectiva: definir('disenosDirectiva'),
  documentosSaludMiembros: definir('documentosSaludMiembros', 'documentos_salud_miembros'),
  estadoDestacamentos: definir('estadoDestacamentos', 'estado_destacamentos'),
  estadosCertificadosMiembros: definir(
    'estadosCertificadosMiembros',
    'estadosCertificadosMiembros',
    'certificateMemberStatuses'
  ),
  estatusMiembros: definir('estatusMiembros', 'estatus_miembros'),
  evaluacionesDestacamentos: definir('evaluacionesDestacamentos', 'evaluaciones_destacamentos'),
  designerAnaliticas: definir('designerAnaliticas', 'everest_analiticas'),
  designerBorradores: definir('designerBorradores', 'everest_borradores'),
  designerPublicado: definir('designerPublicado', 'everest_publicado'),
  designerVersiones: definir('designerVersiones', 'everest_versiones'),
  favoritosProductos: definir('favoritosProductos', 'favoritos_productos'),
  favoritosAscensoMiembros: definir('favoritosAscensoMiembros'),
  fotos: definir('fotos'),
  fotosPortada: definir('fotosPortada', 'cover_photos'),
  galeriaDirectoresNacionales: definir(
    'galeriaDirectoresNacionales',
    'galeria_directores_nacionales'
  ),
  galeriaUsuarios: definir('galeriaUsuarios', 'galeria_usuarios'),
  gestorArchivos: definir('gestorArchivos'),
  historialMiembros: definir('historialMiembros'),
  indiceBuscador: definir('indiceBuscador', 'indice_buscador'),
  informacionMedicaBasicaMiembros: definir(
    'informacionMedicaBasicaMiembros',
    'informacion_medica_basica_miembros'
  ),
  insigniasPersonalizadas: definir('insigniasPersonalizadas', 'insignias_personalizadas'),
  itemsAscenso: definir('itemsAscenso'),
  licenciasAsistencia: definir('licenciasAsistencia'),
  lotesCertificados: definir('lotesCertificados', 'lotesCertificados', 'certificateBatches'),
  medallasMiembros: definir('medallasMiembros', 'medallas_miembros'),
  medicamentosMiembros: definir('medicamentosMiembros', 'medicamentos_miembros'),
  mensajes: definir('mensajes'),
  metadatosPrivadosPublicaciones: definir(
    'metadatosPrivadosPublicaciones',
    'metadatos_privados_publicaciones'
  ),
  ajustesMiembros: definir('ajustesMiembros', 'miembros_overrides'),
  movimientosInventario: definir('movimientosInventario', 'movimientos_inventario'),
  notasTutoresMiembros: definir('notasTutoresMiembros', 'notas_tutores_miembros'),
  notificaciones: definir('notificaciones'),
  ordenes: definir('ordenes'),
  organigramaDirectivaDestacamentos: definir(
    'organigramaDirectivaDestacamentos',
    'organigrama_directiva_destacamentos'
  ),
  permisos: definir('permisos'),
  pinesMiembros: definir('pinesMiembros', 'pines_miembros'),
  plantillasCertificados: definir(
    'plantillasCertificados',
    'plantillasCertificados',
    'certificateTemplates'
  ),
  plantillasNotificaciones: definir('plantillasNotificaciones', 'plantillas_notificaciones'),
  posicionesDirectiva: definir('posicionesDirectiva'),
  preferenciasNotificaciones: definir(
    'preferenciasNotificaciones',
    'preferencias_notificaciones'
  ),
  preferenciasUsuarios: definir('preferenciasUsuarios', 'preferencias_usuarios'),
  premiosPersonalizados: definir('premiosPersonalizados', 'premios_personalizados'),
  presenciaChat: definir('presenciaChat', 'presencia_chat'),
  productos: definir('productos'),
  progresoAscensoMiembros: definir('progresoAscensoMiembros'),
  publicaciones: definir('publicaciones'),
  publicacionesOcultas: definir('publicacionesOcultas', 'publicaciones_ocultas'),
  reaccionesPublicaciones: definir('reaccionesPublicaciones', 'reacciones_publicaciones'),
  recibos: definir('recibos'),
  registrosAsistencia: definir('registrosAsistencia'),
  reportesProblemas: definir('reportesProblemas', 'reportes_problemas'),
  reportesPublicaciones: definir('reportesPublicaciones', 'reportes_publicaciones'),
  resenasProductos: definir('resenasProductos', 'resenas_productos'),
  reservasCodigosProductos: definir('reservasCodigosProductos', 'reservas_codigos_productos'),
  respaldosAdministracion: definir('respaldosAdministracion', 'respaldos_admin'),
  roles: definir('roles'),
  saludSistema: definir('saludSistema', 'salud_sistema'),
  revisionesSaludSistema: definir('revisionesSaludSistema', 'salud_sistema_revisiones'),
  secretosAcceso: definir('secretosAcceso', 'secretos_acceso'),
  seguidores: definir('seguidores'),
  seccionesNombres: definir('seccionesNombres'),
  sendaInstructorMiembros: definir('sendaInstructorMiembros', 'senda_instructor_miembros'),
  solicitudesAccesoDispensaMedica: definir(
    'solicitudesAccesoDispensaMedica',
    'solicitudes_acceso_dispensa_medica'
  ),
  solicitudesAmistad: definir('solicitudesAmistad', 'solicitudes_amistad'),
  solicitudesCambio: definir('solicitudesCambio', 'solicitudes_cambio'),
  solicitudesCambioEstadoAscenso: definir(
    'solicitudesCambioEstadoAscenso',
    'solicitudes_cambio_estado_ascenso'
  ),
  solicitudesCambioMiembro: definir('solicitudesCambioMiembro', 'solicitudes_cambio_miembro'),
  solicitudesPermiso: definir('solicitudesPermiso', 'solicitudes_permiso'),
  tareasNotificaciones: definir('tareasNotificaciones', 'tareas_notificaciones'),
  tarjetasDesarrollo: definir('tarjetasDesarrollo', 'tarjetas_desarrollo'),
  tiposNotificaciones: definir('tiposNotificaciones', 'tipos_notificaciones'),
  titulosOficialesNacionales: definir(
    'titulosOficialesNacionales',
    'titulos_oficiales_nacionales'
  ),
  ultimasAsistenciasMiembros: definir('ultimasAsistenciasMiembros'),
  usuarios: definir('usuarios', 'users'),
  usuariosRoles: definir('usuariosRoles', 'usuarios_roles'),
  versionesLecturas: definir('versionesLecturas', 'versiones_lecturas'),
  vinculosCertificadosAscenso: definir('vinculosCertificadosAscenso'),
  suscripcionesWebPush: definir('suscripcionesWebPush', 'web_push_subscriptions'),
});

const versionSolicitada =
  typeof process === 'undefined'
    ? 'heredado'
    : process.env.NEXT_PUBLIC_ESQUEMA_FIRESTORE_VERSION ||
      process.env.ESQUEMA_FIRESTORE_VERSION ||
      'heredado';

export const VERSION_ESQUEMA_FIRESTORE =
  versionSolicitada === 'canonico' ? 'canonico' : 'heredado';

export const nombreColeccion = (clave, version = VERSION_ESQUEMA_FIRESTORE) => {
  const definicion = DEFINICIONES_COLECCIONES[clave];
  if (!definicion) throw new Error(`Coleccion Firestore no registrada: ${clave}`);
  return version === 'canonico' ? definicion.canonico : definicion.heredados[0];
};

export const COLECCIONES = Object.freeze(
  Object.fromEntries(
    Object.keys(DEFINICIONES_COLECCIONES).map((clave) => [clave, nombreColeccion(clave)])
  )
);

export const obtenerPlanMigracionColecciones = () =>
  Object.entries(DEFINICIONES_COLECCIONES).flatMap(([clave, definicion]) =>
    definicion.heredados
      .filter((origen) => origen !== definicion.canonico)
      .map((origen) => ({ clave, origen, destino: definicion.canonico }))
  );

