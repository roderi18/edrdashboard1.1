import { paths } from 'src/routes/paths';

import { getMembers } from 'src/services/member-service';
import { crearNotificacionAdmin } from 'src/services/notification-service';
import { registrarAuditoriaSilenciosa } from 'src/services/audit-log-service';
import { resolverDestinatariosPorIdMiembros } from 'src/services/solicitudes-cambio-notificaciones-service';
import {
  CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO,
  obtenerAsignacionesOrganigramaPorDestacamento,
} from 'src/services/organigrama-directiva-destacamentos-service';

// ----------------------------------------------------------------------
// Solicitud de acceso a la información general (datos personales) de un miembro.
// Los cargos de consulta (sección, región, consejo nacional, etc.) ven esta
// información enmascarada; desde el banner de la ficha pueden pedir acceso al
// Coordinador de Destacamento del miembro, a quien se le notifica por su nombre.
// Reutiliza el patrón de Dispensa Médica (member-health-access-service).
// ----------------------------------------------------------------------

const getMemberName = (member = {}) =>
  [member.firstName || member.nombres, member.lastName || member.apellidos]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  member.name ||
  member.memberId ||
  member.codigoMiembro ||
  'Miembro';

const getUsuarioId = (usuario = {}) => String(usuario.uid || usuario.id || '').trim();

const getNombreUsuario = (usuario = {}) =>
  usuario.displayName ||
  usuario.nombre ||
  [usuario.nombres || usuario.firstName, usuario.apellidos || usuario.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  usuario.email ||
  usuario.correo ||
  'Usuario';

// Coordinadores (titular y asistente) del destacamento, desde su directiva.
const obtenerCoordinadoresDestacamento = async (idDestacamento) => {
  const asignaciones = await obtenerAsignacionesOrganigramaPorDestacamento(idDestacamento);
  const cargos = [
    CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorDestacamento,
    CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorAsistenteDestacamento,
  ];

  return asignaciones.filter((item) => cargos.includes(item.cargo) && item.activo !== false);
};

/**
 * A quien avisar cuando cambian los tutores de un miembro: el Coordinador de
 * Destacamento y su Asistente, los dos.
 *
 * Son quienes responden de esa ficha. Si alguien de su destacamento apunta o
 * corrige un telefono de emergencia, tienen que enterarse sin que nadie se lo
 * cuente: es un dato del que van a depender el dia que haga falta llamar.
 *
 * Devuelve los IDS DE CUENTA, que es lo que entienden las notificaciones.
 */
export const obtenerCuentasDeCoordinadores = async (idDestacamento) => {
  const destId = Number(idDestacamento) || null;

  if (!destId) return [];

  const coordinadores = await obtenerCoordinadoresDestacamento(destId).catch(() => []);

  if (!coordinadores.length) return [];

  const listas = await Promise.all(
    coordinadores
      .map((item) => Number(item.idMiembros))
      .filter(Boolean)
      .map((idMiembros) => resolverDestinatariosPorIdMiembros(idMiembros).catch(() => []))
  );

  return [...new Set(listas.flat().filter(Boolean))];
};

// Nombre del Coordinador de Destacamento (titular; si no hay, el asistente) del
// destacamento indicado, para mostrarlo en el banner de la ficha del miembro.
export const obtenerCoordinadorDestacamentoInfo = async (idDestacamento) => {
  const destId = Number(idDestacamento) || null;

  if (!destId) return null;

  const coordinadores = await obtenerCoordinadoresDestacamento(destId);

  if (!coordinadores.length) return null;

  const titular =
    coordinadores.find(
      (item) => item.cargo === CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorDestacamento
    ) || coordinadores[0];

  const miembros = await getMembers().catch(() => []);
  const coordinadorMiembro = miembros.find(
    (item) => Number(item.id ?? item.idMiembros) === Number(titular.idMiembros)
  );

  return {
    idMiembros: Number(titular.idMiembros),
    nombre: coordinadorMiembro ? getMemberName(coordinadorMiembro) : 'Coordinador de Destacamento',
  };
};

// Envía la solicitud de acceso a la información del miembro a los Coordinadores de
// Destacamento (titular y asistente). Devuelve el nombre del coordinador titular
// y cuántas notificaciones se enviaron.
export async function solicitarAccesoInformacionMiembro({
  member = {},
  usuario = {},
  justificacion = '',
}) {
  const texto = String(justificacion || '').trim();

  if (!texto) {
    throw new Error('La razón de la solicitud es obligatoria.');
  }

  const idDestacamento = Number(member.destId || member.idDestacamento) || null;

  if (!idDestacamento) {
    throw new Error('No se pudo identificar el destacamento del miembro.');
  }

  const coordinadores = await obtenerCoordinadoresDestacamento(idDestacamento);

  if (!coordinadores.length) {
    throw new Error('Este destacamento aún no tiene coordinador asignado en la directiva.');
  }

  const nombreMiembro = getMemberName(member);
  const nombreSolicitante = getNombreUsuario(usuario);
  const solicitanteUid = getUsuarioId(usuario) || 'sistema';
  const segmento = encodeURIComponent(
    String(member.memberId || member.codigoMiembro || member.id || '')
  );
  const ruta = segmento ? paths.dashboard.level.member.edit(segmento) : '/dashboard';

  const coordinadorInfo = await obtenerCoordinadorDestacamentoInfo(idDestacamento);
  const nombreCoordinador = coordinadorInfo?.nombre || 'Coordinador de Destacamento';

  let enviadas = 0;

  await Promise.all(
    coordinadores.map(async (coordinador) => {
      const idsDestinatarios = await resolverDestinatariosPorIdMiembros(coordinador.idMiembros);

      if (!idsDestinatarios.length) return;

      const resultado = await crearNotificacionAdmin({
        tipoNotificacion: 'solicitud_acceso_informacion_miembro',
        modulo: 'miembros',
        titulo: 'Solicitud de acceso a información de miembro',
        mensaje: `${nombreSolicitante} solicita acceso a la información de ${nombreMiembro}. Razón: ${texto}`,
        prioridad: 'importante',
        entidadTipo: 'miembro',
        entidadId: String(member.id || member.idMiembros || ''),
        ruta,
        etiquetaAccion: 'Revisar',
        actorId: solicitanteUid,
        actorNombre: nombreSolicitante,
        idsDestinatariosPrecalculados: idsDestinatarios,
        metadatos: { justificacion: texto, idDestacamento },
      });

      if (resultado) enviadas += 1;
    })
  );

  await registrarAuditoriaSilenciosa({
    modulo: 'miembros',
    accion: 'solicitud_acceso_informacion_creada',
    descripcion: `${nombreSolicitante} solicitó acceso a la información de ${nombreMiembro}.`,
    entidad: { tipo: 'miembro', id: member.id || member.idMiembros, nombre: nombreMiembro },
    realizadoPor: usuario,
    origen: 'member-info-access-service',
    metadatos: { justificacion: texto, idDestacamento, nombreCoordinador },
  }).catch(() => {});

  return { enviadas, nombreCoordinador };
}
