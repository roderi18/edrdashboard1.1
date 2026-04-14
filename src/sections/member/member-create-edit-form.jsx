// react
import { useState, useEffect } from 'react';

// third-party
import dayjs from 'dayjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

// mui
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useMediaQuery, useTheme } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';
import barriosData from 'src/data/barrios.json';


// routes
import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

// services
import {
  saveMemberWithLeadership,
  getLeadershipAssignments,
  getMembers,
} from 'src/services/member-service';
import { getDests } from 'src/services/dest-service';

// models
import { MemberValidationSchema } from 'src/models/member-schema';

// utils
import { fData } from 'src/utils/format-number';
import { generateMemberId } from 'src/utils/generate-member-id';
import { capitalizeWords } from 'src/utils/capitalize-words';
import {
  calcularVencimientoCI,
  calcularEstatusCI,
  calcularDiasRestantesCI
} from 'src/utils/ci-utils';

// mock data
import { SECTIONALS, REGIONALS, CHURCHES } from 'src/_mock/assets';
import { _allLeadershipRoles, _leadershipRolesByLevel } from 'src/_mock/_leadership';

// local options
import {
  MEMBER_OCUPATIONS_SORTED,
  MEMBER_SHIRT_SIZES,
  NATIONAL_LEADERSHIP_LEVELS,
  getDivisionByAge
} from './member-create-edit-options';

// components
import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { UnderlineLink } from 'src/components/link/underline-link';
import { ContextInfo } from 'src/components/info/context-info';
import { Form, Field } from 'src/components/hook-form';

// form sections
import MemberGeneralSection from 'src/components/form/member-form/MemberGeneralSection';
import MemberAddressSection from 'src/components/form/member-form/MemberAddressSection';
import MemberLeadershipAndOtherSection from 'src/components/form/member-form/MemberLeadershipAndOtherSection';
import MemberInstructorCISection from 'src/components/form/member-form/MemberInstructorCISection';
// ----------------------------------------------------------------------

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
    .map(p => p.trim())
    .filter(Boolean);

  const [provinceName = '', municipioName = '', sectorName = '', street = ''] = direccionParts;

  const province = provinces.find(p => p.nombre?.trim() === provinceName);
  const municipio = municipios.find(m => m.nombre?.trim() === municipioName && String(m.id));
  const sector = sectores.find(s => s.nombre?.trim() === sectorName && String(s.id));

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
      MEMBER_OCUPATIONS_SORTED.find(
        (o) => o.label === member.ocupation
      ) || null,
    memberPosition: destLeadership?.role ?? 'none',

    gender:
      member.gender === 'M'
        ? 'Masculino'
        : member.gender === 'F'
          ? 'Femenino'
          : '',
    shirtSize:
      MEMBER_SHIRT_SIZES.find(
        (s) => s.value === member.shirtSize
      )?.value || '',

    InstructorCertificadoCI: member.InstructorCertificadoCI ?? 0,
    EstatusVigenciaCI:
      member.InstructorCertificadoCI === 0
        ? 'na'
        : member.EstatusVigenciaCI ?? 1,
    FechaInicioCI: member.FechaInicioCI
      ? dayjs(member.FechaInicioCI)
      : null,

    FechaVencimientoCI: member.FechaVencimientoCI
      ? dayjs(member.FechaVencimientoCI)
      : null,

    status: member.status ?? 'active',
    avatarUrl: member.avatarUrl ?? null,
    isVerified: member.isVerified ?? true,
    nationalLeadershipLevel: nationalLeadership?.level ?? 'none',
    nationalLeadershipRole: nationalLeadership?.role ?? '',
  };
};



export function MemberCreateEditForm({ currentMember }) {

  const LEADERSHIP_ASSIGNMENTS = getLeadershipAssignments();
  const [dests, setDests] = useState([]);
  const [members, setMembers] = useState([]);

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
    // country: 'República Dominicana',

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

  const age =
    birthdate ? dayjs().diff(dayjs(birthdate), 'year') : null;
  const division = getDivisionByAge(age);

  useEffect(() => {
    if (division && watch('memberDivision') !== division) {
      methods.setValue('memberDivision', division);
    }
  }, [division, methods, watch]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dest');
      const data = await res.json();

      setDests(data?.Data || []);
    };

    load();
  }, []);

  const values = watch();
  // console.log("FORM ERRORS:", errors);
  const firstName = watch('firstName');
  const lastName = watch('lastName');
  const memberFullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  const selectedDestId = watch('destId')?.id || watch('destId');
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

  const selectedDest = dests.find((d) => d.id === selectedDestId);
  const selectedSectional = SECTIONALS.find(
    (s) => s.id === selectedDest?.sectionalId
  );
  const selectedRegional = REGIONALS.find(
    (r) => r.id === selectedSectional?.regionalId
  );
  const destChurch = CHURCHES.find(
    (c) => c.id === selectedDest?.churchId
  );
  const destId =
    currentMember?.destId ||
    currentMember?.dest_id ||
    currentMember?.dest;

  const dest = dests.find((d) => d.id === destId);
  const destName = `${dest?.name || ''} ${dest?.destNumber || ''}`.trim() || 'Destacamento desconocido';

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


  const roleInfo = _allLeadershipRoles.find(
    (r) => r.value === leadership?.role
  );


  const leadershipTexts = leaderships.map((l) => {
    const role = _allLeadershipRoles.find((r) => r.value === l.role);
    if (!role) return null;

    if (l.level === 'dest') {
      const dest = dests.find((d) => d.id === l.entityId);
      const destDisplayName =
        `${dest?.name || ''} ${dest?.destNumber || ''}`.trim() ||
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
  }).filter(Boolean);

  const onSubmit = handleSubmit(
    async (data) => {

      setFormErrorMessage(false);

      const memberUUID = currentMember?.id || crypto.randomUUID();

      try {

        const firstName = capitalizeWords(data.firstName);
        const lastName = capitalizeWords(data.lastName);

        const codigoMiembro = currentMember?.memberId || await generateMemberId();
        const provinces = provinciasData;
        const municipios = municipiosData.map((m, index) => ({
          ...m,
          id: index + 1,
        }));
        const sectores = barriosData;
        const buildDireccion = () => {
          const province = provinces.find(p => String(p.id) === data.provinceId)?.nombre;
          const municipio = municipios.find(m => String(m.id) === data.municipioId)?.nombre;
          const sector = sectores.find(s => String(s.id) === data.sectorId)?.nombre;

          return [province, municipio, sector, data.street]
            .filter(Boolean)
            .join(', ');
        };

        const payload = {
          idMiembros: currentMember?.id || 0,
          codigoMiembro,
          nombres: firstName,
          apellidos: lastName,
          genero: data.gender === 'Masculino' ? 'M' : 'F',
          fechaNacimiento: data.birthdate
            ? dayjs(data.birthdate).format('YYYY-MM-DD')
            : null,
          idDestacamento: selectedDestId ? Number(selectedDestId) : 0,
          telefono: data.phoneNumber || '',
          direccion: buildDireccion(data) || null,
          correo: data.email || null,
          idCargoLocal: null,
          idCargoInstitucional: null,
          idDivision: null,
          instructorCertificadoCi:
            data.InstructorCertificadoCI === 1
              ? true
              : data.InstructorCertificadoCI === 0
                ? false
                : null,

          estatusVigenciaCi:
            data.EstatusVigenciaCI === 1
              ? true
              : data.EstatusVigenciaCI === 0
                ? false
                : null,
          fechaInicioCertificado: data.FechaInicioCI
            ? dayjs(data.FechaInicioCI).format('YYYY-MM-DD')
            : null,
          fechaFinCertificado: data.FechaVencimientoCI
            ? dayjs(data.FechaVencimientoCI).format('YYYY-MM-DD')
            : null,
          estatusMiembro: data.status ?? 'active',
        };
        console.log('PAYLOAD FINAL 👉', JSON.stringify(payload, null, 2));

        const res = await fetch(
          currentMember ? '/api/members/put' : '/api/members/post',
          {
            method: currentMember ? 'PUT' : 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );

        const text = await res.text();
        console.log('RESPONSE API 👉', text);

        if (!res.ok) {
          throw new Error(text || 'Error guardando en API');
        }

        toast.success(
          currentMember
            ? 'Actualización exitosa!'
            : `Miembro ${codigoMiembro} creado!`
        );

        router.push(paths.dashboard.level.member.root);

        const updatedMembers = await getMembers();
        const updatedMember = (Array.isArray(updatedMembers) ? updatedMembers : [])
          .find(m => String(m.id) === String(currentMember?.id));

        if (updatedMember) {
          reset(mapMemberToForm(updatedMember));
        }

        toast.success(
          currentMember
            ? 'Actualización exitosa!'
            : `Miembro ${codigoMiembro} creado!`
        );

      } catch (error) {
        console.error("ERROR EN SUBMIT:", error);
      }

    },

    (errors) => {

      if (Object.keys(errors).length > 0) {

        setFormErrorMessage(true);

        setTimeout(() => {
          setFormErrorMessage(false);
        }, 5000);

      }

    }
  );

  return (
    <Form methods={methods} onSubmit={onSubmit}>
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
                maxSize={1050000}
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
                      <br /> tamaño máximo de {fData(1050000)}
                    </Typography>

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
                          text: `pertenecerá a ${`${selectedDest?.name || ''} ${selectedDest?.destNumber || ''}`.trim()}`,
                        },
                        {
                          show: isCreateView && !!destChurch?.name,
                          text: destChurch?.name,
                        },
                        {
                          show: isCreateView && !!selectedSectional?.name,
                          text: `Sección ${selectedSectional?.name}`,
                        },
                        {
                          show: isCreateView && !!selectedRegional?.name,
                          text: selectedRegional?.name,
                        },
                      ]}
                    />

                    {/* Coordinador de Dest... */}
                    {memberDestText && !destLeadership && (<Typography

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
                        <Typography key={`${text}-${index}`}
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
                <Button variant="soft" color="error">
                  Imprimir información
                </Button>
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
                <>
                  <MemberGeneralSection
                    age={age}
                    division={division}
                    isCreateView={isCreateView}
                    control={control}
                  />
                </>
              )}

              {/* SOLO EDIT: mantener comportamiento "Ver más" */}
              {!isCreateView && (!isMobile || showMore) && (
                <>

                  <MemberAddressSection isEdit />

                  {isCreateView && (
                    <>
                      <Field.Select
                        name="nationalLeadershipLevel"
                        label="Posición en Consejo Nacional"
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
                          {_leadershipRolesByLevel[watch('nationalLeadershipLevel')]?.map((role) => (
                            <MenuItem key={role.value} value={role.value}>
                              {role.label}
                            </MenuItem>
                          ))}
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

              {/* SOLO /new: STEP 1 = Dirección */}
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

              {/* SOLO /new: STEP 2 = Otros (Ocupación + Size T-Shirt) */}
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
                  />
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

                  <Field.Select name="InstructorCertificadoCI" label="¿Instructor Certificado?">
                    <MenuItem value={1}>Sí</MenuItem>
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
                            ? `${diasRestantesCI} días restantes`
                            : `vencido hace ${Math.abs(diasRestantesCI)} días`})`
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
                  {showMore ? 'Ocultar información' : 'Ver más información'}
                </Button>
              </Box>
            )}



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
            {formErrorMessage && (
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
    </Form >
  );
}
