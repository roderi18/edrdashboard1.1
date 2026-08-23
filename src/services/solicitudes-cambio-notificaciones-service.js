import { doc, query, where, getDoc, getDocs, collection } from 'firebase/firestore';

import { FIRESTORE } from 'src/lib/firebase';

import { crearNotificacionAdmin, crearNotificacionUsuario } from './notification-service';
import {
  CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO,
  obtenerAsignacionesOrganigramaPorDestacamento,
} from './organigrama-directiva-destacamentos-service';

// ----------------------------------------------------------------------
// Notificaciones del flujo de solicitud de cambio de miembro. Se comparte entre
// el formulario General (member-create-edit-form) y el de Dispensa Médica
// (member-edit-health-form) para avisar a los Coordinadores de Destacamento.
// ----------------------------------------------------------------------

// Resuelve los ids con los que se puede direccionar a un miembro (por su
// idMiembros): uid de su cuenta, idUsuario, id del documento y codigoMiembro. El
// panel de notificaciones filtra por `uid` del usuario, por eso hay que incluir
// el uid real del coordinador y no solo su idMiembros.
export const resolverDestinatariosPorIdMiembros = async (idMiembros) => {
  const ids = new Set();
  const agregarDesdeData = (documento) => {
    const data = documento.data() || {};
    [data.uid, data.idUsuario, documento.id, data.codigoMiembro]
      .filter(Boolean)
      .forEach((valor) => ids.add(String(valor)));
  };

  await Promise.all([
    ...['usuarios_roles', 'users'].map(async (coleccion) => {
      const snapshot = await getDocs(
        query(collection(FIRESTORE, coleccion), where('idMiembros', '==', Number(idMiembros)))
      ).catch(() => null);

      snapshot?.docs?.forEach(agregarDesdeData);
    }),
    (async () => {
      const directo = await getDoc(
        doc(FIRESTORE, 'usuarios_roles', String(idMiembros))
      ).catch(() => null);

      if (directo?.exists()) {
        agregarDesdeData(directo);
      }
    })(),
  ]);

  return [...ids];
};

// Coordinadores (titular y asistente) del destacamento, a partir de su directiva.
const obtenerCoordinadoresDestacamento = async (destacamentoId) => {
  const asignaciones = await obtenerAsignacionesOrganigramaPorDestacamento(destacamentoId);
  const cargosCoordinacion = [
    CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorDestacamento,
    CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorAsistenteDestacamento,
  ];

  return asignaciones.filter((asignacion) => cargosCoordinacion.includes(asignacion.cargo));
};

/**
 * Los ids de acceso de varios coordinadores, en una sola lista.
 *
 * Antes se creaba UNA notificacion por coordinador, y el id del documento se
 * componia con el miembro y la hora en milisegundos: como los dos avisos salen a
 * la vez, caian en el mismo id y el segundo pisaba al primero. Solo llegaba a
 * uno. Una notificacion con los dos en `idsDestinatarios` es lo que la coleccion
 * espera y no puede pisarse a si misma.
 */
const idsDeCoordinadores = async (asignaciones = []) => {
  const listas = await Promise.all(
    asignaciones.map(async (asignacion) => ({
      idMiembros: asignacion.idMiembros,
      ids: await resolverDestinatariosPorIdMiembros(asignacion.idMiembros),
    }))
  );

  listas
    .filter(({ ids }) => !ids.length)
    .forEach(({ idMiembros }) =>
      console.warn('[solicitudes cambio] coordinador sin cuenta de usuario para notificar', idMiembros)
    );

  return {
    ids: [...new Set(listas.flatMap(({ ids }) => ids))],
    alcanzados: listas.filter(({ ids }) => ids.length).length,
  };
};

// Notifica a los Coordinadores (titular y asistente) del destacamento del miembro
// que hay una solicitud de cambio para revisar. Devuelve la cantidad de
// notificaciones enviadas. `onInfo` recibe mensajes informativos (p. ej. cuando
// no hay coordinador asignado) para que la vista los muestre con su propio toast.
export const notificarCoordinadoresCambioMiembro = async ({
  currentMember,
  nombreMiembro,
  nombreSolicitante,
  actorId,
  ruta,
  onInfo,
} = {}) => {
  const destacamentoId = Number(currentMember?.destId || currentMember?.idDestacamento) || null;

  if (!destacamentoId) {
    onInfo?.('No se pudo identificar el destacamento del miembro.');
    return 0;
  }

  const destinatarios = await obtenerCoordinadoresDestacamento(destacamentoId);

  if (!destinatarios.length) {
    onInfo?.('Este destacamento aún no tiene coordinador asignado en la directiva.');
    return 0;
  }

  const nombreMiembroFinal = nombreMiembro || currentMember?.memberId || 'un miembro';
  const nombreSolicitanteFinal = nombreSolicitante || 'Un líder de grupo';

  const { ids, alcanzados } = await idsDeCoordinadores(destinatarios);

  if (!ids.length) return 0;

  // El coordinador de destacamento es una sesion de administrador, por lo que
  // la notificacion debe crearse como "admin".
  const resultado = await crearNotificacionAdmin({
    tipoNotificacion: 'solicitud_cambio_miembro',
    modulo: 'miembros',
    titulo: 'Solicitud de cambio de miembro',
    mensaje: `${nombreSolicitanteFinal} solicita aprobar cambios en ${nombreMiembroFinal}.`,
    prioridad: 'informativa',
    entidadTipo: 'miembro',
    entidadId: String(currentMember?.id || ''),
    ruta:
      ruta ||
      (currentMember?.id ? `/dashboard/level/member/${currentMember.id}/edit` : '/dashboard'),
    etiquetaAccion: 'Revisar',
    actorId: actorId || 'sistema',
    actorNombre: nombreSolicitanteFinal,
    idsDestinatariosPrecalculados: ids,
  });

  return resultado ? alcanzados : 0;
};

// Aviso informativo entre Coordinadores: cuando un Coordinador (titular o
// asistente) hace un cambio DIRECTO (General o Dispensa Médica), se notifica al
// OTRO coordinador. Nunca se notifica al que hizo el cambio. `actorIdMiembros`
// identifica al actor para excluirlo.
export const notificarCoordinadoresActualizacionDirecta = async ({
  member,
  actorId,
  actorIdMiembros,
  actorNombre,
  moduloTexto,
  ruta,
} = {}) => {
  const destacamentoId = Number(member?.destId || member?.idDestacamento) || null;

  if (!destacamentoId) {
    return 0;
  }

  const coordinadores = await obtenerCoordinadoresDestacamento(destacamentoId);

  if (!coordinadores.length) {
    return 0;
  }

  const nombreMiembro =
    member?.nombreMiembro ||
    [member?.firstName || member?.nombres, member?.lastName || member?.apellidos]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    member?.memberId ||
    member?.codigoMiembro ||
    'un miembro';
  const nombreActor = actorNombre || 'Un coordinador';
  const moduloFinal = moduloTexto || 'la información';

  let enviadas = 0;

  await Promise.all(
    coordinadores.map(async (asignacion) => {
      if (
        actorIdMiembros !== null &&
        actorIdMiembros !== undefined &&
        String(asignacion.idMiembros) === String(actorIdMiembros)
      ) {
        return;
      }

      const idsDestinatarios = await resolverDestinatariosPorIdMiembros(asignacion.idMiembros);

      if (!idsDestinatarios.length) {
        return;
      }

      const resultado = await crearNotificacionAdmin({
        tipoNotificacion: 'actualizacion_directa_miembro',
        modulo: 'miembros',
        titulo: 'Actualización de miembro',
        mensaje: `${nombreActor} actualizó ${moduloFinal} de ${nombreMiembro}.`,
        prioridad: 'informativa',
        entidadTipo: 'miembro',
        entidadId: String(member?.id || member?.idMiembros || ''),
        ruta: ruta || '/dashboard',
        etiquetaAccion: 'Ver',
        actorId: actorId || 'sistema',
        actorNombre: nombreActor,
        idsDestinatariosPrecalculados: idsDestinatarios,
      });

      if (resultado) enviadas += 1;
    })
  );

  return enviadas;
};

// Notifica todo cambio efectivo de estado en el Sistema de Ascenso a ambos
// Coordinadores de Destacamento, incluido el actor cuando sea uno de ellos.
export const notificarCambioEstadoSistemaAscenso = async ({
  member,
  actorId,
  actorNombre,
  itemNombre,
  estadoAnterior,
  estadoNuevo,
  ruta,
} = {}) => {
  const destacamentoId = Number(member?.destId || member?.idDestacamento) || null;
  if (!destacamentoId) return 0;

  const coordinadores = await obtenerCoordinadoresDestacamento(destacamentoId);
  const nombreMiembro =
    member?.nombreMiembro ||
    [member?.firstName || member?.nombres, member?.lastName || member?.apellidos]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    member?.memberId ||
    'un miembro';
  const nombreActor = actorNombre || 'Un usuario';
  const estados = {
    no_iniciado: 'No iniciado',
    en_progreso: 'En progreso',
    completado: 'Completado',
  };
  let enviadas = 0;

  await Promise.all(
    coordinadores.map(async (coordinador) => {
      const ids = await resolverDestinatariosPorIdMiembros(coordinador.idMiembros);
      if (!ids.length) return;

      const resultado = await crearNotificacionAdmin({
        tipoNotificacion: 'cambio_estado_sistema_ascenso',
        modulo: 'miembros',
        titulo: 'Estado actualizado en Sistema de Ascenso',
        mensaje: `${nombreActor} cambió "${itemNombre || 'un elemento'}" de ${estados[estadoAnterior] || estadoAnterior || 'Sin estado'} a ${estados[estadoNuevo] || estadoNuevo} para ${nombreMiembro}.`,
        prioridad: 'informativa',
        entidadTipo: 'miembro',
        entidadId: String(member?.id || member?.idMiembros || ''),
        ruta: ruta || '/dashboard',
        etiquetaAccion: 'Ver Sistema de Ascenso',
        actorId: actorId || 'sistema',
        actorNombre: nombreActor,
        idsDestinatariosPrecalculados: ids,
      });

      if (resultado) enviadas += 1;
    })
  );

  return enviadas;
};

// Notifica —de forma informativa— a los Coordinadores (titular y asistente) del
// destacamento del miembro que alguien AGREGÓ algo en el Sistema de Ascenso:
// quién lo agregó, qué ítem, y a qué miembro. No es un flujo de aprobación, solo
// un aviso. Se excluye al propio actor si él es uno de los coordinadores (para no
// auto-notificarse). Devuelve la cantidad de notificaciones enviadas.
export const notificarAgregadoSistemaAscenso = async ({
  member,
  actorId,
  actorIdMiembros,
  actorNombre,
  itemNombre,
  itemContexto,
  ruta,
} = {}) => {
  const nombreMiembro =
    member?.nombreMiembro ||
    [member?.firstName || member?.nombres, member?.lastName || member?.apellidos]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    member?.memberId ||
    member?.codigoMiembro ||
    'un miembro';
  const nombreActor = actorNombre || 'Un usuario';
  const itemTexto = itemNombre || 'un ítem';
  const contextoTexto = itemContexto ? ` (${itemContexto})` : '';
  const rutaFinal = ruta || '/dashboard';
  const idMiembroAfectado = member?.idMiembros ?? member?.id ?? null;

  let enviadas = 0;

  // 1) Aviso al MIEMBRO al que se le hizo el cambio (salvo que el actor sea el
  //    propio miembro editando su registro).
  const actorEsElMiembro =
    actorIdMiembros !== null &&
    actorIdMiembros !== undefined &&
    idMiembroAfectado !== null &&
    String(actorIdMiembros) === String(idMiembroAfectado);

  if (idMiembroAfectado !== null && !actorEsElMiembro) {
    const idsMiembro = await resolverDestinatariosPorIdMiembros(idMiembroAfectado);

    if (idsMiembro.length) {
      const resultadoMiembro = await crearNotificacionUsuario({
        tipoNotificacion: 'ascenso_item_agregado',
        modulo: 'miembros',
        titulo: 'Sistema de Ascenso actualizado',
        mensaje: `${nombreActor} agregó "${itemTexto}"${contextoTexto} a tu Sistema de Ascenso.`,
        prioridad: 'informativa',
        entidadTipo: 'miembro',
        entidadId: String(member?.id || member?.idMiembros || ''),
        ruta: rutaFinal,
        etiquetaAccion: 'Ver',
        actorId: actorId || 'sistema',
        actorNombre: nombreActor,
        idsDestinatarios: idsMiembro,
      }).catch(() => null);

      if (resultadoMiembro) enviadas += 1;
    }
  }

  // 2) Aviso a los Coordinadores (titular y asistente) del destacamento, excluyendo
  //    al actor si él mismo es uno de ellos.
  const destacamentoId = Number(member?.destId || member?.idDestacamento) || null;

  if (!destacamentoId) {
    return enviadas;
  }

  const coordinadores = await obtenerCoordinadoresDestacamento(destacamentoId);

  await Promise.all(
    coordinadores.map(async (asignacion) => {
      if (
        actorIdMiembros !== null &&
        actorIdMiembros !== undefined &&
        String(asignacion.idMiembros) === String(actorIdMiembros)
      ) {
        return;
      }

      const idsDestinatarios = await resolverDestinatariosPorIdMiembros(asignacion.idMiembros);

      if (!idsDestinatarios.length) {
        return;
      }

      const resultado = await crearNotificacionAdmin({
        tipoNotificacion: 'ascenso_item_agregado',
        modulo: 'miembros',
        titulo: 'Sistema de Ascenso actualizado',
        mensaje: `${nombreActor} agregó "${itemTexto}"${contextoTexto} a ${nombreMiembro}.`,
        prioridad: 'informativa',
        entidadTipo: 'miembro',
        entidadId: String(member?.id || member?.idMiembros || ''),
        ruta: rutaFinal,
        etiquetaAccion: 'Ver',
        actorId: actorId || 'sistema',
        actorNombre: nombreActor,
        idsDestinatariosPrecalculados: idsDestinatarios,
      });

      if (resultado) enviadas += 1;
    })
  );

  return enviadas;
};

// ----------------------------------------------------------------------
// Recuperacion de clave pedida desde la pantalla de acceso.
//
// El miembro no tiene sesion, asi que no puede resolver el suyo: se avisa a los
// DOS coordinadores del destacamento —titular y asistente— para que cualquiera
// de los dos pueda ayudarle, y se devuelven sus nombres para poder decirle a
// quien se le pidio.
// ----------------------------------------------------------------------

// "Roderi Daniel Peña Rosario" -> "Roderi Peña": primer nombre y primer apellido.
export const nombreCortoDeMiembro = (miembro) => {
  const primero = (texto) => String(texto ?? '').trim().split(/\s+/)[0] || '';
  const nombre = primero(miembro?.nombres ?? miembro?.firstName);
  const apellido = primero(miembro?.apellidos ?? miembro?.lastName);
  const corto = [nombre, apellido].filter(Boolean).join(' ');

  return corto || String(miembro?.nombreMiembro || miembro?.codigoMiembro || '').trim();
};

export const notificarCoordinadoresRecuperacionClave = async ({
  member,
  miembros = [],
  onInfo,
} = {}) => {
  const destacamentoId = Number(member?.idDestacamento || member?.destId) || null;

  if (!destacamentoId) {
    onInfo?.('No se pudo identificar tu destacamento.');
    return { enviadas: 0, coordinadores: [] };
  }

  const asignaciones = await obtenerCoordinadoresDestacamento(destacamentoId);

  if (!asignaciones.length) {
    onInfo?.('Tu destacamento aún no tiene coordinador asignado en la directiva.');
    return { enviadas: 0, coordinadores: [] };
  }

  const porId = new Map(
    (Array.isArray(miembros) ? miembros : []).map((candidato) => [
      String(candidato?.idMiembros ?? candidato?.id),
      candidato,
    ])
  );
  const nombreMiembro = nombreCortoDeMiembro(member) || member?.codigoMiembro || 'un miembro';
  const coordinadores = asignaciones.map((asignacion) => ({
    idMiembros: asignacion.idMiembros,
    nombre:
      nombreCortoDeMiembro(porId.get(String(asignacion.idMiembros))) ||
      nombreCortoDeMiembro(asignacion) ||
      'tu coordinador',
    cargo: asignacion.cargo,
  }));

  const { ids, alcanzados } = await idsDeCoordinadores(asignaciones);

  if (!ids.length) return { enviadas: 0, coordinadores };

  const resultado = await crearNotificacionAdmin({
    tipoNotificacion: 'recuperacion_clave_miembro',
    modulo: 'miembros',
    titulo: 'Recuperación de contraseña',
    mensaje: `${nombreMiembro} (${member?.codigoMiembro || 'sin código'}) no puede entrar y pide ayuda para recuperar su contraseña.`,
    prioridad: 'importante',
    entidadTipo: 'miembro',
    entidadId: String(member?.idMiembros || member?.id || ''),
    ruta: member?.idMiembros
      ? `/dashboard/level/member/${member.idMiembros}/edit`
      : '/dashboard/level/member',
    etiquetaAccion: 'Ayudar',
    actorId: 'sistema',
    actorNombre: nombreMiembro,
    idsDestinatariosPrecalculados: ids,
    metadatos: {
      idMiembroSolicitante: String(member?.idMiembros || member?.id || ''),
      codigoMiembroSolicitante: member?.codigoMiembro || '',
      atendida: false,
    },
  });

  return { enviadas: resultado ? alcanzados : 0, coordinadores };
};
