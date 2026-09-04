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

const ETIQUETA_CARGO_COORDINADOR = {
  [CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorDestacamento]:
    'Coordinador de Destacamento',
  [CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorAsistenteDestacamento]:
    'Coordinador Asistente',
};

// "A" / "A y B": une los nombres como se leen, sin comas de mas ni un "y"
// colgando cuando solo hay uno.
const unirNombres = (partes = []) => {
  if (partes.length <= 1) return partes[0] || '';

  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
};

/**
 * Como se nombra a quien va a recibir la solicitud.
 *
 * Aparte y sin Firestore de por medio: es texto que se lee en pantalla, y se
 * comprueba solo.
 *
 * @returns {{ etiqueta: string, nombres: string }} `etiqueta` con el cargo entre
 * parentesis, para el aviso; `nombres` a secas, para el mensaje de confirmacion.
 */
export const describirCoordinadores = (listado = []) => ({
  etiqueta: unirNombres(listado.map((item) => `${item.nombre} (${item.etiquetaCargo})`)),
  nombres: unirNombres(listado.map((item) => item.nombre)),
});

/**
 * A quien se va a avisar de la solicitud, con nombre y cargo, para el aviso de
 * la ficha del miembro.
 *
 * LOS DOS, no solo el titular. La notificacion siempre le ha llegado al
 * Coordinador y a su Asistente —los dos responden de esa ficha—, pero el aviso
 * nombraba unicamente al primero: quien pedia el acceso se quedaba creyendo que
 * dependia de una sola persona, y si esa estaba de viaje, esperando de balde.
 *
 * `nombre` e `idMiembros` siguen siendo los del titular: de ahi salen el mensaje
 * de confirmacion y el registro en Historial.
 */
export const obtenerCoordinadorDestacamentoInfo = async (idDestacamento) => {
  const destId = Number(idDestacamento) || null;

  if (!destId) return null;

  const coordinadores = await obtenerCoordinadoresDestacamento(destId);

  if (!coordinadores.length) return null;

  const miembros = await getMembers().catch(() => []);

  const nombreDe = (asignacion) => {
    const miembro = miembros.find(
      (item) => Number(item.id ?? item.idMiembros) === Number(asignacion.idMiembros)
    );

    return miembro
      ? getMemberName(miembro)
      : ETIQUETA_CARGO_COORDINADOR[asignacion.cargo] || 'Coordinador de Destacamento';
  };

  // El titular delante, su Asistente detras: es el orden en que se nombran.
  const ordenados = [...coordinadores].sort((uno, otro) => {
    const esTitular = (item) =>
      item.cargo === CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorDestacamento ? 0 : 1;

    return esTitular(uno) - esTitular(otro);
  });

  const listado = ordenados.map((asignacion) => ({
    idMiembros: Number(asignacion.idMiembros),
    nombre: nombreDe(asignacion),
    cargo: asignacion.cargo,
    etiquetaCargo:
      ETIQUETA_CARGO_COORDINADOR[asignacion.cargo] || 'Coordinador de Destacamento',
  }));

  const titular = listado[0];

  return {
    idMiembros: titular.idMiembros,
    nombre: titular.nombre,
    coordinadores: listado,
    ...describirCoordinadores(listado),
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
  // A quienes se les mando, para decirlo tal cual al confirmar: el Coordinador y
  // su Asistente, no solo el titular.
  const nombresCoordinadores = coordinadorInfo?.nombres || nombreCoordinador;

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

  return { enviadas, nombreCoordinador, nombresCoordinadores };
}
