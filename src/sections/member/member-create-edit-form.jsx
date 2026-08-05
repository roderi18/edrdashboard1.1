// third-party
import dayjs from 'dayjs';
import { useSearchParams } from 'next/navigation';
// react
import { useRef, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { getApp, deleteApp, initializeApp } from 'firebase/app';
import { getAuth, updateProfile, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, where, query, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';

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
import { subirFotoEntidad } from 'src/utils/firebase-photos';
import { optimizeImageFile } from 'src/utils/image-optimizer';
import { generateMemberId } from 'src/utils/generate-member-id';
import { getImageOptimizationMessage } from 'src/utils/upload-optimization-message';
import {
  calcularEstatusCI,
  calcularVencimientoCI,
  calcularDiasRestantesCI,
} from 'src/utils/ci-utils';
import {
  buildMemberAuthEmail,
  buildMemberAuthPassword,
  normalizeMemberUsername,
} from 'src/utils/member-auth-credentials';
import {
  canApproveMemberChanges,
  isDestacamentoApprovalRole,
  canViewMemberSensitiveData,
  buildDefaultMemberPermissions,
  isCoordinadorDestacamentoRole,
  canViewMemberBirthdateWhenMasked,
} from 'src/utils/member-access';

import { CONFIG } from 'src/global-config';
import { FIRESTORE } from 'src/lib/firebase';
import barriosData from 'src/data/barrios.json';
import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';
import { getDivisions } from 'src/services/division-service';
// models
import { MemberValidationSchema } from 'src/models/member-schema';
// mock data
import { CHURCHES, REGIONALS, SECTIONALS } from 'src/_mock/assets';
import { NATIONAL_LEADERSHIP_LEVELS } from 'src/catalogs/directiva-positions';
import { registrarAuditoriaSilenciosa } from 'src/services/audit-log-service';
// services
import { getMembers, getLeadershipAssignments } from 'src/services/member-service';
import { _allLeadershipRoles, _leadershipRolesByLevel } from 'src/_mock/_leadership';
import { registrarCambiosHistorialMiembro } from 'src/services/member-history-service';
import { MEMBER_SHIRT_SIZES, MEMBER_OCUPATIONS_SORTED } from 'src/catalogs/member-catalogs';
import { notificarCoordinadoresActualizacionDirecta } from 'src/services/solicitudes-cambio-notificaciones-service';
import {
  asegurarCargoApi,
  guardarCargoMiembroApi,
  obtenerCargosMiembroApi,
} from 'src/services/cargos-api-service';
import {
  CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO,
  obtenerAsignacionesOrganigramaPorDestacamento,
} from 'src/services/organigrama-directiva-destacamentos-service';
import {
  DIVISIONES_DIRECTIVA,
  guardarAsignacionDirectiva,
  obtenerCargosDirectivaCached,
  obtenerAsignacionesDirectivaPorMiembro,
} from 'src/services/directivas-organizacionales-service';
import {
  crearNotificacionAdmin,
  crearNotificacionCuentaCreada,
  crearNotificacionMiembroCreado,
  crearNotificacionMiembroActualizado,
  crearNotificacionErrorSubidaArchivoImagen,
} from 'src/services/notification-service';
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

const MEMBER_AUTH_APP_NAME = 'member-auth-provisioning';
const MEMBER_PHOTO_OPTIMIZE_OPTIONS = {
  maxWidth: 900,
  maxHeight: 900,
  quality: 0.82,
  mimeType: 'image/webp',
  maxSizeBytes: 320000,
};

const createSecondaryAuth = () => {
  try {
    return getAuth(getApp(MEMBER_AUTH_APP_NAME));
  } catch {
    return getAuth(initializeApp(CONFIG.firebase, MEMBER_AUTH_APP_NAME));
  }
};

const withTimeout = (promise, milliseconds, errorMessage) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), milliseconds);
    }),
  ]);

const createFirebaseAuthForMember = async ({
  codigoMiembro,
  firstName,
  lastName,
  destId,
  memberId,
}) => {
  let secondaryAuth = null;

  try {
    const username = normalizeMemberUsername(codigoMiembro);
    const emailFake = buildMemberAuthEmail(username);
    const password = buildMemberAuthPassword(username);
    const displayName = `${firstName} ${lastName}`.trim() || codigoMiembro;

    secondaryAuth = createSecondaryAuth();

    const credential = await createUserWithEmailAndPassword(secondaryAuth, emailFake, password);

    Promise.allSettled([
      withTimeout(
        updateProfile(credential.user, { displayName }),
        5000,
        'No se pudo actualizar el nombre del usuario Firebase.'
      ),
      withTimeout(
        setDoc(doc(collection(FIRESTORE, 'users'), credential.user.uid), {
          uid: credential.user.uid,
          email: emailFake,
          username,
          codigoMiembro,
          displayName,
          firstName,
          lastName,
          idDestacamento: destId ? Number(destId) : null,
          authMode: 'member-code',
          createdAt: new Date().toISOString(),
        }),
        5000,
        'No se pudo guardar el perfil extra del usuario Firebase.'
      ),
      withTimeout(
        setDoc(doc(collection(FIRESTORE, 'usuarios_roles'), String(memberId || codigoMiembro)), {
          idMiembros: memberId ? Number(memberId) : null,
          codigoMiembro,
          uid: credential.user.uid,
          correo: emailFake,
          nombre: displayName,
          rol: 'miembro',
          estado: 'activo',
          alcance: {
            modo: 'destacamento',
            destacamentos: destId ? [Number(destId)] : [],
            regiones: [],
            secciones: [],
          },
          permisos: {
            ...buildDefaultMemberPermissions(),
          },
          creadoEn: new Date().toISOString(),
          actualizadoEn: new Date().toISOString(),
        }),
        5000,
        'No se pudo guardar los permisos base del miembro.'
      ),
    ]).then((results) => {
      results
        .filter((result) => result.status === 'rejected')
        .forEach((result) =>
          console.warn('[member form] firebase profile task failed', result.reason)
        );
    });

    return { uid: credential.user.uid, emailFake, username, password };
  } finally {
    if (secondaryAuth?.app) {
      deleteApp(secondaryAuth.app).catch(() => { });
    }
  }
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
  const leadershipAssignments = getLeadershipAssignments();
  const memberLeaderships = leadershipAssignments.filter(
    (l) =>
      member &&
      (l.memberId === member?.id || l.member_id === member?.id) &&
      (l.status === 'active' || !l.status)
  );

  const nationalLeadership = memberLeaderships.find((l) => l.level === 'national');
  const destLeadership = memberLeaderships.find((l) => l.level === 'dest');

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
    memberPosition: destLeadership?.role ?? 'none',

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
    nationalLeadershipLevel: nationalLeadership?.level ?? 'none',
    nationalLeadershipRole: nationalLeadership?.role ?? '',
  };
};

export function MemberCreateEditForm({ currentMember, readOnly = false, availableDests = [] }) {
  const { user } = useAuthContext();
  // Cargos del destacamento que no son coordinadores (líder de grupo/asistente,
  // pastor, consejo, capellán): no pueden editar destacamento, posición en el
  // destacamento, sexo ni Instructor CI (se muestran deshabilitados) y sus cambios
  // van a aprobación del Coordinador de Destacamento.
  const lockGroupLeaderFields = isDestacamentoApprovalRole(user);
  const isCoordinador = isCoordinadorDestacamentoRole(user);
  const puedeAprobarCambios = canApproveMemberChanges(user);
  // Usuarios sin acceso a los datos sensibles (sección, región, consejo nacional,
  // consejo de destacamento, líderes de grupo, etc.): la información personal se
  // muestra ENMASCARADA (dirección, teléfono y correo).
  const maskSensitive = Boolean(currentMember) && !canViewMemberSensitiveData(user);
  // La fecha de nacimiento es la única excepción al enmascarado para los cargos
  // del destacamento que la necesitan (edad y división del miembro).
  const maskBirthdate = maskSensitive && !canViewMemberBirthdateWhenMasked(user);
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
    destId: '',
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

  useEffect(() => {
    let isMounted = true;

    const loadMemberCargos = async () => {
      const memberId = currentMember?.id || currentMember?.idMiembros;

      if (!memberId) {
        return;
      }

      try {
        const [cargosMiembro, cargosDirectiva, asignacionesDirectiva] = await Promise.all([
          obtenerCargosMiembroApi(memberId),
          obtenerCargosDirectivaCached({ incluirNoAsignables: false }),
          obtenerAsignacionesDirectivaPorMiembro({ idMiembro: memberId }),
        ]);

        if (!isMounted) {
          return;
        }

        const cargoIds = cargosMiembro
          .map((cargoMiembro) => Number(cargoMiembro.idCargo))
          .filter((idCargo) => Number.isFinite(idCargo) && idCargo > 0);
        const positionsByAssignment = asignacionesDirectiva
          .map((asignacion) =>
            cargosDirectiva.find((cargo) =>
              [
                cargo.idPosicionDirectiva,
                cargo.id,
                cargo.idCargo,
                cargo.idCargoApi,
              ].some(
                (value) =>
                  String(value || '') === String(asignacion.idPosicionDirectiva || '') ||
                  String(value || '') === String(asignacion.idCargo || '')
              )
            )
          )
          .filter(Boolean);
        const positionsByCargoApi = cargosDirectiva.filter((cargo) =>
          cargoIds.includes(Number(cargo.idCargo || cargo.idCargoApi))
        );
        const memberDivisionKey = getDirectivaDivisionByMemberDivisionId(
          currentMember?.idDivision || currentMember?.divisionId
        );
        const selectedPositions = [...positionsByAssignment, ...positionsByCargoApi];
        const nationalCargo = selectedPositions.find((cargo) => cargo.nivel !== 'destacamento');
        const destCargoFromAssignment = positionsByAssignment.find(
          (cargo) => cargo.nivel === 'destacamento'
        );
        const destCargoFromApi =
          positionsByCargoApi.find(
            (cargo) => cargo.nivel === 'destacamento' && cargo.division === memberDivisionKey
          ) || positionsByCargoApi.find((cargo) => cargo.nivel === 'destacamento');
        const destCargo = destCargoFromAssignment || destCargoFromApi;

        if (nationalCargo) {
          methods.setValue(
            'nationalLeadershipRole',
            nationalCargo.idPosicionDirectiva || nationalCargo.id || nationalCargo.idCargo,
            {
              shouldDirty: false,
            }
          );
        }

        if (destCargo) {
          methods.setValue(
            'memberPosition',
            destCargo.idPosicionDirectiva || destCargo.id || destCargo.idCargo,
            {
              shouldDirty: false,
            }
          );
        }
      } catch {
        // Si el API de cargos no responde, no bloquea la edicion del miembro.
      }
    };

    loadMemberCargos();

    return () => {
      isMounted = false;
    };
  }, [currentMember?.divisionId, currentMember?.id, currentMember?.idDivision, currentMember?.idMiembros, methods]);

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
    const hasCurrentDivisionData = Boolean(currentMember?.idDivision || currentMember?.memberDivision);

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
  const selectedSectional = SECTIONALS.find((s) => s.id === selectedDest?.sectionalId);
  const selectedRegional = REGIONALS.find((r) => r.id === selectedSectional?.regionalId);
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

    if (cargo?.nivel === 'seccional') {
      return selectedSectional?.id || currentMember?.sectionalId || 'general';
    }

    if (cargo?.nivel === 'regional') {
      return selectedRegional?.id || currentMember?.regionalId || 'general';
    }

    return 'nacional';
  };

  const saveSelectedCargo = async ({ value, idMiembro }) => {
    const cargo = await getCargoOptionByValue(value);

    if (!cargo || !idMiembro) {
      return;
    }

    const cargoApi = await asegurarCargoApi({
      idCargo: cargo?.idCargo || cargo?.idCargoApi || 0,
      nombre: cargo?.nombreCargo || cargo?.nombre || cargo?.label,
    });
    const idCargo = Number(cargoApi?.idCargo || cargo?.idCargo || cargo?.idCargoApi || 0);

    if (!Number.isFinite(idCargo) || idCargo <= 0) {
      throw new Error(`No se pudo resolver el idCargo para ${cargo?.nombreCargo || 'el cargo'}.`);
    }

    const fechaInicio = dayjs().format('YYYY-MM-DD');
    const idEntidad = getCargoEntityId(cargo);

    await guardarCargoMiembroApi({
      idCargo,
      idMiembro,
      fechaInicio,
      fechaFin: null,
    });

    await guardarAsignacionDirectiva({
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
  };

  const saveSelectedMemberCargos = async ({ idMiembro, formData }) => {
    await Promise.all([
      saveSelectedCargo({ value: formData.nationalLeadershipRole, idMiembro }),
      saveSelectedCargo({ value: formData.memberPosition, idMiembro }),
    ]);
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

    registrarCambiosHistorialMiembro({
      idMiembro: idMiembros,
      codigoMiembro: currentMember?.memberId || currentMember?.codigoMiembro || '',
      nombreMiembro: memberFullName,
      modulo: 'Información general',
      antes: { fotoPerfil: currentMember?.avatarUrl || '' },
      despues: { fotoPerfil: photo.urlFoto || '' },
      campos: { fotoPerfil: 'Foto de perfil' },
      usuario: user,
      metadata: {
        origen: 'member-create-edit-form',
        accion: 'foto_perfil',
      },
    }).catch((historyError) => {
      console.error('[member form] member photo history failed', historyError);
    });

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

      if (!currentMember || !idMiembros) {
        const { file: optimizedFile } = await optimizeMemberPhoto(file);
        return optimizedFile;
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
      try {
        const submittedFirstName = formData.firstName;
        const submittedLastName = formData.lastName;
        const genderValue =
          typeof formData.gender === 'string' ? formData.gender : formData.gender?.value;

        const codigoMiembro = currentMember?.memberId || (await generateMemberId());
        const legacyCargoInstitucional = Number(formData.nationalLeadershipRole);

        if (!currentMember) {
          const existingMembers = await getMembers();

          if (hasDuplicatedCodigoMiembro(existingMembers, codigoMiembro, currentMember?.id)) {
            toast.error(`El codigo de miembro ${codigoMiembro} ya existe. No se creo el miembro.`);
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
          instructorCertificadoCi:
            formData.InstructorCertificadoCI === 1
              ? true
              : formData.InstructorCertificadoCI === 0
                ? false
                : null,

          estatusVigenciaCi:
            formData.EstatusVigenciaCI === 1
              ? true
              : formData.EstatusVigenciaCI === 0
                ? false
                : null,
          fechaInicioCertificado: formData.FechaInicioCI
            ? dayjs(formData.FechaInicioCI).format('YYYY-MM-DD')
            : null,
          fechaFinCertificado: formData.FechaVencimientoCI
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

        toast.success(
          currentMember ? 'Actualizacion exitosa!' : `Miembro ${codigoMiembro} creado!`
        );

        let savedMember = null;
        let authCredentials = null;

        if (!currentMember) {
          const createdMembers = await getMembers();
          savedMember = (Array.isArray(createdMembers) ? createdMembers : []).find(
            (member) =>
              normalizeMemberUsername(member?.memberId || member?.codigoMiembro || member?.id) ===
              normalizeMemberUsername(codigoMiembro)
          );

          try {
            authCredentials = await createFirebaseAuthForMember({
              codigoMiembro,
              firstName: submittedFirstName,
              lastName: submittedLastName,
              destId: selectedDestId,
              memberId: savedMember?.id || null,
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

          try {
            await crearNotificacionMiembroCreado({
              miembro: savedMember || {
                id: responseData?.idMiembros || responseData?.data?.idMiembros,
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
                  idMiembros: savedMember?.id || responseData?.idMiembros || null,
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

        const historyMemberId =
          currentMember?.id ||
          savedMember?.id ||
          responseData?.idMiembros ||
          responseData?.data?.idMiembros ||
          responseData?.Data?.idMiembros;

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

        const selectedPhoto = formData.avatarUrl;

        if (!currentMember && selectedPhoto instanceof File) {
          try {
            setUploadingPhoto(true);

            const createdMemberId =
              savedMember?.id ||
              responseData?.idMiembros ||
              responseData?.data?.idMiembros ||
              responseData?.Data?.idMiembros;

            const uploadedPhoto = await uploadMemberPhoto({
              file: selectedPhoto,
              idMiembros: createdMemberId,
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
        } else {
          router.push(paths.dashboard.level.member.root);
        }
      } catch (error) {
        toast.error(error.message || 'Error guardando en API');
      }
    },

    (validationErrors) => {
      if (Object.keys(validationErrors).length > 0) {
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
          methods.setValue(item.campo, item.valorFinal, { shouldDirty: true, shouldValidate: true });
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
                    masked={maskSensitive}
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
                        Lider Asistente de Grupo. */}
                    {!lockGroupLeaderFields && (
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
                        Lider Asistente de Grupo. */}
                    {!lockGroupLeaderFields && (
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
                              label={`Fecha vencimiento CI${diasRestantesCI !== null && diasRestantesCI <= 365
                                ? ` (${diasRestantesCI >= 0
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
    </Form>
  );
}
