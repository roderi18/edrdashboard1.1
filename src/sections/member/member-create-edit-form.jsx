// third-party
import dayjs from 'dayjs';
// react
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { doc, setDoc, collection } from 'firebase/firestore';
import { getApp, deleteApp, initializeApp } from 'firebase/app';
import { getAuth, updateProfile, createUserWithEmailAndPassword } from 'firebase/auth';

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
import { buildDefaultMemberPermissions } from 'src/utils/member-access';
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
// services
import { getMembers, getLeadershipAssignments } from 'src/services/member-service';
import { crearNotificacionMiembroCreado } from 'src/services/notification-service';
import { _allLeadershipRoles, _leadershipRolesByLevel } from 'src/_mock/_leadership';
import { registrarCambiosHistorialMiembro } from 'src/services/member-history-service';

// components
import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
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
// local options
import {
  MEMBER_SHIRT_SIZES,
  MEMBER_OCUPATIONS_SORTED,
  NATIONAL_LEADERSHIP_LEVELS,
} from './member-create-edit-options';
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

    return { emailFake, username, password };
  } finally {
    if (secondaryAuth?.app) {
      deleteApp(secondaryAuth.app).catch(() => {});
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

export function MemberCreateEditForm({ currentMember, readOnly = false }) {
  const { user } = useAuthContext();
  const LEADERSHIP_ASSIGNMENTS = getLeadershipAssignments();
  const [dests, setDests] = useState([]);
  const [members, setMembers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadErrorMessage, setPhotoUploadErrorMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const data = await getDivisions();
      setDivisions(data);
    };

    load();
  }, []);

  useEffect(() => {
    const loadMembers = async () => {
      const data = await getMembers();
      setMembers(data);
    };

    loadMembers();
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
    // country: 'RepÃƒÂºblica Dominicana',

    provinceId: '',
    municipioId: '',
    sectorId: '',
    street: '',
    state: '',
    city: '',
    address: '',
    ocupation: null,
    memberDivision: '',
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
  });

  useEffect(() => {
    if (currentMember) {
      methods.reset(mapMemberToForm(currentMember));
    }
  }, [currentMember]);

  const {
    reset,
    watch,
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = methods;

  const birthdate = watch('birthdate');
  const minBirthdate = dayjs().subtract(100, 'year');
  const maxBirthdate = dayjs().subtract(5, 'year');
  const [division, setDivision] = useState('');
  const [divisionId, setDivisionId] = useState(null);
  const idDivision = watch('idDivision');

  useEffect(() => {
    if (!birthdate) return;

    const load = async () => {
      const normalizedBirthdate = dayjs(birthdate).format('YYYY-MM-DD');
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

        const res = await fetch(currentMember ? '/api/members/put' : '/api/members/post', {
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
          console.error('RAW RESPONSE Ã°Å¸â€˜â€°', text);
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

        const completedMessage = (responseData?.message || responseData?.Message)
          ?.toLowerCase()
          .includes('completada');

        if (
          (responseData?.success === false || responseData?.Success === false) &&
          !completedMessage
        ) {
          console.error('API ERROR Ã°Å¸â€˜â€°', responseData);
          throw new Error(
            responseData?.message || responseData?.Message || 'Error guardando en API'
          );
        }

        toast.success(
          currentMember ? 'Actualizacion exitosa!' : `Miembro ${codigoMiembro} creado!`
        );

        let savedMember = null;

        if (!currentMember) {
          const createdMembers = await getMembers();
          savedMember = (Array.isArray(createdMembers) ? createdMembers : []).find(
            (member) =>
              normalizeMemberUsername(member?.memberId || member?.codigoMiembro || member?.id) ===
              normalizeMemberUsername(codigoMiembro)
          );

          try {
            const authCredentials = await createFirebaseAuthForMember({
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
                'Miembro creado, pero no se pudo crear su usuario de inicio de sesiÃƒÂ³n.'
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

            window.dispatchEvent(new Event('notificaciones:actualizar'));
          } catch (notificationError) {
            console.error('[member form] member notification failed', notificationError);
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
            toast.error(
              photoError.message || 'Miembro creado, pero no se pudo subir la foto.'
            );
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

  return (
    <Form methods={methods} onSubmit={readOnly ? undefined : onSubmit}>
      <Box component="fieldset" disabled={readOnly} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
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
                          text: `pertenecerÃƒÂ¡ a ${`${selectedDest?.name || ''} ${selectedDest?.destNumber || ''}`.trim()}`,
                        },
                        {
                          show: isCreateView && !!destChurch?.name,
                          text: destChurch?.name,
                        },
                        {
                          show: isCreateView && !!selectedSectional?.name,
                          text: `SecciÃƒÂ³n ${selectedSectional?.name}`,
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
                />
              )}

              {/* SOLO EDIT: mantener comportamiento "Ver mÃƒÂ¡s" */}
              {!isCreateView && (!isMobile || showMore) && (
                <>
                  <MemberAddressSection isEdit />

                  {isCreateView && (
                    <>
                      <Field.Select
                        name="nationalLeadershipLevel"
                        label="PosiciÃƒÂ³n en Consejo Nacional"
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
                  />

                  <MemberInstructorCISection
                    instructorCI={instructorCI}
                    diasRestantesCI={diasRestantesCI}
                    isEdit
                  />
                </>
              )}

              {/* SOLO /new: STEP 1 = DirecciÃƒÂ³n */}
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

              {/* SOLO /new: STEP 2 = Otros (OcupaciÃƒÂ³n + Size T-Shirt) */}
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

                  <MemberLeadershipAndOtherSection watch={watch} methods={methods} isCreateView />
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

                  <Field.Select name="InstructorCertificadoCI" label="Ã‚Â¿Instructor Certificado?">
                    <MenuItem value={1}>SÃƒÂ­</MenuItem>
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
                                  ? `${diasRestantesCI} dÃƒÂ­as restantes`
                                  : `vencido hace ${Math.abs(diasRestantesCI)} dÃƒÂ­as`
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
            </Box>

            {/* SOLO EDIT */}
            {!isCreateView && isMobile && (
              <Box sx={{ mt: 2 }}>
                <Button variant="text" fullWidth onClick={() => setShowMore((prev) => !prev)}>
                  {showMore ? 'Ocultar informaciÃƒÂ³n' : 'Ver mÃƒÂ¡s informaciÃƒÂ³n'}
                </Button>
              </Box>
            )}

            {!readOnly && (
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
              {!isCreateView && (
                <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                  Guardar cambios
                </LoadingButton>
              )}
            </Stack>
            )}
            {!readOnly && formErrorMessage && (
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
    </Form>
  );
}
