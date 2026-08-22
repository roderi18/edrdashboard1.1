// third-party
import dayjs from 'dayjs';
import { useSearchParams } from 'next/navigation';
// react
import { useRef, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { doc, where, query, getDoc, getDocs, collection } from 'firebase/firestore';

// mui
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import { useTheme, useMediaQuery } from '@mui/material';
import FormControlLabel from '@mui/material/FormControlLabel';

// routes
import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

// utils
import { EDAD_MAYORIA } from 'src/utils/member-age';
import { optimizeImageFile } from 'src/utils/image-optimizer';
import { generateMemberId } from 'src/utils/generate-member-id';
import { isGlobalOrgManager } from 'src/utils/org-level-access';
// services
import { getMemberFullName } from 'src/utils/get-member-fullname';
import { esperar, RETARDO_GUARDADO_MS } from 'src/utils/ui-delays';
import { normalizeMemberUsername } from 'src/utils/member-auth-credentials';
import { getImageOptimizationMessage } from 'src/utils/upload-optimization-message';
import { buildOrgIndex, getMemberOrgPath } from 'src/utils/leadership-member-options';
import {
  calcularEstatusCI,
  calcularVencimientoCI,
  calcularDiasRestantesCI,
} from 'src/utils/ci-utils';
import {
  getAvisoDatosPendientes,
  puedeVerAvisoDatosPendientes,
} from 'src/utils/member-datos-pendientes';
import {
  subirFotoEntidad,
  subirFotoMiembroPendiente,
  registrarFotoEntidadSubida,
} from 'src/utils/firebase-photos';
import {
  getOwnDestIdsForUser,
  canApproveMemberChanges,
  puedeEditarSuPropiaFicha,
  isDestacamentoApprovalRole,
  canViewMemberSensitiveData,
  isCoordinadorDestacamentoRole,
  canViewMemberContactDataByAge,
  canViewMemberBirthdateWhenMasked,
} from 'src/utils/member-access';

import { FIRESTORE } from 'src/lib/firebase';
import barriosData from 'src/data/barrios.json';
import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';
import { getDestsApi } from 'src/services/dest-service';
import { getChurches } from 'src/services/church-service';
import { getDivisions } from 'src/services/division-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
// models
import { MemberValidationSchema } from 'src/models/member-schema';
// mock data
import { CHURCHES, REGIONALS, SECTIONALS } from 'src/_mock/assets';
import { registrarAuditoriaSilenciosa } from 'src/services/audit-log-service';
import { _allLeadershipRoles, _leadershipRolesByLevel } from 'src/_mock/_leadership';
import { registrarCambiosHistorialMiembro } from 'src/services/member-history-service';
import { createFirebaseAuthForMember } from 'src/services/member-auth-provisioning-service';
import { MEMBER_SHIRT_SIZES, MEMBER_OCUPATIONS_SORTED } from 'src/catalogs/member-catalogs';
import {
  getMembers,
  invalidateMembersCache,
  getLeadershipAssignments,
} from 'src/services/member-service';
import { notificarCoordinadoresActualizacionDirecta } from 'src/services/solicitudes-cambio-notificaciones-service';
import {
  getNivelesARetirar,
  getOrganigramaDestSlot,
  NATIONAL_LEADERSHIP_LEVELS,
  AMBITO_CARGO_UNICO_POR_NIVEL,
} from 'src/catalogs/directiva-positions';
import {
  crearNotificacionAdmin,
  crearNotificacionCuentaCreada,
  crearNotificacionMiembroCreado,
  crearNotificacionMiembroActualizado,
  crearNotificacionErrorSubidaArchivoImagen,
} from 'src/services/notification-service';
import {
  CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO,
  obtenerAsignacionesOrganigramaPorDestacamento,
  guardarAsignacionOrganigramaDirectivaDestacamento,
  desactivarAsignacionOrganigramaDirectivaDestacamento,
} from 'src/services/organigrama-directiva-destacamentos-service';
import {
  NIVELES_DIRECTIVA,
  DIVISIONES_DIRECTIVA,
  guardarAsignacionDirectiva,
  obtenerAsignacionesDirectiva,
  obtenerCargosDirectivaCached,
  obtenerAsignacionesDirectivaPorMiembro,
  desactivarAsignacionesDirectivaPorNivel,
} from 'src/services/directivas-organizacionales-service';
import {
  getModuloSolicitud,
  ESTADOS_SOLICITUD_CAMBIO,
  MODULOS_SOLICITUD_CAMBIO,
  RESULTADO_SOLICITUD_LABEL,
  crearSolicitudCambioMiembro,
  obtenerSolicitudCambioPorId,
  clasificarResultadoSolicitud,
  resolverSolicitudCambioMiembro,
  obtenerSolicitudPendientePorMiembro,
} from 'src/services/solicitudes-cambio-miembro-service';

// components
import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { ContextInfo } from 'src/components/info/context-info';
import { UnderlineLink } from 'src/components/link/underline-link';
// form sections
import MemberGeneralSection from 'src/components/form/member-form/MemberGeneralSection';
import MemberAddressSection from 'src/components/form/member-form/MemberAddressSection';
import MemberInstructorCISection from 'src/components/form/member-form/MemberInstructorCISection';
import MemberLeadershipAndOtherSection from 'src/components/form/member-form/MemberLeadershipAndOtherSection';

import { useAuthContext } from 'src/auth/hooks';

import { MemberInfoPdfMenu } from './member-info-pdf-menu';
import { MemberChangeResultDialog } from './member-change-result-dialog';
import { MemberChangeRequestDialog } from './member-change-request-dialog';
import {
  formatMemberFieldValue,
  MEMBER_CHANGE_REQUEST_FIELDS,
} from './member-change-request-fields';
// ----------------------------------------------------------------------

const MEMBER_PHOTO_OPTIMIZE_OPTIONS = {
  maxWidth: 900,
  maxHeight: 900,
  quality: 0.82,
  mimeType: 'image/webp',
  maxSizeBytes: 320000,
};

const getRowsFromApi = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
};

const getCodigoMiembro = (member) => member?.codigoMiembro || member?.memberId || '';

const getOccupationValue = (occupation) => {
  if (!occupation) return '';
  if (typeof occupation === 'string') return occupation;

  return occupation.label || occupation.value || '';
};

const MEMBER_HISTORY_FIELDS = {
  codigoMiembro: 'Código de miembro',
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  genero: 'Género',
  fechaNacimiento: 'Fecha de nacimiento',
  idDestacamento: 'Destacamento',
  telefono: 'Teléfono',
  direccion: 'Dirección',
  correo: 'Correo',
  idCargoLocal: 'Cargo local',
  idCargoInstitucional: 'Cargo institucional',
  idDivision: 'División',
  instructorCertificadoCi: 'Instructor certificado CI',
  estatusVigenciaCi: 'Estatus vigencia CI',
  fechaInicioCertificado: 'Fecha inicio certificado CI',
  fechaFinCertificado: 'Fecha vencimiento certificado CI',
};

const mapCurrentMemberToHistoryPayload = (member = {}) => ({
  codigoMiembro: member.codigoMiembro || member.memberId || '',
  nombres: member.nombres || member.firstName || '',
  apellidos: member.apellidos || member.lastName || '',
  genero:
    member.genero ||
    (member.gender === 'Masculino' ? 'M' : member.gender === 'Femenino' ? 'F' : member.gender) ||
    '',
  fechaNacimiento: member.fechaNacimiento || member.birthDate || null,
  idDestacamento: member.idDestacamento ?? member.destId ?? null,
  telefono: member.telefono || member.phoneNumber || '',
  direccion: member.direccion || member.memberAddress || '',
  correo: member.correo || member.email || '',
  idCargoLocal: member.idCargoLocal ?? null,
  idCargoInstitucional: member.idCargoInstitucional ?? null,
  idDivision: member.idDivision ?? null,
  instructorCertificadoCi: member.instructorCertificadoCi ?? member.InstructorCertificadoCI ?? null,
  estatusVigenciaCi: member.estatusVigenciaCi ?? member.EstatusVigenciaCI ?? null,
  fechaInicioCertificado: member.fechaInicioCertificado || member.FechaInicioCI || null,
  fechaFinCertificado: member.fechaFinCertificado || member.FechaVencimientoCI || null,
});

// Miembro que ya tiene ese correo, o null. El correo identifica a la persona
// —sirve para recuperar la clave y para entrar—, asi que dos fichas con el mismo
// dejarian a las dos sin forma de distinguirse.
const buscarMiembroConCorreo = (membersList, correo, currentMemberId) => {
  const buscado = String(correo ?? '')
    .trim()
    .toLowerCase();

  if (!buscado) return null;

  return (
    (Array.isArray(membersList) ? membersList : []).find((member) => {
      const memberId = member?.idMiembros ?? member?.id;
      const memberCorreo = String(member?.email || member?.correo || '')
        .trim()
        .toLowerCase();

      return (
        memberCorreo === buscado && String(memberId ?? '') !== String(currentMemberId ?? '')
      );
    }) || null
  );
};

const hasDuplicatedCodigoMiembro = (membersList, codigoMiembro, currentMemberId) => {
  const normalizedCodigoMiembro = normalizeMemberUsername(codigoMiembro);

  if (!normalizedCodigoMiembro) return false;

  return (Array.isArray(membersList) ? membersList : []).some((member) => {
    const memberId = member?.idMiembros ?? member?.id;
    const memberCodigoMiembro = normalizeMemberUsername(getCodigoMiembro(member));

    return (
      memberCodigoMiembro === normalizedCodigoMiembro &&
      String(memberId ?? '') !== String(currentMemberId ?? '')
    );
  });
};

const getDirectivaDivisionByMemberDivisionId = (idDivision) => {
  const divisionId = Number(idDivision);

  if (divisionId === 1) return DIVISIONES_DIRECTIVA.navegantes;
  if (divisionId === 2) return DIVISIONES_DIRECTIVA.pioneros;
  if (divisionId === 3) return DIVISIONES_DIRECTIVA.seguidores;
  if (divisionId === 4) return DIVISIONES_DIRECTIVA.exploradores;

  return '';
};

const mapMemberToForm = (member) => {
  // Los cargos NO salen de aqui: los rellena el efecto que lee las asignaciones
  // de directiva en Firestore. Antes se buscaban en "leadershipAssignments"
  // (datos de ejemplo, con ids como 'member-01'), que ademas de no acertar nunca
  // dejaba los campos vacios y pisaba el cargo recien guardado en cada reset.

  const provinces = provinciasData;

  const municipios = municipiosData.map((m, index) => ({
    ...m,
    id: index + 1,
    municipioId: index + 1,
  }));

  const sectores = barriosData;

  const direccionParts = (member.direccion || member.memberAddress || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const [provinceName = '', municipioName = '', sectorName = '', street = ''] = direccionParts;

  const province = provinces.find((p) => p.nombre?.trim() === provinceName);
  const municipio = municipios.find((m) => m.nombre?.trim() === municipioName && String(m.id));
  const sector = sectores.find((s) => s.nombre?.trim() === sectorName && String(s.id));

  return {
    firstName: member.firstName ?? '',
    lastName: member.lastName ?? '',
    birthdate: member.birthDate
      ? dayjs(member.birthDate)
      : member.birth
        ? dayjs(member.birth)
        : member.dateOfBirth
          ? dayjs(member.dateOfBirth)
          : null,
    email: member.email ?? '',
    phoneNumber: member.phoneNumber ?? '',
    // country: member.country ?? '',
    provinceId: province?.id ? String(province.id) : '',
    municipioId: municipio?.id ? String(municipio.id) : '',
    sectorId: sector?.id ? String(sector.id) : '',
    street: street ?? '',
    state: member.province ?? '',
    city: member.city ?? '',
    address: member.direccion ?? '',
    memberDivision: member.memberDivision ?? '',
    idDivision: member.idDivision ?? 0,
    destId: member.destId || member.dest_id || member.dest || '',
    ocupation:
      MEMBER_OCUPATIONS_SORTED.find((o) =>
        [o.label, o.value].some((value) => String(value) === String(member.ocupation))
      ) || null,
    memberPosition: '',

    gender: member.gender === 'M' ? 'Masculino' : member.gender === 'F' ? 'Femenino' : '',
    shirtSize: MEMBER_SHIRT_SIZES.find((s) => s.value === member.shirtSize)?.value || '',

    InstructorCertificadoCI: member.InstructorCertificadoCI ?? 0,
    EstatusVigenciaCI:
      member.InstructorCertificadoCI === 0 ? 'na' : (member.EstatusVigenciaCI ?? 1),
    FechaInicioCI: member.FechaInicioCI ? dayjs(member.FechaInicioCI) : null,

    FechaVencimientoCI: member.FechaVencimientoCI ? dayjs(member.FechaVencimientoCI) : null,

    status: member.status ?? 'active',
    avatarUrl: member.avatarUrl ?? null,
    isVerified: member.isVerified ?? true,
    nationalLeadershipLevel: 'none',
    nationalLeadershipRole: '',
  };
};

// Valor por defecto de `availableDests`, a proposito fuera del componente.
//
// Escrito como `availableDests = []` en la firma, JavaScript crea un array NUEVO
// en cada render. Dos efectos lo llevan en su lista de dependencias, asi que se
// disparaban siempre: uno de ellos pedia los destacamentos y hacia `setDests`,
// lo que provocaba otro render, y vuelta a empezar. Un bucle infinito pidiendo
// al servidor sin parar. Con una sola constante compartida, la identidad no
// cambia y los efectos corren cuando toca.
const SIN_DESTACAMENTOS_PROPIOS = [];

// Campos que viven en el primer paso del alta. Se usan para devolver ahi al
// usuario cuando la validacion falla desde el segundo.
const CAMPOS_PASO_1 = new Set([
  'firstName',
  'lastName',
  'birthdate',
  'phoneNumber',
  'email',
  'provinceId',
  'municipioId',
  'sectorId',
  'street',
]);

export function MemberCreateEditForm({
  currentMember,
  readOnly = false,
  availableDests = SIN_DESTACAMENTOS_PROPIOS,
  destIdInicial = '',
}) {
  const { user } = useAuthContext();
  // Cargos del destacamento que no son coordinadores (líder de grupo/asistente,
  // pastor, consejo, capellán): no pueden editar destacamento, posición en el
  // destacamento, sexo ni Instructor CI (se muestran deshabilitados) y sus cambios
  // van a aprobación del Coordinador de Destacamento.
  const isCoordinador = isCoordinadorDestacamentoRole(user);
  // El propio miembro, en SU ficha, entra en ese mismo flujo: ve todos sus datos
  // y puede tocarlos, pero lo que escriba pasa por el Coordinador de Destacamento
  // y su Asistente. Los dos coordinadores quedan fuera —son quienes aprueban— y
  // guardan directamente, tambien en su propia ficha.
  const esFichaPropia = puedeEditarSuPropiaFicha(user, currentMember);
  const editaSuPropiaFicha = esFichaPropia && !isCoordinador;
  const lockGroupLeaderFields = isDestacamentoApprovalRole(user) || editaSuPropiaFicha;
  const puedeAprobarCambios = canApproveMemberChanges(user);
  // Usuarios sin acceso a los datos sensibles (sección, región, consejo nacional,
  // consejo de destacamento, líderes de grupo, etc.): la información personal se
  // muestra ENMASCARADA (dirección, teléfono y correo).
  // Nadie se oculta a si mismo: en su propia ficha ve telefono, correo, direccion
  // y fecha de nacimiento en claro.
  const maskSensitive =
    Boolean(currentMember) && !canViewMemberSensitiveData(user) && !esFichaPropia;
  // Coordinador Seccional y Coordinador Regional: sobre los miembros MAYORES DE
  // EDAD ven fecha de nacimiento, teléfono y correo en texto plano (el
  // enmascarado protege a los menores). La dirección sigue enmascarada.
  const adultContactVisible = canViewMemberContactDataByAge(user, currentMember ?? {});
  // Teléfono y correo. Se separa de `maskSensitive` (que sigue rigiendo la
  // dirección) para poder destaparlos solo en los miembros adultos.
  const maskContact = maskSensitive && !adultContactVisible;
  // La fecha de nacimiento es la única excepción al enmascarado para los cargos
  // del destacamento que la necesitan (edad y división del miembro).
  const maskBirthdate =
    maskSensitive && !adultContactVisible && !canViewMemberBirthdateWhenMasked(user);
  // Enmascarar NO implica solo lectura: quién puede editar ya lo decide el prop
  // `readOnly` (derivado de `miembros.editar`). Acoplarlos dejaba sin el botón de
  // "Enviar cambios a aprobación" a los líderes de grupo, que sí editan aunque
  // vean los datos personales enmascarados.
  const readOnlyEffective = readOnly;
  // Simulacion del flujo de aprobacion: el lider de grupo no guarda directo, sino
  // que "envia a aprobacion" a sus coordinadores y el boton queda "pendiente".
  const [sendingApproval, setSendingApproval] = useState(false);
  // Solicitud pendiente enviada por el propio lider de grupo (para el boton
  // "Ver cambios pendientes" y su modal de solo lectura).
  const [leaderPendingRequest, setLeaderPendingRequest] = useState(null);

  // Aviso de "esta posición ya está ocupada". Guarda al ocupante para el texto y
  // el `resolve` de la promesa que deja el guardado en espera de la decisión.
  const [posicionOcupada, setPosicionOcupada] = useState(null);
  const decisionReemplazoRef = useRef(null);

  const pedirConfirmacionDeReemplazo = (ocupante) =>
    new Promise((resolve) => {
      decisionReemplazoRef.current = resolve;
      setPosicionOcupada(ocupante);
    });

  const responderReemplazo = (aceptado) => {
    setPosicionOcupada(null);
    decisionReemplazoRef.current?.(aceptado);
    decisionReemplazoRef.current = null;
  };

  // Solicitud de cambio abierta desde la notificacion (?solicitud=<id>). Solo se
  // muestra a los coordinadores (no a los propios lideres de grupo).
  const searchParams = useSearchParams();
  const solicitudIdFromUrl = searchParams?.get('solicitud') || '';
  const resultadoIdFromUrl = searchParams?.get('resultado') || '';
  const [changeRequest, setChangeRequest] = useState(null);
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);
  const [resolvingChangeRequest, setResolvingChangeRequest] = useState(false);
  // Modal de resultado que ve el solicitante al pulsar "Ver" en la notificacion.
  const [changeResult, setChangeResult] = useState(null);
  const [changeResultOpen, setChangeResultOpen] = useState(false);

  // Resuelve los ids con los que se puede direccionar a un miembro (por su
  // idMiembros): uid de su cuenta, idUsuario, id del documento y codigoMiembro.
  // El panel de notificaciones filtra por `uid` del usuario, por eso hay que
  // incluir el uid real del coordinador y no solo su idMiembros.
  const resolverDestinatariosPorIdMiembros = async (idMiembros) => {
    const ids = new Set();
    const agregarDesdeData = (documento) => {
      const data = documento.data() || {};
      [data.uid, data.idUsuario, documento.id, data.codigoMiembro]
        .filter(Boolean)
        .forEach((valor) => ids.add(String(valor)));
    };

    await Promise.all([
      // Busqueda por campo idMiembros (numero) en ambas colecciones.
      ...['usuarios_roles', 'users'].map(async (coleccion) => {
        const snapshot = await getDocs(
          query(collection(FIRESTORE, coleccion), where('idMiembros', '==', Number(idMiembros)))
        ).catch(() => null);

        snapshot?.docs?.forEach(agregarDesdeData);
      }),
      // Los docs de usuarios_roles suelen llavearse por el idMiembros: lectura
      // directa como respaldo si el campo se guardo como texto.
      (async () => {
        const directo = await getDoc(doc(FIRESTORE, 'usuarios_roles', String(idMiembros))).catch(
          () => null
        );

        if (directo?.exists()) {
          agregarDesdeData(directo);
        }
      })(),
    ]);

    return [...ids];
  };

  const notificarCoordinadoresDestacamento = async ({ ruta } = {}) => {
    const destacamentoId = Number(currentMember?.destId || currentMember?.idDestacamento) || null;

    if (!destacamentoId) {
      toast.info('No se pudo identificar el destacamento del miembro.');
      return 0;
    }

    const asignaciones = await obtenerAsignacionesOrganigramaPorDestacamento(destacamentoId);
    const cargosCoordinacion = [
      CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorDestacamento,
      CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorAsistenteDestacamento,
    ];
    const destinatarios = asignaciones.filter((asignacion) =>
      cargosCoordinacion.includes(asignacion.cargo)
    );

    if (!destinatarios.length) {
      toast.info('Este destacamento aún no tiene coordinador asignado en la directiva.');
      return 0;
    }

    const nombreMiembro =
      `${watch('firstName') || ''} ${watch('lastName') || ''}`.trim() ||
      currentMember?.memberId ||
      'un miembro';
    const nombreSolicitante =
      user?.displayName ||
      [user?.nombres, user?.apellidos].filter(Boolean).join(' ') ||
      'Un líder de grupo';

    let enviadas = 0;

    await Promise.all(
      destinatarios.map(async (asignacion) => {
        const idsDestinatarios = await resolverDestinatariosPorIdMiembros(asignacion.idMiembros);

        if (!idsDestinatarios.length) {
          console.warn(
            '[member form] coordinador sin cuenta de usuario para notificar',
            asignacion.idMiembros
          );
          return;
        }

        // El coordinador de destacamento es una sesion de administrador, por lo
        // que la notificacion debe crearse como "admin" (una notificacion de tipo
        // "usuario" se le oculta a los administradores en el panel).
        const resultado = await crearNotificacionAdmin({
          tipoNotificacion: 'solicitud_cambio_miembro',
          modulo: 'miembros',
          titulo: 'Solicitud de cambio de miembro',
          mensaje: `${nombreSolicitante} solicita aprobar cambios en ${nombreMiembro}.`,
          prioridad: 'informativa',
          entidadTipo: 'miembro',
          entidadId: String(currentMember?.id || ''),
          ruta:
            ruta ||
            (currentMember?.id ? `/dashboard/level/member/${currentMember.id}/edit` : '/dashboard'),
          etiquetaAccion: 'Revisar',
          actorId: user?.uid || user?.id || 'sistema',
          actorNombre: nombreSolicitante,
          idsDestinatariosPrecalculados: idsDestinatarios,
        });

        if (resultado) enviadas += 1;
      })
    );

    return enviadas;
  };

  // Calcula el diff (antes/despues) sobre todos los campos del formulario de
  // miembro. `antes` sale de los valores con los que se cargo el formulario
  // (defaultValues). Se guarda el valor crudo aplicable (`antes`/`despues`) y su
  // texto legible (`antesTexto`/`despuesTexto`) que ve el coordinador. El cambio
  // se detecta comparando el texto legible (robusto para fechas y selects).
  // dayjs -> ISO (Firestore no acepta objetos dayjs); undefined -> '' (Firestore
  // no acepta undefined). Objetos (p. ej. ocupacion {value,label}), numeros y
  // strings se conservan tal cual para poder reaplicarlos al aprobar.
  const normalizarValorCrudo = (valor) => {
    if (dayjs.isDayjs(valor)) return valor.format();
    return valor === null || valor === undefined ? '' : valor;
  };

  const construirCambiosSolicitud = () => {
    const antes = methods.formState.defaultValues || {};
    const ahora = methods.getValues();

    return MEMBER_CHANGE_REQUEST_FIELDS.map(({ name, label }) => {
      const antesRaw = normalizarValorCrudo(antes[name]);
      const despuesRaw = normalizarValorCrudo(ahora[name]);

      return {
        campo: name,
        label,
        antes: antesRaw,
        despues: despuesRaw,
        antesTexto: formatMemberFieldValue(name, antesRaw, { dests }),
        despuesTexto: formatMemberFieldValue(name, despuesRaw, { dests }),
      };
    }).filter((cambio) => cambio.antesTexto !== cambio.despuesTexto);
  };

  const handleRequestApproval = async () => {
    const cambios = construirCambiosSolicitud();

    if (!cambios.length) {
      toast.info('No hay cambios para enviar a aprobación.');
      return;
    }

    setSendingApproval(true);

    try {
      const nombreMiembro =
        `${watch('firstName') || ''} ${watch('lastName') || ''}`.trim() ||
        currentMember?.memberId ||
        'Miembro';

      // Snapshot completo de los valores propuestos (todos los campos, no solo
      // los que cambiaron) para que el dialogo del coordinador tenga el contexto
      // que necesitan los inputs en cascada (p. ej. LocationSelect requiere
      // provincia/municipio aunque solo haya cambiado el sector).
      const valoresAhora = methods.getValues();
      const valoresPropuestos = Object.fromEntries(
        MEMBER_CHANGE_REQUEST_FIELDS.map(({ name }) => [
          name,
          normalizarValorCrudo(valoresAhora[name]),
        ])
      );

      const solicitud = await crearSolicitudCambioMiembro({
        idMiembros: currentMember?.id ? Number(currentMember.id) : null,
        codigoMiembro: currentMember?.memberId || '',
        nombreMiembro,
        idDestacamento: Number(currentMember?.destId || currentMember?.idDestacamento) || null,
        solicitadoPorUid: user?.uid || user?.id || '',
        solicitadoPorNombre:
          user?.displayName ||
          [user?.nombres, user?.apellidos].filter(Boolean).join(' ') ||
          'Líder de Grupo',
        solicitadoPorRol: 'lider_grupo',
        cambios,
        valoresPropuestos,
      });

      // Se usa el codigo del miembro (segmento canonico) para que el layout no
      // redirija y no se pierda el query ?solicitud=.
      const segmentoMiembro = currentMember?.memberId
        ? encodeURIComponent(currentMember.memberId)
        : currentMember?.id;

      const enviadas = await notificarCoordinadoresDestacamento({
        ruta: segmentoMiembro
          ? `/dashboard/level/member/${segmentoMiembro}/edit?solicitud=${solicitud.id}`
          : '/dashboard',
      });

      if (!enviadas) {
        toast.warning('Se registró la solicitud, pero no se pudo notificar a un coordinador.');
      } else {
        toast.success('Se envió una notificación a tus Coordinadores.');
      }

      setLeaderPendingRequest(solicitud);
    } catch (approvalError) {
      console.error('[member form] no se pudo enviar la solicitud de aprobacion', approvalError);
      toast.error('No se pudo enviar la solicitud a tus Coordinadores.');
    } finally {
      setSendingApproval(false);
    }
  };
  const LEADERSHIP_ASSIGNMENTS = getLeadershipAssignments();
  const [dests, setDests] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadErrorMessage, setPhotoUploadErrorMessage] = useState('');
  // Se incrementa tras guardar para releer los cargos desde la API. El `reset`
  // posterior al guardado repuebla el formulario con `mapMemberToForm`, que saca
  // el cargo de LEADERSHIP_ASSIGNMENTS (datos estaticos) y por tanto lo deja
  // vacio: sin esto el campo volvia a "Ninguno" hasta recargar la pagina.
  const [cargosVersion, setCargosVersion] = useState(0);
  const [orgIndex, setOrgIndex] = useState(() => buildOrgIndex({}));
  // ¿Ocupa la casilla de Pastor? Solo a el se le muestra el aviso de ficha
  // incompleta.
  const [esPastor, setEsPastor] = useState(false);
  // Foto ya subida a Storage mientras se llenaba el formulario de alta, a la
  // espera de que exista el miembro al que colgarla.
  const fotoPendienteRef = useRef(null);
  const lastCalculatedBirthdateRef = useRef('');
  const skippedInitialDivisionFetchRef = useRef(false);

  useEffect(() => {
    if (Array.isArray(availableDests) && availableDests.length) {
      setDests(availableDests);
    }
  }, [availableDests]);

  useEffect(() => {
    const load = async () => {
      const data = await getDivisions();
      setDivisions(data);
    };

    load();
  }, []);
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [showMore, setShowMore] = useState(false);
  const [step, setStep] = useState(1);
  const isCreateView = !currentMember;
  const [formErrorMessage, setFormErrorMessage] = useState(false);

  // Subir la foto del miembro queda reservado a los cargos de destacamento y solo
  // sobre los miembros de SU PROPIO destacamento. Para el resto no se muestra la
  // opción (el avatar se ve normal, sin atenuar). Los administradores global y
  // funcional la conservan por ser los responsables del sistema.
  const isDestacamentoCargo =
    isCoordinadorDestacamentoRole(user) || isDestacamentoApprovalRole(user);
  const memberDestId = String(currentMember?.destId ?? currentMember?.idDestacamento ?? '').trim();
  const isOwnDestMember = Boolean(memberDestId) && getOwnDestIdsForUser(user).has(memberDestId);
  const canUploadMemberPhoto =
    isGlobalOrgManager(user) || (isDestacamentoCargo && (isCreateView || isOwnDestMember));

  const totalSteps = 2;
  const nextStep = () => setStep(2);
  const prevStep = () => setStep(1);

  const defaultValues = {
    status: 'active',
    avatarUrl: null,
    isVerified: true,
    firstName: '',
    lastName: '',
    name: '',
    email: '',
    phoneNumber: '',
    // country: 'Rep?blica Dominicana',

    provinceId: '',
    municipioId: '',
    sectorId: '',
    street: '',
    state: '',
    city: '',
    address: '',
    ocupation: null,
    memberDivision: '',
    idDivision: 0,
    memberPosition: '',
    gender: 'Masculino',
    shirtSize: '',
    // Viene puesto cuando se entra desde la ficha de un destacamento. De el
    // cuelgan la seccion, la region y la iglesia, que se resuelven solas.
    destId: destIdInicial || '',
    InstructorCertificadoCI: 0,
    EstatusVigenciaCI: 'na',
    FechaVencimientoCI: null,
    destLeadershipRole: 'Ninguna',
    nationalLeadershipLevel: 'none',
    nationalLeadershipRole: '',
  };

  const methods = useForm({
    resolver: zodResolver(MemberValidationSchema),
    mode: 'onSubmit',
    defaultValues: currentMember ? mapMemberToForm(currentMember) : defaultValues,
    // Deshabilita SOLO los campos del formulario (no los desplegables ni el botón
    // de descarga) para los usuarios en solo lectura / con datos enmascarados.
    disabled: readOnlyEffective,
  });

  useEffect(() => {
    if (currentMember) {
      methods.reset(mapMemberToForm(currentMember));
    }
  }, [currentMember]);

  // Al crear, la pantalla empieza SIEMPRE por el paso 1.
  //
  // No basta con el estado inicial: si se entra desde "Agregar nuevo miembro" de
  // un destacamento y despues desde el de otro, la direccion solo cambia en la
  // parte de consulta y la pantalla no se vuelve a montar. Sin esto se quedaria
  // en el paso donde estuviera, y ademas con el destacamento del anterior.
  useEffect(() => {
    if (currentMember) return;

    setStep(1);
    methods.setValue('destId', destIdInicial || '');
  }, [destIdInicial, currentMember]);

  useEffect(() => {
    let isMounted = true;

    const loadMemberCargos = async () => {
      const memberId = currentMember?.id || currentMember?.idMiembros;

      if (!memberId) {
        return;
      }

      try {
        const [cargosDirectiva, asignacionesDirectiva] = await Promise.all([
          obtenerCargosDirectivaCached({ incluirNoAsignables: false }),
          obtenerAsignacionesDirectivaPorMiembro({ idMiembro: memberId }),
        ]);

        if (!isMounted) {
          return;
        }

        // FIRESTORE ES LA UNICA FUENTE. Antes se leia ADEMAS `CargosMiembros`
        // (API .NET) y se concatenaban las dos listas: una fila que sobreviviera
        // alli resucitaba en la ficha un cargo que la Directiva ya le habia dado
        // a otra persona. `obtenerAsignacionesDirectivaPorMiembro` devuelve solo
        // las ACTIVAS, que es exactamente lo que el organigrama dibuja, asi que
        // ficha y Directiva no pueden discrepar.
        const posiciones = asignacionesDirectiva
          .map((asignacion) =>
            cargosDirectiva.find((cargo) =>
              [cargo.idPosicionDirectiva, cargo.id, cargo.idCargo, cargo.idCargoApi].some(
                (value) =>
                  String(value || '') === String(asignacion.idPosicionDirectiva || '') ||
                  String(value || '') === String(asignacion.idCargo || '')
              )
            )
          )
          .filter(Boolean);

        const nationalCargo = posiciones.find((cargo) => cargo.nivel !== 'destacamento');
        const destCargo = posiciones.find((cargo) => cargo.nivel === 'destacamento');

        // El aviso de ficha incompleta es SOLO para el pastor: es la unica persona
        // que el sistema da de alta por su cuenta, con el nombre como unico dato.
        // Al resto se les registra desde este mismo formulario, asi que marcarlos
        // seria senalar algo que nadie pidio arreglar.
        // Se comprueban los tres identificadores: segun de donde venga el
        // catalogo, la posicion expone `idPosicionDirectiva`, `id` o `idCargo`, y
        // mirar solo uno dejaba el aviso apagado aunque el cargo fuera Pastor.
        setEsPastor(
          posiciones.some((cargo) =>
            [cargo.idPosicionDirectiva, cargo.id, cargo.idCargo].some(
              (valor) => String(valor || '') === 'destacamento-pastor'
            )
          )
        );

        // Se escriben SIEMPRE, tambien en vacio: si el cargo se retiro desde la
        // Directiva, la ficha tiene que quedarse vacia en vez de conservar lo que
        // trajera el formulario.
        methods.setValue(
          'nationalLeadershipRole',
          nationalCargo
            ? nationalCargo.idPosicionDirectiva || nationalCargo.id || nationalCargo.idCargo
            : '',
          { shouldDirty: false }
        );

        methods.setValue(
          'memberPosition',
          destCargo ? destCargo.idPosicionDirectiva || destCargo.id || destCargo.idCargo : '',
          { shouldDirty: false }
        );
      } catch {
        // Si Firestore no responde, no bloquea la edicion del miembro.
      }
    };

    loadMemberCargos();

    return () => {
      isMounted = false;
    };
  }, [
    cargosVersion,
    currentMember?.divisionId,
    currentMember?.id,
    currentMember?.idDivision,
    currentMember?.idMiembros,
    methods,
  ]);

  const {
    reset,
    watch,
    control,
    handleSubmit,
    formState: { isSubmitting, errors, isDirty },
  } = methods;

  const birthdate = watch('birthdate');
  const minBirthdate = dayjs().subtract(100, 'year');
  const maxBirthdate = dayjs().subtract(5, 'year');
  const [division, setDivision] = useState('');
  const [divisionId, setDivisionId] = useState(null);
  const idDivision = watch('idDivision');

  useEffect(() => {
    if (!birthdate) return;

    const normalizedBirthdate = dayjs(birthdate).format('YYYY-MM-DD');

    if (lastCalculatedBirthdateRef.current === normalizedBirthdate) {
      return;
    }

    const currentMemberBirthdate = currentMember?.birthDate
      ? dayjs(currentMember.birthDate).format('YYYY-MM-DD')
      : currentMember?.birth
        ? dayjs(currentMember.birth).format('YYYY-MM-DD')
        : currentMember?.dateOfBirth
          ? dayjs(currentMember.dateOfBirth).format('YYYY-MM-DD')
          : '';
    const hasCurrentDivisionData = Boolean(
      currentMember?.idDivision || currentMember?.memberDivision
    );

    if (
      !skippedInitialDivisionFetchRef.current &&
      currentMember &&
      hasCurrentDivisionData &&
      normalizedBirthdate === currentMemberBirthdate
    ) {
      skippedInitialDivisionFetchRef.current = true;
      lastCalculatedBirthdateRef.current = normalizedBirthdate;
      setDivision(currentMember?.memberDivision || '');
      setDivisionId(currentMember?.idDivision || null);
      return;
    }

    skippedInitialDivisionFetchRef.current = true;
    lastCalculatedBirthdateRef.current = normalizedBirthdate;

    const load = async () => {
      const res = await fetch(
        `/api/divisions/calculate?birthdate=${encodeURIComponent(normalizedBirthdate)}`
      );
      const data = await res.json();
      setDivision(data?.name || '');
      methods.setValue('memberDivision', data?.name || '');
      methods.setValue('idDivision', data?.id || 0);
      setDivisionId(data?.id || null);
    };

    load();
  }, [birthdate]);

  const age = birthdate ? dayjs().diff(dayjs(birthdate), 'year') : null;

  // Todos los Instructores CI son mayores de edad, asi que a un miembro menor de
  // 18 no se le muestra la seccion de Instructor CI ni se le guarda ningun dato
  // de certificacion (ver el efecto que fuerza `InstructorCertificadoCI` a 0).
  const isMinorForInstructorCI = age !== null && age < 18;

  // Menores de edad: por defecto su ocupación es "Estudiante" (solo si aún no
  // tienen una ocupación asignada).
  useEffect(() => {
    if (age === null || age >= 18) return;

    const current = methods.getValues('ocupation');
    const hasOcupation = current && (typeof current === 'object' ? current.value : current);

    if (hasOcupation) return;

    const estudiante = MEMBER_OCUPATIONS_SORTED.find((option) => option.value === 'student');

    if (estudiante) {
      methods.setValue('ocupation', estudiante, { shouldDirty: false });
    }
  }, [age, methods]);

  useEffect(() => {
    if (division && watch('memberDivision') !== division) {
      methods.setValue('memberDivision', division);
    }
  }, [division, methods, watch]);

  useEffect(() => {
    if (divisionId) {
      methods.setValue('idDivision', divisionId);
    }
  }, [divisionId, methods]);

  useEffect(() => {
    if (Array.isArray(availableDests) && availableDests.length) {
      return undefined;
    }

    const load = async () => {
      const res = await fetch('/api/dest/');
      let data = null;

      try {
        data = await res.json();
      } catch {
        console.error('ERROR PARSE DIVISION');
        return;
      }

      setDests(getRowsFromApi(data));
    };

    load();
    return undefined;
  }, [availableDests]);

  // Indice destacamento → iglesia → seccion → region con datos REALES. Es el
  // mismo que usan los organigramas, para que la entidad con la que se guarda un
  // cargo desde la ficha sea exactamente la que el organigrama consulta.
  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      const [destsApi, churches, sectionals, regionals] = await Promise.all([
        getDestsApi({ includePhotos: false }).catch(() => []),
        getChurches().catch(() => []),
        getSectionals({ includePhotos: false }).catch(() => []),
        getRegionals().catch(() => []),
      ]);

      if (cancelado) return;

      setOrgIndex(buildOrgIndex({ dests: destsApi, churches, sectionals, regionals }));
    };

    cargar();

    return () => {
      cancelado = true;
    };
  }, []);

  const values = watch();
  const firstName = watch('firstName');
  const lastName = watch('lastName');
  const memberFullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  const getDestId = (destItem) => String(destItem?.id ?? destItem?.idDestacamento ?? '');
  const getDestName = (destItem) => destItem?.name ?? destItem?.nombre ?? '';
  const getDestNumber = (destItem) => destItem?.destNumber ?? destItem?.numero ?? '';
  const selectedDestId = String(watch('destId')?.id || watch('destId') || '');
  const selectedNationalLevel = watch('nationalLeadershipLevel');
  const instructorCI = watch('InstructorCertificadoCI');
  const fechaInicioCI = watch('FechaInicioCI');
  const fechaVencimientoCI = watch('FechaVencimientoCI');

  const diasRestantesCI = calcularDiasRestantesCI(fechaVencimientoCI);
  useEffect(() => {
    if (instructorCI === 0) {
      methods.setValue('FechaInicioCI', null);
      methods.setValue('FechaVencimientoCI', null);
      methods.setValue('EstatusVigenciaCI', 'na');
      return;
    }

    if (fechaInicioCI) {
      const vencimiento = calcularVencimientoCI(fechaInicioCI);

      methods.setValue('FechaVencimientoCI', vencimiento);
      methods.setValue('EstatusVigenciaCI', calcularEstatusCI(vencimiento));
    }
  }, [fechaInicioCI, instructorCI]);

  // Menor de edad: se fuerza "no es Instructor Certificado". El efecto de arriba
  // se encarga de limpiar en cascada fecha de inicio, vencimiento y estatus, asi
  // que el dato nunca llega al guardado aunque el campo se hubiera rellenado
  // antes de corregir la fecha de nacimiento.
  useEffect(() => {
    if (!isMinorForInstructorCI) return;

    if (methods.getValues('InstructorCertificadoCI') !== 0) {
      methods.setValue('InstructorCertificadoCI', 0, { shouldDirty: false });
    }
  }, [isMinorForInstructorCI, methods]);

  useEffect(() => {
    if (!fechaVencimientoCI) {
      methods.setValue('EstatusVigenciaCI', 'na');
      return;
    }

    const hoy = dayjs();
    const vencimiento = dayjs(fechaVencimientoCI);

    if (hoy.isAfter(vencimiento)) {
      methods.setValue('EstatusVigenciaCI', 0); // Inactivo
    } else {
      methods.setValue('EstatusVigenciaCI', 1); // Activo
    }
  }, [fechaVencimientoCI]);

  const destCoordinator = LEADERSHIP_ASSIGNMENTS.find(
    (l) =>
      l.level === 'dest' &&
      l.entityId === selectedDestId &&
      l.role === 'coordinador_dest' &&
      (l.status === 'active' || !l.status)
  );

  // const coordinatorMember = members.find(
  //   (m) => m.id === destCoordinator?.memberId
  // );

  const selectedDest = dests.find((d) => getDestId(d) === selectedDestId);
  // SECCION Y REGION REALES, no las de `_mock/assets`.
  //
  // Se resolvian con `SECTIONALS.find((s) => s.id === selectedDest?.sectionalId)`,
  // y eso no podia funcionar por dos motivos: los ids del mock son cadenas
  // ('sec-este-01') mientras los reales son numeros, y el destacamento mapeado ni
  // siquiera trae `sectionalId` — la cadena real es destacamento → iglesia →
  // seccion → region. El `find` devolvia siempre undefined y `getCargoEntityId`
  // caia en su ultimo recurso, 'general': un cargo seccional o regional asignado
  // desde la ficha se guardaba en una entidad FANTASMA, invisible para todos los
  // organigramas.
  const orgPath = getMemberOrgPath(
    { idDestacamento: selectedDestId || currentMember?.destId || currentMember?.idDestacamento },
    orgIndex
  );
  const selectedSectional = orgPath.sectional;
  const selectedRegional = orgPath.regional;
  const destChurch = CHURCHES.find((c) => c.id === selectedDest?.churchId);
  const destId =
    selectedDestId || currentMember?.destId || currentMember?.dest_id || currentMember?.dest;

  const dest = selectedDest || dests.find((d) => getDestId(d) === String(destId));
  const destName =
    `${getDestName(dest)} ${getDestNumber(dest)}`.trim() || 'Destacamento desconocido';

  const sectional = SECTIONALS.find((s) => s.id === currentMember?.sectionalId);
  const sectionalName = sectional?.name;

  const regional = REGIONALS.find((r) => r.id === currentMember?.regionalId);
  const regionalName = regional?.name;

  const getCargoOptionByValue = async (value) => {
    if (!value || value === 'none') {
      return null;
    }

    const cargos = await obtenerCargosDirectivaCached({ incluirNoAsignables: false });

    return cargos.find((cargo) =>
      [cargo?.idCargo, cargo?.idCargoApi, cargo?.idPosicionDirectiva, cargo?.id, cargo?.value].some(
        (optionValue) => String(optionValue || '') === String(value)
      )
    );
  };

  const getCargoEntityId = (cargo) => {
    if (cargo?.nivel === 'destacamento') {
      return selectedDestId || currentMember?.destId || currentMember?.idDestacamento || '';
    }

    // Sin entidad NO se inventa una. El valor 'general' que habia aqui creaba
    // una directiva fantasma ("regional_general") que ningun organigrama
    // consulta: el cargo quedaba guardado y era invisible en todas partes. Es
    // preferible avisar de que falta el dato, y de eso se encarga quien llama.
    if (cargo?.nivel === 'seccional') {
      return orgPath.sectionId || currentMember?.sectionalId || '';
    }

    if (cargo?.nivel === 'regional') {
      return orgPath.regionId || currentMember?.regionalId || '';
    }

    return 'nacional';
  };

  // Retira lo que el miembro tuviera en estos niveles: las asignaciones de
  // directiva y, si el nivel incluye destacamento, su casilla del organigrama.
  // Es la operacion inversa de `saveSelectedCargo`.
  const retirarCargosDeNiveles = async ({ idMiembro, niveles = [] }) => {
    if (!idMiembro || !niveles.length) {
      return;
    }

    await Promise.all(
      niveles.map((nivel) =>
        desactivarAsignacionesDirectivaPorNivel({ idMiembro, nivel }).catch(() => 0)
      )
    );

    if (!niveles.includes(NIVELES_DIRECTIVA.destacamento)) {
      return;
    }

    const idDestacamentoMiembro =
      Number(selectedDestId || currentMember?.destId || currentMember?.idDestacamento) || null;

    if (!idDestacamentoMiembro) {
      return;
    }

    const asignacionesDest = await obtenerAsignacionesOrganigramaPorDestacamento(
      idDestacamentoMiembro
    ).catch(() => []);

    await Promise.all(
      asignacionesDest
        .filter((asignacion) => String(asignacion.idMiembros) === String(idMiembro))
        .map((asignacion) =>
          desactivarAsignacionOrganigramaDirectivaDestacamento(asignacion.id).catch(() => null)
        )
    );
  };

  const saveSelectedCargo = async ({ value, idMiembro, nivelesDelCampo = [] }) => {
    const cargo = await getCargoOptionByValue(value);

    if (!idMiembro) {
      return;
    }

    // "Ninguno" (o el campo vacio) significa RETIRAR. Antes se salia sin tocar
    // nada, asi que vaciar el desplegable no quitaba el cargo de ningun lado: la
    // ficha lo seguia mostrando y el organigrama tambien.
    if (!cargo) {
      await retirarCargosDeNiveles({ idMiembro, niveles: nivelesDelCampo });

      return;
    }

    // El id de la tabla `Cargos` se sigue guardando DENTRO de la asignacion: es
    // lo que identifica al cargo y lo que permitiria volver a cruzarlo con la API
    // si algun dia hiciera falta. Lo que ya no se hace es escribir en
    // `CargosMiembros`, que era el segundo almacen del que discrepaba la ficha.
    const idCargo = Number(cargo?.idCargoApi || cargo?.idCargo || 0);
    const fechaInicio = dayjs().format('YYYY-MM-DD');
    const idEntidad = getCargoEntityId(cargo);

    // Un cargo pertenece a una entidad concreta. Si no se puede resolver —el
    // miembro no tiene destacamento, o su destacamento no llega a seccion— se
    // aborta con un aviso en vez de guardar una asignacion que nadie veria.
    if (!idEntidad) {
      throw new Error(
        `No se pudo determinar la ${cargo.nivel === 'regional' ? 'región' : 'sección'} de ${
          currentMember?.firstName || 'este miembro'
        }. Asígnale primero un destacamento.`
      );
    }

    const asignacionGuardada = await guardarAsignacionDirectiva({
      nivel: cargo.nivel,
      idEntidad,
      nombreEntidad: '',
      idCargo,
      idMiembro,
      idPosicionDirectiva: cargo.idPosicionDirectiva || cargo.id || '',
      division: cargo.division ?? null,
      orden: cargo.orden || 1,
      origen: 'api-cargos-miembros',
      fechaInicio,
      fechaFin: null,
      activo: true,
      usuario: user,
    });

    // Baja de las asignaciones ANTERIORES. Se retiran las del propio nivel (el id
    // del documento incluye el cargo, asi que cambiar de posicion crea uno nuevo y
    // el viejo quedaba activo) y, si es un cargo de supervision, tambien las de los
    // otros niveles excluyentes: nadie es seccional y regional a la vez.
    await Promise.all(
      getNivelesARetirar(cargo.nivel).map((nivel) =>
        desactivarAsignacionesDirectivaPorNivel({
          idMiembro,
          nivel,
          conservarIdAsignacion: asignacionGuardada?.idAsignacion || '',
        }).catch((error) => {
          console.warn('[member form] no se pudo dar de baja el cargo anterior', error);
        })
      )
    );

    // La Directiva del destacamento (cuadro jerarquico) se alimenta de SU PROPIA
    // coleccion, distinta de CargosMiembros y de asignaciones_directiva. Sin
    // esto, asignar la posicion en la ficha no movia nada en el organigrama y el
    // nodo seguia mostrando su ocupante anterior (o el de ejemplo).
    const slotOrganigrama = getOrganigramaDestSlot(cargo);
    const idDestacamentoMiembro = Number(idEntidad) || null;

    if (slotOrganigrama && idDestacamentoMiembro) {
      try {
        // Primero se libera cualquier OTRA casilla que el miembro ocupara en este
        // destacamento; si no, seguiria dibujado tambien en la anterior.
        const asignacionesDest =
          await obtenerAsignacionesOrganigramaPorDestacamento(idDestacamentoMiembro);

        await Promise.all(
          asignacionesDest
            .filter(
              (asignacion) =>
                String(asignacion.idMiembros) === String(idMiembro) &&
                !(
                  asignacion.cargo === slotOrganigrama.cargo &&
                  (asignacion.division ?? null) === (slotOrganigrama.division ?? null)
                )
            )
            .map((asignacion) =>
              desactivarAsignacionOrganigramaDirectivaDestacamento(asignacion.id)
            )
        );

        await guardarAsignacionOrganigramaDirectivaDestacamento({
          idDestacamento: idDestacamentoMiembro,
          idMiembros: Number(idMiembro),
          ...slotOrganigrama,
          activo: true,
        });
      } catch (error) {
        // No se aborta el guardado del miembro: el cargo ya quedo registrado en
        // la API y en asignaciones_directiva; solo se pierde el reflejo visual.
        console.warn('[member form] no se pudo sincronizar la Directiva del destacamento', error);
      }
    }
  };

  const saveSelectedMemberCargos = async ({ idMiembro, formData }) => {
    // La misma regla que aplica el desplegable, repetida aqui a proposito: los
    // cargos de seccion, region y nacion son de supervision y los ocupan mayores
    // de edad. Comprobarlo solo en la UI dejaria la regla al alcance de cualquier
    // ruta que no pase por el campo deshabilitado. No la levanta ningun rol.
    const edadAlGuardar = formData.birthdate
      ? dayjs().diff(dayjs(formData.birthdate), 'year')
      : null;
    const esMenorDeEdad = edadAlGuardar !== null && edadAlGuardar < EDAD_MAYORIA;

    await Promise.all([
      saveSelectedCargo({
        // Un menor equivale a "Ninguno": ademas de no poder elegirlo, si arrastra
        // uno de antes se le retira al guardar.
        value: esMenorDeEdad ? '' : formData.nationalLeadershipRole,
        idMiembro,
        // Los mismos niveles que alimenta el desplegable "Cargo Nacional"
        // (ver MemberLeadershipAndOtherSection): son los que hay que limpiar si
        // se deja en "Ninguno".
        nivelesDelCampo: [
          NIVELES_DIRECTIVA.nacional,
          NIVELES_DIRECTIVA.regional,
          NIVELES_DIRECTIVA.seccional,
        ],
      }),
      saveSelectedCargo({
        value: formData.memberPosition,
        idMiembro,
        nivelesDelCampo: [NIVELES_DIRECTIVA.destacamento],
      }),
    ]);
  };

  // --- Una posicion del destacamento, un solo ocupante -------------------------
  // Cada casilla del organigrama la ocupa UNA persona. Antes de asignar un cargo
  // ya ocupado hay que avisar de a quien se va a desplazar: el guardado sobrescribe
  // la casilla, y sin este aviso el cambio ocurriria en silencio.

  // Id del miembro que ya ocupa el cargo en la misma entidad, o null si esta libre.
  // El destacamento se consulta contra el organigrama (que es quien dibuja las
  // casillas); seccion y region, contra las asignaciones de su directiva.
  const buscarIdOcupanteDelCargo = async ({ cargo, idEntidad, idMiembro }) => {
    if (cargo.nivel === NIVELES_DIRECTIVA.destacamento) {
      const slot = getOrganigramaDestSlot(cargo);
      const idDestacamento = Number(idEntidad) || null;

      if (!slot || !idDestacamento) return null;

      const asignaciones = await obtenerAsignacionesOrganigramaPorDestacamento(
        idDestacamento
      ).catch(() => []);

      return (
        asignaciones.find(
          (asignacion) =>
            asignacion.cargo === slot.cargo &&
            (asignacion.division ?? null) === (slot.division ?? null) &&
            String(asignacion.idMiembros) !== String(idMiembro)
        )?.idMiembros ?? null
      );
    }

    if (!idEntidad || idEntidad === 'general') return null;

    const asignaciones = await obtenerAsignacionesDirectiva({
      nivel: cargo.nivel,
      idEntidad,
    }).catch(() => []);

    const idPosicion = String(cargo.idPosicionDirectiva || cargo.id || '');
    const idCargoApi = Number(cargo.idCargoApi || cargo.idCargo) || null;

    return (
      asignaciones.find(
        (asignacion) =>
          (String(asignacion.idPosicionDirectiva || '') === idPosicion ||
            (idCargoApi && Number(asignacion.idCargo) === idCargoApi)) &&
          String(asignacion.idMiembro) !== String(idMiembro)
      )?.idMiembro ?? null
    );
  };

  // Ocupante actual de la posicion que se va a asignar, o null si esta libre.
  const buscarOcupanteDePosicion = async ({ value, idMiembro }) => {
    const cargo = await getCargoOptionByValue(value);

    if (!cargo || !AMBITO_CARGO_UNICO_POR_NIVEL[cargo.nivel]) {
      return null;
    }

    const idEntidad = getCargoEntityId(cargo);
    const idOcupante = await buscarIdOcupanteDelCargo({ cargo, idEntidad, idMiembro });

    if (!idOcupante) {
      return null;
    }

    // El aviso nombra a la persona: un "#322" no le dice nada a quien tiene que
    // decidir si la desplaza. Si la lista en cache es vieja y no la trae, se
    // vuelve a leer; y si aun asi no aparece o no tiene nombre, se dice "otro
    // miembro" antes que ensenar el numero interno.
    const buscarOcupanteEnLista = (lista) =>
      (Array.isArray(lista) ? lista : []).find(
        (item) => String(item?.id ?? item?.idMiembros ?? '') === String(idOcupante)
      );

    let ocupante = buscarOcupanteEnLista(await getMembers().catch(() => []));

    if (!ocupante) {
      invalidateMembersCache();
      ocupante = buscarOcupanteEnLista(await getMembers().catch(() => []));
    }

    const nombreOcupante =
      getMemberFullName(ocupante) ||
      ocupante?.memberId ||
      ocupante?.codigoMiembro ||
      'otro miembro';

    return {
      idMiembros: idOcupante,
      nombre: nombreOcupante,
      cargoLabel: cargo.nombreCargo || cargo.nombre || 'este cargo',
      division: cargo.nombreDivision || '',
      ambito: AMBITO_CARGO_UNICO_POR_NIVEL[cargo.nivel],
      idCargoApi: Number(cargo.idCargoApi || cargo.idCargo) || null,
      nivel: cargo.nivel,
    };
  };

  // Retira el cargo al ocupante anterior en los tres almacenes. La casilla del
  // organigrama se sobrescribe sola (su id es dest+cargo+division), pero en la API
  // y en asignacionesDirectiva el cargo se le quedaria pegado, y la lista de
  // miembros mostraria a dos personas con la misma posicion.
  const retirarPosicionAlOcupante = async ({ idMiembros, nivel }) => {
    if (!idMiembros || !nivel) return;

    await desactivarAsignacionesDirectivaPorNivel({ idMiembro: idMiembros, nivel }).catch(
      () => null
    );
  };

  const leaderships = LEADERSHIP_ASSIGNMENTS.filter(
    (l) =>
      (l.memberId === currentMember?.id || l.member_id === currentMember?.id) &&
      (l.status === 'active' || !l.status)
  );

  const leadership = leaderships[0];
  const nationalLeadership = leaderships.find((l) => l.level === 'national');
  const destLeadership = leaderships.find((l) => l.level === 'dest');
  let memberDestText = destName ? `Miembro de ${destName}` : null;

  const roleInfo = _allLeadershipRoles.find((r) => r.value === leadership?.role);

  const leadershipTexts = leaderships
    .map((l) => {
      const role = _allLeadershipRoles.find((r) => r.value === l.role);
      if (!role) return null;

      if (l.level === 'dest') {
        const leadershipDest = dests.find((d) => getDestId(d) === String(l.entityId));
        const destDisplayName =
          `${getDestName(leadershipDest)} ${getDestNumber(leadershipDest)}`.trim() ||
          `${destName || ''}`;

        return (
          <>
            {role.label.replace(' Destacamento', '')} de{' '}
            <UnderlineLink
              href={`/dashboard/level/dest/${l.entityId}/edit`}
              sx={{ color: 'text.primary' }}
            >
              {destDisplayName}
            </UnderlineLink>
          </>
        );
      }

      if (l.level === 'sectional') {
        const sec = SECTIONALS.find((s) => s.id === l.entityId);

        return (
          <>
            {role.label}:{' '}
            <UnderlineLink
              href={`/dashboard/level/sectional/${l.entityId}/edit`}
              sx={{ color: 'text.primary' }}
            >
              {sec?.name}
            </UnderlineLink>
          </>
        );
      }

      if (l.level === 'regional') {
        const reg = REGIONALS.find((r) => r.id === l.entityId);

        return (
          <>
            {role.label}:{' '}
            <UnderlineLink
              href={`/dashboard/level/regional/${l.entityId}/edit`}
              sx={{ color: 'text.primary' }}
            >
              {reg?.name}
            </UnderlineLink>
          </>
        );
      }

      if (l.level === 'national') {
        return role.label;
      }

      return null;
    })
    .filter(Boolean);

  const optimizeMemberPhoto = async (file) => {
    if (!file || !(file instanceof File)) {
      return { file, info: null };
    }

    if (file.__optimizedForUpload) {
      return { file, info: file.__optimizationInfo || null };
    }

    if (!String(file.type || '').startsWith('image/')) {
      throw new Error('Solo se permiten archivos de imagen para la foto del miembro.');
    }

    const originalSize = file.__originalSize || file.size || 0;
    const optimizedFile = await optimizeImageFile(file, MEMBER_PHOTO_OPTIMIZE_OPTIONS);

    if (optimizedFile instanceof File) {
      Object.defineProperty(optimizedFile, '__originalSize', {
        value: originalSize,
        configurable: true,
      });
    }

    const info = {
      originalSize,
      optimizedSize: optimizedFile?.size || file.size || 0,
    };

    setPhotoUploadErrorMessage('');

    return { file: optimizedFile || file, info };
  };

  const registrarHistorialFotoMiembro = ({ idMiembros, urlFoto }) => {
    registrarCambiosHistorialMiembro({
      idMiembro: idMiembros,
      codigoMiembro: currentMember?.memberId || currentMember?.codigoMiembro || '',
      nombreMiembro: memberFullName,
      modulo: 'Información general',
      antes: { fotoPerfil: currentMember?.avatarUrl || '' },
      despues: { fotoPerfil: urlFoto || '' },
      campos: { fotoPerfil: 'Foto de perfil' },
      usuario: user,
      metadata: {
        origen: 'member-create-edit-form',
        accion: 'foto_perfil',
      },
    }).catch((historyError) => {
      console.error('[member form] member photo history failed', historyError);
    });
  };

  const uploadMemberPhoto = async ({ file, idMiembros, showSuccess = true }) => {
    if (!file || !(file instanceof File)) {
      return null;
    }

    if (!idMiembros) {
      throw new Error('No se pudo identificar el miembro para subir la foto.');
    }

    const { file: optimizedFile, info } = await optimizeMemberPhoto(file);

    const photo = await subirFotoEntidad({
      file: optimizedFile,
      tipoEntidad: 'miembro',
      idEntidad: idMiembros,
      tipoFoto: 'perfil',
      subidoPor: user?.uid || user?.id || null,
    });

    registrarHistorialFotoMiembro({ idMiembros, urlFoto: photo.urlFoto });

    if (showSuccess) {
      toast.success(getImageOptimizationMessage(info));
    }

    return {
      urlFoto: photo.urlFoto,
      optimizationInfo: info,
    };
  };

  const handleUploadMemberPhoto = async (acceptedFiles) => {
    const file = acceptedFiles?.[0];
    const idMiembros = currentMember?.id;

    if (!file) {
      return null;
    }

    try {
      setUploadingPhoto(true);

      // ALTA: la persona todavia no tiene id, pero la imagen no tiene por que
      // esperar. Se sube en cuanto se elige —mientras se termina de llenar el
      // formulario— bajo un id provisional, y al guardar solo queda apuntarla al
      // miembro recien creado. Antes se guardaba el archivo en el formulario y
      // toda la subida ocurria DESPUES de pulsar Guardar, que es lo que hacia
      // larga la espera.
      if (!currentMember || !idMiembros) {
        const { file: optimizedFile, info } = await optimizeMemberPhoto(file);
        const pendiente = await subirFotoMiembroPendiente({
          file: optimizedFile,
          subidoPor: user?.uid || user?.id || null,
        });

        fotoPendienteRef.current = {
          rutaArchivo: pendiente.rutaArchivo,
          urlFoto: pendiente.urlFoto,
          optimizationInfo: info,
        };

        toast.success(getImageOptimizationMessage(info));

        // Se devuelve la URL ya subida: el avatar se pinta desde Storage, igual
        // que al editar, y no desde un archivo en memoria.
        return pendiente.urlFoto;
      }

      const result = await uploadMemberPhoto({
        file,
        idMiembros,
      });

      return result?.urlFoto || null;
    } catch (error) {
      console.error('[member form] photo upload failed', error);
      crearNotificacionErrorSubidaArchivoImagen({
        archivo: file,
        error,
        contexto: 'foto_miembro',
        usuario: user,
      }).catch((notificationError) => {
        console.error('[member form] upload error notification failed', notificationError);
      });
      toast.error(error.message || 'No se pudo subir la foto.');

      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoDropRejected = () => {
    const message = 'Solo se permiten imágenes en formato jpeg, jpg, png o gif.';
    setPhotoUploadErrorMessage(message);
    toast.error(message);
  };

  const onSubmit = handleSubmit(
    async (data) => {
      setFormErrorMessage(false);

      const memberUUID = currentMember?.id || crypto.randomUUID();
      const formData = data;

      // Cada posición de destacamento, sección y región la ocupa una sola persona.
      // Si alguno de los cargos elegidos ya lo tiene otro miembro, se pide
      // confirmación ANTES de guardar nada: al aceptar se le retira a esa persona;
      // al cancelar no se toca nada. Se revisan los dos campos de cargo del
      // formulario (el del destacamento y el de nivel superior).
      const idMiembroActual = currentMember?.id || currentMember?.idMiembros || null;
      const ocupantes = (
        await Promise.all(
          [formData.memberPosition, formData.nationalLeadershipRole].map((value) =>
            buscarOcupanteDePosicion({ value, idMiembro: idMiembroActual }).catch(() => null)
          )
        )
      ).filter(Boolean);

      for (const ocupante of ocupantes) {
        // En serie: cada aviso espera la decisión del anterior.

        const confirmado = await pedirConfirmacionDeReemplazo(ocupante);

        if (!confirmado) {
          return;
        }

        await retirarPosicionAlOcupante(ocupante).catch((error) => {
          console.warn('[member form] no se pudo retirar la posición al ocupante', error);
        });
      }

      // El correo no puede repetirse: identifica a la persona para recuperar la
      // clave y para entrar. Se comprueba ANTES de arrancar el guardado —que al
      // editar corre por detras y ya habria cantado "actualizado"— y contra la
      // lista recien leida, no contra la que haya en pantalla.
      if (formData.email) {
        const listaMiembros = await getMembers().catch(() => []);
        const duplicado = buscarMiembroConCorreo(listaMiembros, formData.email, currentMember?.id);

        if (duplicado) {
          const nombreDuplicado =
            `${duplicado.firstName || ''} ${duplicado.lastName || ''}`.trim() ||
            getCodigoMiembro(duplicado) ||
            'otro miembro';
          const mensaje = `Ese correo ya lo usa ${nombreDuplicado}.`;

          methods.setError('email', { type: 'manual', message: mensaje });
          toast.error(mensaje);
          setFormErrorMessage(true);

          return;
        }
      }

      // GUARDADO EN SEGUNDO PLANO (solo al EDITAR).
      //
      // La escritura arranca aqui pero no se espera: la interfaz se libera a los
      // RETARDO_GUARDADO_MS y el boton deja de girar aunque la base de datos
      // tarde mas. Si algo falla, el aviso llega cuando llegue el fallo.
      //
      // Al CREAR si se espera de verdad: despues vienen la redireccion, el alta
      // del usuario de acceso y las notificaciones, y soltar la pantalla a medias
      // dejaria al miembro sin cuenta y al usuario en otra pagina sin saberlo.
      const tareaGuardado = (async () => {
        try {
          const submittedFirstName = formData.firstName;
          const submittedLastName = formData.lastName;
          const genderValue =
            typeof formData.gender === 'string' ? formData.gender : formData.gender?.value;

          // El codigo no depende del destacamento: es una sola cuenta para toda
          // la organizacion (EDR-10001, EDR-10002...).
          const codigoMiembro = currentMember?.memberId || (await generateMemberId());
          const legacyCargoInstitucional = Number(formData.nationalLeadershipRole);
          // Se recalcula con la fecha que se esta enviando (no con la del render),
          // para que el bloqueo de Instructor CI valga aunque acaben de cambiarla.
          const edadAlGuardar = formData.birthdate
            ? dayjs().diff(dayjs(formData.birthdate), 'year')
            : null;
          const esMenorAlGuardar = edadAlGuardar !== null && edadAlGuardar < 18;

          if (!currentMember) {
            const existingMembers = await getMembers();

            if (hasDuplicatedCodigoMiembro(existingMembers, codigoMiembro, currentMember?.id)) {
              toast.error(
                `El codigo de miembro ${codigoMiembro} ya existe. No se creo el miembro.`
              );
              return;
            }
          }

          const provinces = provinciasData;
          const municipios = municipiosData.map((m, index) => ({
            ...m,
            id: index + 1,
          }));
          const sectores = barriosData;
          const buildDireccion = () => {
            const province = provinces.find((p) => String(p.id) === formData.provinceId)?.nombre;
            const municipio = municipios.find((m) => String(m.id) === formData.municipioId)?.nombre;
            const sector = sectores.find((s) => String(s.id) === formData.sectorId)?.nombre;

            return [province, municipio, sector, formData.street].filter(Boolean).join(', ');
          };

          const payload = {
            idMiembros: currentMember?.id || 0,
            codigoMiembro,
            nombres: submittedFirstName,
            apellidos: submittedLastName,
            genero:
              genderValue === 'Masculino'
                ? 'M'
                : genderValue === 'Femenino'
                  ? 'F'
                  : genderValue || null,
            fechaNacimiento: formData.birthdate
              ? dayjs(formData.birthdate).format('YYYY-MM-DD')
              : null,
            sizeCamisas: formData.shirtSize || null,
            ocupacion: getOccupationValue(formData.ocupation) || null,
            fechaCreacion:
              currentMember?.createdAt ||
              currentMember?.fechaCreacion ||
              currentMember?.created_at ||
              new Date().toISOString(),
            idDestacamento: selectedDestId ? Number(selectedDestId) : 0,
            telefono: formData.phoneNumber || '',
            direccion: buildDireccion(formData) || null,
            correo: formData.email || null,
            idCargoLocal: null,
            idCargoInstitucional:
              Number.isFinite(legacyCargoInstitucional) && legacyCargoInstitucional > 0
                ? legacyCargoInstitucional
                : null,
            idDivision: formData.idDivision ? Number(formData.idDivision) : 0,
            // Un menor de edad nunca es Instructor CI: se guarda siempre en blanco,
            // aunque el formulario trajera valores previos.
            instructorCertificadoCi: esMenorAlGuardar
              ? false
              : formData.InstructorCertificadoCI === 1
                ? true
                : formData.InstructorCertificadoCI === 0
                  ? false
                  : null,

            estatusVigenciaCi:
              esMenorAlGuardar || formData.EstatusVigenciaCI === 'na'
                ? null
                : formData.EstatusVigenciaCI === 1
                  ? true
                  : formData.EstatusVigenciaCI === 0
                    ? false
                    : null,
            fechaInicioCertificado:
              !esMenorAlGuardar && formData.FechaInicioCI
                ? dayjs(formData.FechaInicioCI).format('YYYY-MM-DD')
                : null,
            fechaFinCertificado:
              !esMenorAlGuardar && formData.FechaVencimientoCI
                ? dayjs(formData.FechaVencimientoCI).format('YYYY-MM-DD')
                : null,
          };

          const res = await fetch(currentMember ? '/api/members/put/' : '/api/members/post/', {
            method: currentMember ? 'PUT' : 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          const text = await res.text();
          let responseData;
          try {
            responseData = text ? JSON.parse(text) : {};
          } catch {
            console.error('RAW RESPONSE =>', text);
            responseData = {};
          }

          if (!res.ok) {
            throw new Error(
              responseData?.message ||
                responseData?.Message ||
                responseData?.error ||
                text ||
                `Error de red o servidor (${res.status})`
            );
          }

          registrarAuditoriaSilenciosa({
            modulo: 'miembros',
            accion: currentMember ? 'miembro_actualizado' : 'miembro_creado',
            descripcion: currentMember
              ? `Se actualizó el miembro ${submittedFirstName} ${submittedLastName}.`
              : `Se creó el miembro ${submittedFirstName} ${submittedLastName}.`,
            entidad: {
              tipo: 'miembro',
              id: currentMember?.id || responseData?.idMiembros || responseData?.data?.idMiembros,
              nombre: `${submittedFirstName} ${submittedLastName}`.trim(),
              ruta: currentMember
                ? `/dashboard/level/member/${currentMember?.id || ''}/edit`
                : '/dashboard/level/member',
            },
            antes: currentMember ? mapCurrentMemberToHistoryPayload(currentMember) : null,
            despues: payload,
            realizadoPor: user,
            origen: 'miembros',
          });

          const completedMessage = (responseData?.message || responseData?.Message)
            ?.toLowerCase()
            .includes('completada');

          if (
            (responseData?.success === false || responseData?.Success === false) &&
            !completedMessage
          ) {
            console.error('API ERROR =>', responseData);
            throw new Error(
              responseData?.message || responseData?.Message || 'Error guardando en API'
            );
          }

          // Al editar, el aviso de exito ya salio al liberar la pantalla; repetirlo
          // aqui lo mostraria dos veces.
          if (!currentMember) {
            toast.success(`Miembro ${codigoMiembro} creado!`);
          }

          let savedMember = null;
          let authCredentials = null;
          let idCreado =
            responseData?.idMiembros ||
            responseData?.data?.idMiembros ||
            responseData?.Data?.idMiembros ||
            null;

          if (!currentMember) {
            // Plan B para el id. La ruta de alta ya lo devuelve, asi que esto
            // casi nunca corre: releer el listado cuesta una vuelta completa al
            // API por intento (~2 s cada una) y era lo que mas alargaba el
            // guardado. Sin id no hay donde colgar la foto ni los cargos.
            const buscarMiembroCreado = async () => {
              for (let intento = 0; intento < 3; intento += 1) {
                if (intento > 0) {
                  await esperar(600);
                }

                invalidateMembersCache();

                const lista = await getMembers();
                const encontrado = (Array.isArray(lista) ? lista : []).find(
                  (member) =>
                    normalizeMemberUsername(
                      member?.memberId || member?.codigoMiembro || member?.id
                    ) === normalizeMemberUsername(codigoMiembro)
                );

                if (encontrado) return encontrado;
              }

              return null;
            };

            if (!idCreado) {
              savedMember = await buscarMiembroCreado();
              idCreado = savedMember?.id || null;
            }

            // El listado se relee solo, ya sin este miembro dentro: se marca la
            // cache como vieja para que la lista lo muestre al volver.
            invalidateMembersCache();

            try {
              authCredentials = await createFirebaseAuthForMember({
                codigoMiembro,
                firstName: submittedFirstName,
                lastName: submittedLastName,
                destId: selectedDestId,
                memberId: idCreado,
              });
            } catch (authError) {
              if (authError?.code === 'auth/email-already-in-use') {
                console.warn('[member form] firebase auth user already exists', authError);
              } else {
                console.error('[member form] firebase auth user creation failed', authError);
                toast.error(
                  'Miembro creado, pero no se pudo crear su usuario de inicio de sesi?n.'
                );
              }
            }

            // Los avisos van POR DETRAS: son varias escrituras en Firestore y
            // nada de lo que viene despues depende de ellas. Esperarlas solo
            // servia para retrasar la vuelta al listado.
            (async () => {
              try {
                await crearNotificacionMiembroCreado({
                  miembro: savedMember || {
                    id: idCreado,
                    memberId: codigoMiembro,
                    firstName: submittedFirstName,
                    lastName: submittedLastName,
                    phoneNumber: formData.phoneNumber || '',
                    email: formData.email || '',
                    status: formData.status ?? 'active',
                  },
                  usuario: user,
                });

                if (authCredentials) {
                  await crearNotificacionCuentaCreada({
                    cuenta: {
                      ...savedMember,
                      idMiembros: savedMember?.id || idCreado || null,
                      codigoMiembro,
                      uid: authCredentials.uid,
                      displayName: `${submittedFirstName} ${submittedLastName}`.trim(),
                      email: authCredentials.emailFake,
                    },
                    usuario: user,
                  });
                }

                window.dispatchEvent(new Event('notificaciones:actualizar'));
              } catch (notificationError) {
                console.error('[member form] member notification failed', notificationError);
              }
            })();
          } else {
            try {
              await crearNotificacionMiembroActualizado({
                miembro: {
                  ...currentMember,
                  ...payload,
                  id: currentMember?.id || currentMember?.idMiembros,
                  memberId: codigoMiembro,
                  firstName: submittedFirstName,
                  lastName: submittedLastName,
                  phoneNumber: formData.phoneNumber || '',
                  email: formData.email || '',
                  status: formData.status ?? currentMember?.status ?? 'active',
                },
                usuario: user,
              });
            } catch (notificationError) {
              console.error('[member form] member update notification failed', notificationError);
            }

            // Guardado directo de un coordinador: avisar al OTRO coordinador
            // (nunca a sí mismo).
            if (isCoordinador) {
              const segmentoCoord = currentMember?.memberId
                ? encodeURIComponent(currentMember.memberId)
                : currentMember?.id;

              notificarCoordinadoresActualizacionDirecta({
                member: currentMember,
                actorId: user?.uid || user?.id || 'sistema',
                actorIdMiembros: user?.idMiembros ?? user?.id ?? null,
                actorNombre: user?.displayName || 'Un coordinador',
                moduloTexto: 'la información general',
                ruta: segmentoCoord
                  ? `/dashboard/level/member/${segmentoCoord}/edit`
                  : '/dashboard',
              }).catch(() => null);
            }
          }

          const historyMemberId = currentMember?.id || idCreado;

          if (historyMemberId) {
            registrarCambiosHistorialMiembro({
              idMiembro: historyMemberId,
              codigoMiembro,
              nombreMiembro: `${submittedFirstName} ${submittedLastName}`.trim(),
              modulo: 'Información general',
              antes: currentMember ? mapCurrentMemberToHistoryPayload(currentMember) : {},
              despues: payload,
              campos: MEMBER_HISTORY_FIELDS,
              usuario: user,
              metadata: {
                origen: 'member-create-edit-form',
                accion: currentMember ? 'actualizacion' : 'creacion',
              },
            }).catch((historyError) => {
              console.error('[member form] member history failed', historyError);
            });

            try {
              await saveSelectedMemberCargos({
                idMiembro: historyMemberId,
                formData,
              });
            } catch (cargoError) {
              toast.error(cargoError.message || 'No se pudo guardar el cargo del miembro.');
            }
          }

          const fotoPendiente = fotoPendienteRef.current;
          const selectedPhoto = formData.avatarUrl ?? methods.getValues('avatarUrl');

          if (!currentMember && idCreado && fotoPendiente?.urlFoto) {
            // La imagen ya esta en Storage desde que se eligio: aqui solo se
            // apunta al miembro, que es UNA escritura.
            try {
              await registrarFotoEntidadSubida({
                tipoEntidad: 'miembro',
                idEntidad: idCreado,
                tipoFoto: 'perfil',
                rutaArchivo: fotoPendiente.rutaArchivo,
                urlFoto: fotoPendiente.urlFoto,
                subidoPor: user?.uid || user?.id || null,
              });

              registrarHistorialFotoMiembro({
                idMiembros: idCreado,
                urlFoto: fotoPendiente.urlFoto,
              });

              fotoPendienteRef.current = null;
            } catch (photoError) {
              console.error('[member form] photo link failed', photoError);
              toast.error(photoError.message || 'Miembro creado, pero no se pudo guardar la foto.');
            }
          } else if (!currentMember && selectedPhoto instanceof File) {
            // Plan B: la subida al elegir la foto fallo y el archivo se quedo en
            // el formulario. Se sube ahora, con el miembro ya creado.
            try {
              setUploadingPhoto(true);

              const uploadedPhoto = await uploadMemberPhoto({
                file: selectedPhoto,
                idMiembros: idCreado,
                showSuccess: false,
              });
              const uploadedPhotoUrl = uploadedPhoto?.urlFoto;

              if (uploadedPhotoUrl) {
                methods.setValue('avatarUrl', uploadedPhotoUrl, { shouldValidate: true });
                toast.success(getImageOptimizationMessage(uploadedPhoto?.optimizationInfo));
              }
            } catch (photoError) {
              console.error('[member form] deferred photo upload failed', photoError);
              toast.error(photoError.message || 'Miembro creado, pero no se pudo subir la foto.');
            } finally {
              setUploadingPhoto(false);
            }
          }

          if (currentMember) {
            const updatedMembers = await getMembers();
            const updatedMember = (Array.isArray(updatedMembers) ? updatedMembers : []).find(
              (m) => String(m.id) === String(currentMember?.id)
            );

            if (updatedMember) {
              reset(mapMemberToForm(updatedMember));
            }

            // Despues del reset, para que el cargo recien guardado se relea de la
            // API y vuelva a pintarse. Va fuera del `if`: el cargo pudo cambiar
            // aunque la ficha del miembro no se haya podido recuperar.
            setCargosVersion((version) => version + 1);
          } else {
            router.push(paths.dashboard.level.member.root);
          }
        } catch (error) {
          toast.error(error.message || 'Error guardando en API');
        }
      })();

      if (currentMember) {
        // La pantalla vuelve a la normalidad aqui, pase lo que pase con la
        // escritura. El "exito" se anuncia en este punto y no cuando termine de
        // guardarse: es el compromiso de mostrar el guardado como instantaneo.
        await esperar(RETARDO_GUARDADO_MS);
        toast.success('Actualizacion exitosa!');

        return;
      }

      await tareaGuardado;
    },

    (validationErrors) => {
      if (Object.keys(validationErrors).length > 0) {
        // Al crear, el campo que falla puede estar en el paso anterior: sin esto
        // el aviso salta pero el error no se ve por ninguna parte, y parece que
        // el boton no hace nada.
        if (
          !currentMember &&
          Object.keys(validationErrors).some((campo) => CAMPOS_PASO_1.has(campo))
        ) {
          setStep(1);
        }

        setFormErrorMessage(true);

        setTimeout(() => {
          setFormErrorMessage(false);
        }, 5000);
      }
    }
  );

  // Carga la solicitud de cambio pendiente del miembro (si existe). El modal se
  // abre automaticamente cuando se llega desde la notificacion (?solicitud=<id>);
  // en cualquier otro caso queda disponible el boton "Cambios solicitados
  // pendientes". No aplica a los lideres de grupo (son quienes las envian).
  useEffect(() => {
    let activo = true;

    if (!currentMember?.id) {
      return undefined;
    }

    (async () => {
      try {
        const solicitud = solicitudIdFromUrl
          ? await obtenerSolicitudCambioPorId(solicitudIdFromUrl)
          : await obtenerSolicitudPendientePorMiembro(Number(currentMember.id));

        if (!activo) return;

        if (
          !solicitud ||
          solicitud.estado !== ESTADOS_SOLICITUD_CAMBIO.pendiente ||
          getModuloSolicitud(solicitud) !== MODULOS_SOLICITUD_CAMBIO.general
        ) {
          return;
        }

        // El cargo solicitante solo puede verla (solo lectura); quien tenga el
        // permiso `miembros.aprobar_cambios` la revisa/edita y, si llega desde la
        // notificacion, se abre el modal.
        if (lockGroupLeaderFields) {
          setLeaderPendingRequest(solicitud);
        } else if (puedeAprobarCambios) {
          setChangeRequest(solicitud);
          setChangeRequestOpen(Boolean(solicitudIdFromUrl));
        }
      } catch (error) {
        console.error('[member form] no se pudo cargar la solicitud de cambio', error);
      }
    })();

    return () => {
      activo = false;
    };
  }, [solicitudIdFromUrl, lockGroupLeaderFields, puedeAprobarCambios, currentMember?.id]);

  const cerrarSolicitud = () => {
    setChangeRequestOpen(false);

    const segmento = currentMember?.memberId
      ? encodeURIComponent(currentMember.memberId)
      : currentMember?.id;

    if (segmento) {
      router.replace(`/dashboard/level/member/${segmento}/edit`);
    }
  };

  // Al pulsar "Ver" en la notificacion de resultado (?resultado=<id>), el
  // solicitante ve el detalle de que campos se aprobaron, editaron o rechazaron.
  useEffect(() => {
    let activo = true;

    if (!resultadoIdFromUrl) {
      return undefined;
    }

    (async () => {
      try {
        const solicitud = await obtenerSolicitudCambioPorId(resultadoIdFromUrl);

        if (!activo || !solicitud) return;

        setChangeResult(solicitud);
        setChangeResultOpen(true);
      } catch (error) {
        console.error('[member form] no se pudo cargar el resultado de la solicitud', error);
      }
    })();

    return () => {
      activo = false;
    };
  }, [resultadoIdFromUrl]);

  const cerrarResultado = () => {
    setChangeResultOpen(false);

    const segmento = currentMember?.memberId
      ? encodeURIComponent(currentMember.memberId)
      : currentMember?.id;

    if (segmento) {
      router.replace(`/dashboard/level/member/${segmento}/edit`);
    }
  };

  const notificarResultadoAlSolicitante = async (solicitud, decision) => {
    if (!solicitud?.solicitadoPorUid) return;

    const resultado = clasificarResultadoSolicitud({ resultadoCampos: decision });
    const etiqueta = RESULTADO_SOLICITUD_LABEL[resultado] || 'Resuelto';

    // El lider de grupo tambien es sesion admin: se notifica como admin. La ruta
    // lleva ?resultado=<id> para que al pulsar "Ver" se abra el modal de detalle.
    await crearNotificacionAdmin({
      tipoNotificacion: 'resultado_cambio_miembro',
      modulo: 'miembros',
      titulo: 'Resultado de tu solicitud',
      mensaje: `Tu solicitud de cambios en ${solicitud.nombreMiembro || 'un miembro'}: ${etiqueta.toLowerCase()}.`,
      prioridad: 'informativa',
      entidadTipo: 'miembro',
      entidadId: String(solicitud.idMiembros || ''),
      // Se usa el codigo del miembro (segmento canonico) para que el layout no
      // tenga que redirigir y no se pierda el query ?resultado=.
      ruta: solicitud.codigoMiembro
        ? `/dashboard/level/member/${encodeURIComponent(solicitud.codigoMiembro)}/edit?resultado=${solicitud.id}`
        : solicitud.idMiembros
          ? `/dashboard/level/member/${solicitud.idMiembros}/edit?resultado=${solicitud.id}`
          : '/dashboard',
      etiquetaAccion: 'Ver',
      actorId: user?.uid || user?.id || 'sistema',
      actorNombre: user?.displayName || 'Coordinador de Destacamento',
      idsDestinatariosPrecalculados: [String(solicitud.solicitadoPorUid)],
    }).catch((error) => console.warn('[member form] no se pudo notificar al solicitante', error));
  };

  const handleResolveChangeRequest = async (decision = []) => {
    if (!changeRequest) return;

    const aprobados = decision.filter((item) => item.aprobado);
    setResolvingChangeRequest(true);

    try {
      if (aprobados.length) {
        aprobados.forEach((item) => {
          methods.setValue(item.campo, item.valorFinal, {
            shouldDirty: true,
            shouldValidate: true,
          });
        });

        // Reutiliza el guardado normal del formulario para persistir los cambios.
        await onSubmit();
      }

      const estado = !aprobados.length
        ? ESTADOS_SOLICITUD_CAMBIO.rechazada
        : aprobados.length === decision.length
          ? ESTADOS_SOLICITUD_CAMBIO.aprobada
          : ESTADOS_SOLICITUD_CAMBIO.parcial;

      await resolverSolicitudCambioMiembro(changeRequest.id, {
        estado,
        resultadoCampos: decision,
        resueltoPorUid: user?.uid || user?.id || '',
        resueltoPorNombre: user?.displayName || 'Coordinador de Destacamento',
      });

      await notificarResultadoAlSolicitante(changeRequest, decision);

      toast.success(
        estado === ESTADOS_SOLICITUD_CAMBIO.rechazada
          ? 'Solicitud rechazada.'
          : 'Cambios aplicados.'
      );

      setChangeRequest(null);
      cerrarSolicitud();
    } catch (error) {
      console.error('[member form] no se pudo resolver la solicitud', error);
      toast.error('No se pudo procesar la solicitud.');
    } finally {
      setResolvingChangeRequest(false);
    }
  };

  return (
    <Form methods={methods} onSubmit={readOnlyEffective ? undefined : onSubmit}>
      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ pt: 10, pb: 5, px: 3 }}>
              {currentMember && (
                <Label
                  color={
                    (values.status === 'active' && 'success') ||
                    (values.status === 'banned' && 'error') ||
                    'warning'
                  }
                  sx={{ position: 'absolute', top: 24, right: 24 }}
                >
                  {values.status}
                </Label>
              )}

              <Box sx={{ mb: 5 }}>
                <Field.UploadAvatar
                  name="avatarUrl"
                  loading={uploadingPhoto}
                  disabled={uploadingPhoto}
                  readOnly={!canUploadMemberPhoto}
                  onDrop={handleUploadMemberPhoto}
                  optimizationToast={false}
                  onDropRejected={handlePhotoDropRejected}
                  hideFilesRejected
                  helperText={
                    <>
                      <Typography
                        variant="caption"
                        sx={{
                          mt: 3,
                          mx: 'auto',
                          display: 'block',
                          textAlign: 'center',
                          color: 'text.disabled',
                        }}
                      >
                        Permitido *.jpeg, *.jpg, *.png, *.gif
                        <br /> la imagen se optimiza al cargar.
                      </Typography>

                      {!!photoUploadErrorMessage && (
                        <Typography
                          variant="caption"
                          sx={{
                            mt: 1,
                            mx: 'auto',
                            display: 'block',
                            textAlign: 'center',
                            color: 'error.main',
                            fontWeight: 700,
                          }}
                        >
                          {photoUploadErrorMessage}
                        </Typography>
                      )}

                      <ContextInfo
                        items={[
                          {
                            show: isCreateView && !!memberFullName,
                            text: memberFullName,
                            variant: 'subtitle1',
                            bold: true,
                            mt: 1,
                            color: 'text.primary',
                          },
                          {
                            show: !isCreateView && !!currentMember?.memberId,
                            text: `Miembro ${currentMember?.memberId}`,
                            // Se copia el codigo solo, sin la palabra "Miembro":
                            // es lo que se pega en el acceso o en un mensaje.
                            copiar: currentMember?.memberId,
                            // Mismo aviso que en la Directiva, y con las mismas
                            // reglas: solo lo ven los cargos del destacamento y
                            // los administradores.
                            aviso:
                              esPastor && puedeVerAvisoDatosPendientes(user)
                                ? getAvisoDatosPendientes(currentMember)
                                : '',
                          },
                          {
                            show: isCreateView && !!selectedDest?.name,
                            text: `pertenecer? a ${`${selectedDest?.name || ''} ${selectedDest?.destNumber || ''}`.trim()}`,
                          },
                          {
                            show: isCreateView && !!destChurch?.name,
                            text: destChurch?.name,
                          },
                          {
                            show: isCreateView && !!selectedSectional?.name,
                            text: `Secci?n ${selectedSectional?.name}`,
                          },
                          {
                            show: isCreateView && !!selectedRegional?.name,
                            text: selectedRegional?.name,
                          },
                        ]}
                      />

                      {/* Coordinador de Dest... */}
                      {memberDestText && !destLeadership && (
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 1,
                            mx: 'auto',
                            display: 'block',
                            textAlign: 'center',
                          }}
                        >
                          {memberDestText.includes(destName) ? (
                            <>
                              {memberDestText.replace(destName, '')}
                              <UnderlineLink
                                href={`/dashboard/level/dest/${destId}/edit`}
                                sx={{ color: 'text.primary' }}
                              >
                                {destName}
                              </UnderlineLink>
                            </>
                          ) : (
                            memberDestText
                          )}
                        </Typography>
                      )}

                      {!isCreateView &&
                        leadershipTexts.map((text, index) => (
                          <Typography
                            key={`${text}-${index}`}
                            variant="body2"
                            sx={{
                              mt: index === 0 ? 0.5 : 0.3,
                              mx: 'auto',
                              display: 'block',
                              textAlign: 'center',
                            }}
                          >
                            {text}
                          </Typography>
                        ))}
                    </>
                  }
                />
              </Box>

              {currentMember && (
                <FormControlLabel
                  labelPlacement="start"
                  control={
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          {...field}
                          checked={field.value !== 'active'}
                          onChange={(event) =>
                            field.onChange(event.target.checked ? 'banned' : 'active')
                          }
                        />
                      )}
                    />
                  }
                  label={
                    <>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        Desarrollo
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Lorem ipsum dolor sit.
                      </Typography>
                    </>
                  }
                  sx={{
                    mx: 0,
                    mb: 3,
                    width: 1,
                    justifyContent: 'space-between',
                  }}
                />
              )}
              {currentMember && (
                <Stack sx={{ mt: 3, alignItems: 'center', justifyContent: 'center' }}>
                  <MemberInfoPdfMenu
                    values={values}
                    memberCode={currentMember?.memberId}
                    fullName={memberFullName}
                    destName={destName}
                    avatarUrl={currentMember?.avatarUrl}
                    // El PDF hereda el mismo enmascarado que la ficha en pantalla.
                    masked={maskSensitive}
                    maskContact={maskContact}
                    maskBirthdate={maskBirthdate}
                  />
                </Stack>
              )}
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ p: 3 }}>
              <Box
                sx={{
                  rowGap: 3,
                  columnGap: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
                }}
              >
                {(!isCreateView || step === 1) && (
                  <MemberGeneralSection
                    age={age}
                    division={division}
                    isCreateView={isCreateView}
                    control={control}
                    minBirthdate={minBirthdate}
                    maxBirthdate={maxBirthdate}
                    masked={maskContact}
                    maskBirthdate={maskBirthdate}
                    readOnly={readOnlyEffective}
                  />
                )}

                {/* SOLO EDIT: mantener comportamiento "Ver m?s" */}
                {!isCreateView && (!isMobile || showMore) && (
                  <>
                    <MemberAddressSection
                      isEdit
                      readOnly={readOnlyEffective}
                      masked={maskSensitive}
                    />

                    {isCreateView && (
                      <>
                        <Field.Select
                          name="nationalLeadershipLevel"
                          label="Posici?n en Consejo Nacional"
                          value={watch('nationalLeadershipLevel') ?? ''}
                        >
                          {NATIONAL_LEADERSHIP_LEVELS.map((option) => (
                            <MenuItem key={option.label} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Field.Select>

                        {watch('nationalLeadershipLevel') !== 'none' && (
                          <Field.Select name="nationalLeadershipRole" label="Cargo">
                            {_leadershipRolesByLevel[watch('nationalLeadershipLevel')]?.map(
                              (role) => (
                                <MenuItem key={role.value} value={role.value}>
                                  {role.label}
                                </MenuItem>
                              )
                            )}
                          </Field.Select>
                        )}
                      </>
                    )}

                    <MemberLeadershipAndOtherSection
                      watch={watch}
                      methods={methods}
                      isCreateView={false}
                      isEdit
                      dests={dests}
                      lockCoreFields={lockGroupLeaderFields}
                      readOnly={readOnlyEffective}
                    />

                    {/* Instructor CI: oculto por completo para Lider de Grupo /
                        Lider Asistente de Grupo, y para los miembros menores de
                        18 anos (todos los Instructores CI son mayores de edad). */}
                    {!lockGroupLeaderFields && !isMinorForInstructorCI && (
                      <MemberInstructorCISection
                        instructorCI={instructorCI}
                        diasRestantesCI={diasRestantesCI}
                        isEdit
                        disabled={readOnlyEffective}
                      />
                    )}
                  </>
                )}

                {/* SOLO /new: STEP 1 = Direcci?n */}
                {isCreateView && step === 1 && (
                  <>
                    <Box
                      sx={{
                        gridColumn: '1 / -1',
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                      }}
                    >
                      <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
                      <Typography sx={{ mx: 2, typography: 'subtitle2', color: 'text.secondary' }}>
                        Dirección
                      </Typography>
                      <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
                    </Box>

                    <MemberAddressSection />
                  </>
                )}

                {/* SOLO /new: STEP 2 = Otros (Ocupaci?n + Size T-Shirt) */}
                {isCreateView && step === 2 && (
                  <>
                    <Box
                      sx={{
                        gridColumn: '1 / -1',
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        my: 1,
                      }}
                    >
                      <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />

                      <Typography
                        sx={{
                          mx: 2,
                          typography: 'subtitle2',
                          color: 'text.secondary',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Destacamento, liderazgo, otros
                      </Typography>

                      <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
                    </Box>

                    <MemberLeadershipAndOtherSection
                      watch={watch}
                      methods={methods}
                      isCreateView
                      dests={dests}
                      lockCoreFields={lockGroupLeaderFields}
                    />
                    {/* Instructor CI: oculto por completo para Lider de Grupo /
                        Lider Asistente de Grupo, y para los miembros menores de
                        18 anos (todos los Instructores CI son mayores de edad). */}
                    {!lockGroupLeaderFields && !isMinorForInstructorCI && (
                      <>
                        <Box
                          sx={{
                            gridColumn: '1 / -1',
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            my: 1,
                          }}
                        >
                          <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />

                          <Typography
                            sx={{
                              mx: 2,
                              typography: 'subtitle2',
                              color: 'text.secondary',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Instructor CI
                          </Typography>

                          <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
                        </Box>

                        <Field.Select
                          name="InstructorCertificadoCI"
                          label="?Instructor Certificado?"
                        >
                          <MenuItem value={1}>S?</MenuItem>
                          <MenuItem value={0}>No</MenuItem>
                        </Field.Select>

                        {instructorCI === 1 && (
                          <>
                            <Field.Select
                              name="EstatusVigenciaCI"
                              label="Estatus vigencia CI"
                              defaultValue="na"
                              sx={{
                                '& .MuiSelect-icon': {
                                  display: 'none',
                                },
                              }}
                              disabled
                            >
                              <MenuItem value={1}>Activo</MenuItem>
                              <MenuItem value={0}>Inactivo</MenuItem>
                              <MenuItem value="na">N/A</MenuItem>
                            </Field.Select>

                            <Field.DatePicker
                              name="FechaInicioCI"
                              label="Fecha inicio CI"
                              format="DD/MM/YYYY"
                              views={['year', 'month', 'day']}
                              minDate={dayjs().subtract(5, 'year').add(1, 'day')}
                              maxDate={dayjs()}
                            />
                            <Field.DatePicker
                              name="FechaVencimientoCI"
                              label={`Fecha vencimiento CI${
                                diasRestantesCI !== null && diasRestantesCI <= 365
                                  ? ` (${
                                      diasRestantesCI >= 0
                                        ? `${diasRestantesCI} d?as restantes`
                                        : `vencido hace ${Math.abs(diasRestantesCI)} d?as`
                                    })`
                                  : ''
                              }`}
                              format="DD/MM/YYYY"
                              views={['year', 'month', 'day']}
                              disabled
                              sx={{
                                '& .MuiInputAdornment-root': {
                                  display: 'none',
                                },
                              }}
                            />
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </Box>

              {/* SOLO EDIT */}
              {!isCreateView && isMobile && (
                <Box sx={{ mt: 2 }}>
                  <Button variant="text" fullWidth onClick={() => setShowMore((prev) => !prev)}>
                    {showMore ? 'Ocultar informaci?n' : 'Ver m?s informaci?n'}
                  </Button>
                </Box>
              )}

              {!readOnlyEffective && (
                <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'flex-end' }}>
                  {/* SOLO /new */}
                  {isCreateView && step === 2 && (
                    <Button variant="outlined" onClick={prevStep}>
                      Atrás
                    </Button>
                  )}

                  {isCreateView && step === 1 && (
                    <Button variant="contained" onClick={nextStep}>
                      Siguiente (1 / 2)
                    </Button>
                  )}

                  {isCreateView && step === 2 && (
                    <Button type="submit" variant="contained" loading={isSubmitting}>
                      Crear miembro
                    </Button>
                  )}

                  {/* SOLO EDIT */}
                  {!isCreateView &&
                    (lockGroupLeaderFields ? (
                      leaderPendingRequest ? (
                        <Button
                          type="button"
                          color="warning"
                          variant="outlined"
                          startIcon={<Iconify icon="solar:clock-circle-bold" />}
                          onClick={() => {
                            setChangeResult(leaderPendingRequest);
                            setChangeResultOpen(true);
                          }}
                        >
                          Ver cambios pendientes
                        </Button>
                      ) : (
                        <LoadingButton
                          type="button"
                          variant="contained"
                          loading={sendingApproval}
                          disabled={!isDirty}
                          onClick={handleRequestApproval}
                        >
                          Enviar cambios a aprobación
                        </LoadingButton>
                      )
                    ) : (
                      <>
                        {changeRequest && !changeRequestOpen && (
                          <Button
                            type="button"
                            color="warning"
                            variant="outlined"
                            startIcon={<Iconify icon="solar:clock-circle-bold" />}
                            onClick={() => setChangeRequestOpen(true)}
                          >
                            Cambios solicitados pendientes
                          </Button>
                        )}
                        <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                          Guardar cambios
                        </LoadingButton>
                      </>
                    ))}
                </Stack>
              )}
              {!readOnlyEffective && formErrorMessage && (
                <Typography
                  sx={{
                    mt: 1,
                    typography: 'caption',
                    color: 'error.main',
                    textAlign: 'right',
                  }}
                >
                  Faltan campos obligatorios por completar
                </Typography>
              )}
            </Card>
          </Grid>
        </Grid>
      </Box>

      <MemberChangeRequestDialog
        open={changeRequestOpen}
        solicitud={changeRequest}
        saving={resolvingChangeRequest}
        dests={dests}
        onClose={cerrarSolicitud}
        onResolve={handleResolveChangeRequest}
      />

      <MemberChangeResultDialog
        open={changeResultOpen}
        solicitud={changeResult}
        onClose={cerrarResultado}
      />

      {/* Esta posición del destacamento ya la ocupa otra persona. */}
      <ConfirmDialog
        open={Boolean(posicionOcupada)}
        onClose={() => responderReemplazo(false)}
        title="Cambiar posición"
        content={
          posicionOcupada ? (
            <>
              <strong> {posicionOcupada.nombre} </strong> ya ocupa el cargo de
              <strong>
                {' '}
                {posicionOcupada.cargoLabel}
                {posicionOcupada.division ? ` (${posicionOcupada.division})` : ''}{' '}
              </strong>
              {posicionOcupada.ambito}. Al confirmar se le retirará la posición y pasará a
              <strong> {memberFullName || 'este miembro'}</strong>.
            </>
          ) : null
        }
        action={
          <Button variant="contained" color="error" onClick={() => responderReemplazo(true)}>
            Cambiar posición
          </Button>
        }
      />
    </Form>
  );
}

