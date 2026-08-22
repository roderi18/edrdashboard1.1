import { canManageDirectiva } from 'src/utils/admin-role-label';
import {
  canEditDest,
  isAdminGlobal,
  canEditRegional,
  canEditSectional,
  canDeleteOrgLevel,
  puedeEntrarAAdministracion,
  puedeAprobarCambiosDeOrganizacion,
} from 'src/utils/org-level-access';
import {
  canEditAwards,
  canViewAwards,
  canEditHealth,
  canViewHealth,
  canEditMembers,
  isGroupLeaderRole,
  esMiembroDeSuAlcance,
  canAccessMinorMembers,
  canMemberManageMembers,
  canApproveMemberChanges,
  canUploadHealthDocuments,
  canViewMemberSensitiveData,
  canViewMemberContactDataByAge,
  canViewMemberBirthdateWhenMasked,
  puedeVerMiembrosDeTodaLaOrganizacion,
} from 'src/utils/member-access';

import { PESO_NIVEL, NIVEL_COMBINACION } from 'src/catalogs/combinaciones-roles';

import { ROLES } from 'src/auth/permissions/roles';
import { PERMISOS } from 'src/auth/permissions/permissions';
import { can, isReadOnlyRole, puedeModificar } from 'src/auth/permissions/can';
import { PERMISOS_POR_ROL, RESTRICCIONES_ROL } from 'src/auth/permissions/role-permissions';

// ----------------------------------------------------------------------
// Simulador de permisos.
//
// Arma una sesion como la que armaria la aplicacion para una persona con esos
// cargos, y le hace a las MISMAS funciones que usan las pantallas las mismas
// preguntas: ¿puede ver esta ficha?, ¿puede editarla?, ¿tiene que pedirlo?
//
// Esto es lo que hace que el simulador no pueda mentir: no describe lo que
// deberia pasar, ejecuta lo que pasa. Si mañana cambia una regla, cambia aqui
// tambien, sin tocar este fichero.
// ----------------------------------------------------------------------

// Entidades de referencia. Los ids no importan mientras sean distintos: lo que
// se prueba es "el suyo" contra "el de otro".
export const CONTEXTO = {
  destacamentoPropio: '231',
  destacamentoAjeno: '233',
  seccionPropia: '1',
  regionPropia: '1',
};

// Las entidades tal y como llegan de la base de datos: con su seccion y su
// region. Sin esos ids, un cargo seccional no reconoceria su propio destacamento
// y el simulador diria que no puede editarlo, que es falso.
export const ENTIDADES = {
  destacamentoPropio: {
    id: CONTEXTO.destacamentoPropio,
    idDestacamento: CONTEXTO.destacamentoPropio,
    sectionalId: CONTEXTO.seccionPropia,
    regionalId: CONTEXTO.regionPropia,
  },
  seccionPropia: {
    id: CONTEXTO.seccionPropia,
    idSeccion: CONTEXTO.seccionPropia,
    regionalId: CONTEXTO.regionPropia,
  },
};

const miembro = ({ id, destacamento, edad }) => ({
  id,
  idMiembros: Number(id),
  idDestacamento: destacamento,
  destId: destacamento,
  firstName: 'Miembro',
  lastName: 'de prueba',
  birthdate: new Date(new Date().getFullYear() - edad, 0, 1).toISOString(),
});

export const FICHAS = {
  propioAdulto: miembro({ id: '901', destacamento: CONTEXTO.destacamentoPropio, edad: 30 }),
  propioMenor: miembro({ id: '902', destacamento: CONTEXTO.destacamentoPropio, edad: 12 }),
  ajenoAdulto: miembro({ id: '903', destacamento: CONTEXTO.destacamentoAjeno, edad: 30 }),
};

/**
 * Sesion equivalente a la de alguien con esos cargos.
 *
 * Reproduce lo que hacen `aplicarRolPorCargo` y `buildMemberSessionUser`: rol
 * principal el de mayor nivel, permisos y alcance sumados, y solo lectura solo
 * si TODOS sus cargos lo son.
 */
export const construirUsuarioSimulado = (roles = []) => {
  const activos = roles.filter(Boolean);

  if (!activos.length) return null;

  const principal = [...activos].sort(
    (a, b) => (PESO_NIVEL[b.nivel] ?? 0) - (PESO_NIVEL[a.nivel] ?? 0)
  )[0];

  const permisosRol = [
    ...new Set(activos.flatMap((rol) => PERMISOS_POR_ROL[rol.codigo] ?? [])),
  ];
  const soloLectura = activos.every(
    (rol) => RESTRICCIONES_ROL[rol.codigo]?.soloLectura === true
  );

  const entidadDe = (nivel) =>
    ({
      [NIVEL_COMBINACION.destacamento]: CONTEXTO.destacamentoPropio,
      [NIVEL_COMBINACION.seccion]: CONTEXTO.seccionPropia,
      [NIVEL_COMBINACION.region]: CONTEXTO.regionPropia,
    })[nivel] ?? '';

  return {
    role: 'member',
    uid: 'simulacion',
    idMiembros: 900,
    memberId: 'EDR-00900',
    codigoMiembro: 'EDR-00900',
    idDestacamento: CONTEXTO.destacamentoPropio,
    rolId: principal.codigo,
    memberRole: principal.codigo,
    rol: 'miembro',
    // Usuario Comun no ocupa ninguna casilla de directiva: es lo que se es
    // cuando no se tiene cargo. Meterlo aqui haria creer a la aplicacion que
    // esa persona ejerce algo, que es justo lo contrario.
    cargos: activos
      .filter((rol) => rol.codigo !== ROLES.USUARIO_COMUN)
      .map((rol) => ({
        rol: rol.codigo,
        nivel: rol.nivel,
        idEntidad: entidadDe(rol.nivel),
        nombreCargo: rol.nombre,
      })),
    permisosRol,
    permisos: {},
    restricciones: { soloLectura },
    alcance: {
      modo: principal.alcance,
      tipo: principal.alcance,
      destacamentos: activos.some((rol) => rol.nivel === NIVEL_COMBINACION.destacamento)
        ? [CONTEXTO.destacamentoPropio]
        : [],
      secciones: activos.some((rol) => rol.nivel === NIVEL_COMBINACION.seccion)
        ? [CONTEXTO.seccionPropia]
        : [],
      regiones: activos.some((rol) => rol.nivel === NIVEL_COMBINACION.region)
        ? [CONTEXTO.regionPropia]
        : [],
    },
  };
};

// --- resultados ---

export const RESULTADO = {
  si: 'si',
  no: 'no',
  aprobacion: 'aprobacion',
  oculto: 'oculto',
};

const si = (valor) => (valor ? RESULTADO.si : RESULTADO.no);

// Lo que de verdad pregunta la pantalla de edicion antes de dejar tocar una
// ficha. Se junta aqui para que la matriz no pueda contestar por una condicion
// parcial: si la pantalla exige tres cosas, la matriz exige las tres.
const puedeGestionar = (user) => canMemberManageMembers(user) && canEditMembers(user);

/**
 * Las preguntas que se le hacen a cada combinacion.
 *
 * `evaluar` devuelve uno de los cuatro resultados; `solicitaA` solo aparece
 * cuando el resultado es "aprobacion", y dice a quien.
 */
export const CAPACIDADES = [
  // --- Miembros de su destacamento ---
  {
    id: 'miembros.ver.propio',
    area: 'Miembros de su destacamento',
    etiqueta: 'Ver la lista de miembros',
    evaluar: (user) => si(can(user, PERMISOS.MIEMBROS_VER_ADULTOS)),
  },
  {
    id: 'miembros.editar.propio',
    area: 'Miembros de su destacamento',
    etiqueta: 'Editar la ficha',
    evaluar: (user) => {
      // La MISMA condicion que calcula la pantalla de edicion, entera. Antes
      // aqui faltaba `canMemberManageMembers`, y por ese hueco se colo que
      // ninguna sesion de miembro podia editar la ficha de nadie.
      if (!puedeGestionar(user) || !esMiembroDeSuAlcance(user, FICHAS.propioAdulto)) {
        return RESULTADO.no;
      }

      // Los lideres de grupo editan, pero lo suyo va a aprobacion de los
      // Coordinadores de Destacamento.
      return isGroupLeaderRole(user) ? RESULTADO.aprobacion : RESULTADO.si;
    },
    solicitaA: 'Coordinador de Destacamento y su Asistente',
  },
  {
    id: 'miembros.general.completa',
    area: 'Miembros de su destacamento',
    etiqueta: 'Ver su ficha General entera, sin asteriscos',
    // Se calcula igual que la ficha: `maskSensitive` y `maskBirthdate` juntos.
    // Es la pregunta de verdad —"¿la veo completa o con asteriscos?"— y la que
    // se rompia al recibir un cargo en la seccion.
    evaluar: (user) => {
      if (!esMiembroDeSuAlcance(user, FICHAS.propioAdulto)) return RESULTADO.oculto;
      if (!canViewMemberSensitiveData(user)) return RESULTADO.oculto;

      return RESULTADO.si;
    },
  },
  {
    id: 'miembros.datos_sensibles',
    area: 'Miembros de su destacamento',
    etiqueta: 'Ver su dirección y sus datos sensibles',
    evaluar: (user) =>
      esMiembroDeSuAlcance(user, FICHAS.propioAdulto) && canViewMemberSensitiveData(user)
        ? RESULTADO.si
        : RESULTADO.oculto,
  },
  {
    id: 'miembros.nacimiento',
    area: 'Miembros de su destacamento',
    etiqueta: 'Ver su fecha de nacimiento',
    evaluar: (user) => {
      if (!esMiembroDeSuAlcance(user, FICHAS.propioAdulto)) return RESULTADO.oculto;
      if (canViewMemberSensitiveData(user)) return RESULTADO.si;

      // El enmascarado tiene dos escapes: los cargos que la necesitan para saber
      // la division del miembro, y los seccionales/regionales sobre adultos.
      return canViewMemberBirthdateWhenMasked(user) ||
        canViewMemberContactDataByAge(user, FICHAS.propioAdulto)
        ? RESULTADO.si
        : RESULTADO.oculto;
    },
  },
  {
    id: 'miembros.menores',
    area: 'Miembros de su destacamento',
    etiqueta: 'Abrir la ficha de un menor',
    evaluar: (user) => (canAccessMinorMembers(user) ? RESULTADO.si : RESULTADO.oculto),
  },
  {
    id: 'miembros.contacto_menor',
    area: 'Miembros de su destacamento',
    etiqueta: 'Ver el contacto de un menor',
    evaluar: (user) =>
      canViewMemberContactDataByAge(user, FICHAS.propioMenor) || canViewMemberSensitiveData(user)
        ? RESULTADO.si
        : RESULTADO.oculto,
  },
  {
    id: 'miembros.foto',
    area: 'Miembros de su destacamento',
    etiqueta: 'Subir su foto',
    evaluar: (user) => si(puedeModificar(user, PERMISOS.MIEMBROS_SUBIR_FOTO)),
  },
  {
    id: 'miembros.eliminar',
    area: 'Miembros de su destacamento',
    etiqueta: 'Eliminar un miembro',
    evaluar: (user) => si(puedeModificar(user, PERMISOS.MIEMBROS_ELIMINAR)),
  },
  {
    id: 'miembros.aprobar',
    area: 'Miembros de su destacamento',
    etiqueta: 'Aprobar cambios de otros',
    evaluar: (user) => si(canApproveMemberChanges(user)),
  },

  // --- Miembros de OTRO destacamento ---
  {
    id: 'miembros.ver.ajeno',
    area: 'Miembros de otro destacamento',
    etiqueta: 'Verlos en la lista',
    evaluar: (user) =>
      puedeVerMiembrosDeTodaLaOrganizacion(user) ? RESULTADO.si : RESULTADO.oculto,
  },
  {
    id: 'miembros.editar.ajeno',
    area: 'Miembros de otro destacamento',
    etiqueta: 'Editar su ficha',
    evaluar: (user) => si(puedeGestionar(user) && esMiembroDeSuAlcance(user, FICHAS.ajenoAdulto)),
  },
  {
    id: 'miembros.datos.ajeno',
    area: 'Miembros de otro destacamento',
    etiqueta: 'Ver su fecha de nacimiento y dirección',
    evaluar: (user) =>
      esMiembroDeSuAlcance(user, FICHAS.ajenoAdulto) && canViewMemberSensitiveData(user)
        ? RESULTADO.si
        : RESULTADO.oculto,
  },

  // --- Dispensa Médica ---
  {
    id: 'salud.ver',
    area: 'Dispensa Médica',
    etiqueta: 'Ver la dispensa de los suyos',
    evaluar: (user) => (canViewHealth(user) ? RESULTADO.si : RESULTADO.oculto),
  },
  {
    id: 'salud.editar',
    area: 'Dispensa Médica',
    etiqueta: 'Editarla',
    evaluar: (user) => {
      if (!canEditHealth(user) || !esMiembroDeSuAlcance(user, FICHAS.propioAdulto)) {
        return RESULTADO.no;
      }

      return isGroupLeaderRole(user) ? RESULTADO.aprobacion : RESULTADO.si;
    },
    solicitaA: 'Coordinador de Destacamento y su Asistente',
  },
  {
    id: 'salud.menores',
    area: 'Dispensa Médica',
    etiqueta: 'Ver la de un menor',
    evaluar: (user) => {
      if (!canViewHealth(user)) return RESULTADO.oculto;

      // Los cargos de supervision y quien no puede autorizar entran por el
      // acceso temporal, que concede un Coordinador de Destacamento.
      return canApproveMemberChanges(user) || isGroupLeaderRole(user)
        ? RESULTADO.si
        : RESULTADO.aprobacion;
    },
    solicitaA: 'Coordinador de Destacamento (acceso temporal)',
  },
  {
    id: 'salud.documentos',
    area: 'Dispensa Médica',
    etiqueta: 'Subir documentos médicos',
    evaluar: (user) => si(canUploadHealthDocuments(user)),
  },

  // --- Sistema de Ascenso ---
  {
    id: 'ascenso.ver',
    area: 'Sistema de Ascenso',
    etiqueta: 'Ver el ascenso de los suyos',
    evaluar: (user) => (canViewAwards(user) ? RESULTADO.si : RESULTADO.oculto),
  },
  {
    id: 'ascenso.editar',
    area: 'Sistema de Ascenso',
    etiqueta: 'Editarlo y subir certificados',
    evaluar: (user) =>
      si(canEditAwards(user) && esMiembroDeSuAlcance(user, FICHAS.propioAdulto)),
  },
  {
    id: 'ascenso.editar.ajeno',
    area: 'Sistema de Ascenso',
    etiqueta: 'Editar el de otro destacamento',
    evaluar: (user) =>
      si(canEditAwards(user) && esMiembroDeSuAlcance(user, FICHAS.ajenoAdulto)),
  },

  // --- Estructura ---
  {
    id: 'estructura.dest.editar',
    area: 'Estructura',
    etiqueta: 'Editar su destacamento',
    evaluar: (user) => {
      if (!canEditDest(user, ENTIDADES.destacamentoPropio)) return RESULTADO.no;

      return puedeAprobarCambiosDeOrganizacion(user) ? RESULTADO.si : RESULTADO.aprobacion;
    },
    solicitaA: 'Oficina Nacional',
  },
  {
    id: 'estructura.seccion.editar',
    area: 'Estructura',
    etiqueta: 'Editar su sección',
    evaluar: (user) => {
      if (!canEditSectional(user, ENTIDADES.seccionPropia)) return RESULTADO.no;

      return puedeAprobarCambiosDeOrganizacion(user) ? RESULTADO.si : RESULTADO.aprobacion;
    },
    solicitaA: 'Oficina Nacional',
  },
  {
    id: 'estructura.region.editar',
    area: 'Estructura',
    etiqueta: 'Editar su región',
    evaluar: (user) => {
      if (!canEditRegional(user)) return RESULTADO.no;

      return puedeAprobarCambiosDeOrganizacion(user) ? RESULTADO.si : RESULTADO.aprobacion;
    },
    solicitaA: 'Oficina Nacional',
  },
  {
    id: 'estructura.eliminar',
    area: 'Estructura',
    etiqueta: 'Eliminar destacamentos, secciones o regiones',
    evaluar: (user) => si(canDeleteOrgLevel(user)),
  },
  {
    id: 'estructura.directiva',
    area: 'Estructura',
    etiqueta: 'Componer las directivas (organigrama)',
    evaluar: (user) => si(canManageDirectiva(user)),
  },

  // --- Gobierno ---
  {
    id: 'gobierno.administracion',
    area: 'Gobierno',
    etiqueta: 'Entrar al área de Administración',
    evaluar: (user) => si(puedeEntrarAAdministracion(user)),
  },
  {
    id: 'gobierno.aprobar_organizacion',
    area: 'Gobierno',
    etiqueta: 'Aprobar cambios de la organización',
    evaluar: (user) => si(puedeAprobarCambiosDeOrganizacion(user)),
  },
  {
    id: 'gobierno.solo_lectura',
    area: 'Gobierno',
    etiqueta: 'Queda en solo lectura',
    // Aqui un "Si" es una atadura, no un poder: perderla no es una perdida, asi
    // que esta fila no cuenta para el detector de choques.
    esRestriccion: true,
    evaluar: (user) => si(isReadOnlyRole(user)),
  },
];

export const AREAS = [...new Set(CAPACIDADES.map((capacidad) => capacidad.area))];

/** Evalua una lista de roles y devuelve el resultado de cada pregunta. */
export const evaluarRoles = (roles = []) => {
  const user = construirUsuarioSimulado(roles);

  if (!user) return {};

  return Object.fromEntries(
    CAPACIDADES.map((capacidad) => [capacidad.id, capacidad.evaluar(user)])
  );
};

const ORDEN_RESULTADO = {
  [RESULTADO.no]: 0,
  [RESULTADO.oculto]: 0,
  [RESULTADO.aprobacion]: 1,
  [RESULTADO.si]: 2,
};

/**
 * Lo que hay que mirar de una combinacion.
 *
 * Un choque no es "los dos roles dicen cosas distintas" —eso es lo normal— sino
 * que la combinacion acabe pudiendo MENOS que uno de sus roles por separado: eso
 * significa que el rol principal esta tapando al otro, y casi siempre es un
 * descuido.
 */
export const analizarCombinacion = ({ destacamento, acompanante }) => {
  const combinado = evaluarRoles([destacamento, acompanante]);
  const soloDestacamento = evaluarRoles([destacamento]);
  const soloAcompanante = evaluarRoles([acompanante]);

  const avisos = CAPACIDADES.filter((capacidad) => !capacidad.esRestriccion).map((capacidad) => {
    const juntos = ORDEN_RESULTADO[combinado[capacidad.id]] ?? 0;
    const porSeparado = Math.max(
      ORDEN_RESULTADO[soloDestacamento[capacidad.id]] ?? 0,
      ORDEN_RESULTADO[soloAcompanante[capacidad.id]] ?? 0
    );

    if (juntos >= porSeparado) return null;

    const dueno =
      (ORDEN_RESULTADO[soloDestacamento[capacidad.id]] ?? 0) > juntos
        ? destacamento
        : acompanante;

    return {
      capacidad: capacidad.id,
      etiqueta: capacidad.etiqueta,
      area: capacidad.area,
      pierde: dueno.nombre,
      resultadoSolo: dueno === destacamento
        ? soloDestacamento[capacidad.id]
        : soloAcompanante[capacidad.id],
      resultadoCombinado: combinado[capacidad.id],
    };
  }).filter(Boolean);

  // Lo contrario, y igual de importante: algo que la combinacion permite y que
  // NINGUNO de los dos cargos permitia por separado. Un permiso que aparece de
  // la nada no viene de sumar: viene de un descuido.
  const ganancias = CAPACIDADES.filter((capacidad) => !capacidad.esRestriccion)
    .map((capacidad) => {
      const juntos = ORDEN_RESULTADO[combinado[capacidad.id]] ?? 0;
      const porSeparado = Math.max(
        ORDEN_RESULTADO[soloDestacamento[capacidad.id]] ?? 0,
        ORDEN_RESULTADO[soloAcompanante[capacidad.id]] ?? 0
      );

      if (juntos <= porSeparado) return null;

      return {
        capacidad: capacidad.id,
        etiqueta: capacidad.etiqueta,
        area: capacidad.area,
        resultadoCombinado: combinado[capacidad.id],
      };
    })
    .filter(Boolean);

  return { combinado, soloDestacamento, soloAcompanante, avisos, ganancias };
};

export const esRolDeTienda = (codigo) => codigo === ROLES.ADMINISTRADOR_TIENDA;

export const esAdministrativo = (user) => isAdminGlobal(user);
