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

  let enviadas = 0;

  await Promise.all(
    destinatarios.map(async (asignacion) => {
      const idsDestinatarios = await resolverDestinatariosPorIdMiembros(asignacion.idMiembros);

      if (!idsDestinatarios.length) {
        console.warn(
          '[solicitudes cambio] coordinador sin cuenta de usuario para notificar',
          asignacion.idMiembros
        );
        return;
      }

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
        idsDestinatariosPrecalculados: idsDestinatarios,
      });

      if (resultado) enviadas += 1;
    })
  );

  return enviadas;
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
