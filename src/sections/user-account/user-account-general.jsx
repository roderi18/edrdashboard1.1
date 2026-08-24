'use client';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { doc, setDoc } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { getMemberCodeLabel } from 'src/utils/member-access';
import { subirFotoEntidad, obtenerFotoPrincipal } from 'src/utils/firebase-photos';
import { getImageOptimizationMessage } from 'src/utils/upload-optimization-message';
import { nombreDeMiembro, buscarMiembroConCorreo } from 'src/utils/member-correo-duplicado';

import barriosData from 'src/data/barrios.json';
import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { SignOutButton } from 'src/layouts/components/sign-out-button';
import { guardarCorreoDeAcceso } from 'src/services/primer-acceso-service';
import { getMembers, authHeaders, updateMemberApi } from 'src/services/member-service';
import { registrarCambiosHistorialMiembro } from 'src/services/member-history-service';
import {
  crearNotificacionPerfilActualizado,
  crearNotificacionErrorSubidaArchivoImagen,
} from 'src/services/notification-service';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import LocationSelect from 'src/components/location/location-select';
import DashedAccordion from 'src/components/expandable/DashedAccordion';
import { AccountSectionSkeleton } from 'src/components/account/account-section-skeleton';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const AccountMemberSchema = z.object({
  email: z.string().email({ error: 'El correo no es válido.' }),
  provinceId: z.string().optional(),
  municipioId: z.string().optional(),
  sectorId: z.string().optional(),
  street: z.string().optional(),
  avatarUrl: z.any().optional(),
});

const formatGender = (gender) => {
  if (!gender) return '';
  if (gender === 'M' || gender === 'Masculino') return 'Masculino';
  if (gender === 'F' || gender === 'Femenino') return 'Femenino';
  return String(gender);
};

const formatStatus = (status) => {
  if (!status) return '';
  if (status === 'active' || status === 'activo') return 'Activo';
  if (status === 'banned' || status === 'inactivo') return 'Inactivo';
  return String(status);
};

const buildFallbackMemberFromUser = (user = {}) => {
  const displayName = String(user?.displayName ?? user?.nombres ?? user?.name ?? '')
    .trim()
    .split(' ')
    .filter(Boolean);
  const [firstName = '', ...rest] = displayName;

  return {
    idMiembros: Number(user?.idMiembros ?? 0) || null,
    codigoMiembro: user?.codigoMiembro ?? user?.codigoUsuario ?? '',
    nombres: user?.nombres ?? firstName ?? '',
    apellidos: user?.apellidos ?? rest.join(' ') ?? '',
    genero: user?.genero ?? '',
    fechaNacimiento: user?.fechaNacimiento ?? null,
    idDestacamento: user?.idDestacamento ?? null,
    telefono: user?.telefono ?? user?.phoneNumber ?? '',
    direccion: user?.direccion ?? '',
    correo: user?.email ?? user?.correo ?? '',
    idCargoLocal: user?.idCargoLocal ?? '',
    idCargoInstitucional: user?.idCargoInstitucional ?? '',
    idDivision: user?.idDivision ?? '',
    instructorCertificadoCi: user?.instructorCertificadoCi ?? false,
    estatusVigenciaCi: user?.estatusVigenciaCi ?? null,
    fechaInicioCertificado: user?.fechaInicioCertificado ?? null,
    fechaFinCertificado: user?.fechaFinCertificado ?? null,
    estatusMiembro: user?.estatusMiembro ?? user?.status ?? 'active',
    avatarUrl: user?.avatarUrl ?? user?.photoURL ?? '',
  };
};

const parseAddress = (direccion = '') => {
  const parts = String(direccion || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const [provinceName = '', municipioName = '', sectorName = '', street = ''] = parts;

  return {
    provinceName,
    municipioName,
    sectorName,
    street,
  };
};

const buildAddress = ({ provinceId, municipioId, sectorId, street }) => {
  const province = provinciasData.find((item) => String(item.id) === String(provinceId))?.nombre;
  const municipios = municipiosData.map((item, index) => ({
    ...item,
    id: index + 1,
    municipioId: index + 1,
  }));
  const municipio = municipios.find((item) => String(item.id) === String(municipioId))?.nombre;
  const sector = barriosData.find((item) => String(item.id) === String(sectorId))?.nombre;

  return [province, municipio, sector, street].filter(Boolean).join(', ');
};

const mapMemberToValues = (member) => {
  const provinces = provinciasData;
  const municipios = municipiosData.map((item, index) => ({
    ...item,
    id: index + 1,
    municipioId: index + 1,
  }));

  const sectores = barriosData;
  const { provinceName, municipioName, sectorName, street } = parseAddress(member?.direccion);

  const province = provinces.find((item) => item.nombre?.trim() === provinceName);
  const municipio = municipios.find((item) => item.nombre?.trim() === municipioName);
  const sector = sectores.find((item) => item.nombre?.trim() === sectorName);

  const birthdate = member?.fechaNacimiento ? dayjs(member.fechaNacimiento) : null;
  const age = birthdate ? dayjs().diff(birthdate, 'year') : null;
  const destId = String(member?.idDestacamento ?? member?.destId ?? '');

  return {
    codigoMiembro: String(member?.codigoMiembro ?? '').toUpperCase(),
    firstName: member?.nombres ?? '',
    lastName: member?.apellidos ?? '',
    gender: formatGender(member?.genero),
    birthdate,
    age,
    division: '',
    phoneNumber: member?.telefono ?? '',
    email: member?.correo ?? '',
    status: member?.estatusMiembro ?? 'active',
    statusDisplay: formatStatus(member?.estatusMiembro),
    idCargoLocal: member?.idCargoLocal ?? '',
    idCargoInstitucional: member?.idCargoInstitucional ?? '',
    destId,
    destDisplay:
      `${member?.destacamentoName ?? member?.destacamento ?? ''} ${
        member?.destacamentoNumero ?? ''
      }`.trim() || (destId ? `Destacamento ${destId}` : ''),
    instructorCertificadoCi:
      member?.instructorCertificadoCi === true || member?.instructorCertificadoCi === 1
        ? 'Sí'
        : 'No',
    estatusVigenciaCi: formatStatus(member?.estatusVigenciaCi),
    fechaInicioCertificado: member?.fechaInicioCertificado
      ? dayjs(member.fechaInicioCertificado)
      : null,
    fechaFinCertificado: member?.fechaFinCertificado ? dayjs(member.fechaFinCertificado) : null,
    destName: member?.destacamentoName ?? member?.destacamento ?? member?.idDestacamento ?? '',
    provinceId: province?.id ? String(province.id) : '',
    municipioId: municipio?.id ? String(municipio.id) : '',
    sectorId: sector?.id ? String(sector.id) : '',
    street: street ?? '',
    avatarUrl: member?.avatarUrl ?? member?.photoURL ?? '',
  };
};

const mapAccountMemberToHistoryPayload = (member = {}) => ({
  codigoMiembro: member.codigoMiembro ?? '',
  nombres: member.nombres ?? '',
  apellidos: member.apellidos ?? '',
  genero: member.genero ?? '',
  fechaNacimiento: member.fechaNacimiento ?? null,
  idDestacamento: member.idDestacamento ?? null,
  telefono: member.telefono ?? '',
  direccion: member.direccion ?? '',
  correo: member.correo ?? '',
  idCargoLocal: member.idCargoLocal ?? null,
  idCargoInstitucional: member.idCargoInstitucional ?? null,
  idDivision: member.idDivision ?? null,
  instructorCertificadoCi: member.instructorCertificadoCi ?? false,
  estatusVigenciaCi: member.estatusVigenciaCi ?? null,
  fechaInicioCertificado: member.fechaInicioCertificado ?? null,
  fechaFinCertificado: member.fechaFinCertificado ?? null,
  estatusMiembro: member.estatusMiembro ?? 'active',
});

const ACCOUNT_HISTORY_FIELDS = {
  codigoMiembro: 'Código de miembro',
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  genero: 'Género',
  fechaNacimiento: 'Fecha de nacimiento',
  idDestacamento: 'Destacamento',
  telefono: 'Teléfono',
  direccion: 'Dirección',
  correo: 'Correo electrónico',
  idCargoLocal: 'Cargo local',
  idCargoInstitucional: 'Cargo institucional',
  idDivision: 'División',
  instructorCertificadoCi: 'Instructor certificado CI',
  estatusVigenciaCi: 'Estatus vigencia CI',
  fechaInicioCertificado: 'Fecha inicio certificado',
  fechaFinCertificado: 'Fecha fin certificado',
  estatusMiembro: 'Estatus miembro',
};

const ReadOnlyTextField = ({ name, label }) => (
  <Field.Text name={name} label={label} slotProps={{ htmlInput: { readOnly: true } }} />
);

// ----------------------------------------------------------------------

export function UserAccountGeneral() {
  const { user, checkUserSession } = useAuthContext();
  const [member, setMember] = useState(null);
  const [dests, setDests] = useState([]);
  const [loadingMember, setLoadingMember] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const canEditAll =
    user?.role === 'admin' || user?.role === 'administrator' || user?.memberRole === 'admin';

  const memberCode = useMemo(
    () => getMemberCodeLabel(user) || String(member?.codigoMiembro ?? '').toUpperCase(),
    [member?.codigoMiembro, user]
  );

  useEffect(() => {
    let active = true;

    const loadMember = async () => {
      if (!user) {
        return;
      }

      try {
        setLoadingMember(true);

        const response = await fetch('/api/members', { headers: await authHeaders() });
        const data = await response.json();
        const rawMembers = data?.Data || data?.data || data?.items || data || [];

        const normalizedSessionCode = String(
          user?.codigoMiembro ?? user?.memberId ?? user?.idMiembros ?? ''
        )
          .trim()
          .toUpperCase();

        const currentMember = (Array.isArray(rawMembers) ? rawMembers : []).find((item) => {
          const candidateCode = String(item?.codigoMiembro ?? '')
            .trim()
            .toUpperCase();
          const candidateId = String(item?.idMiembros ?? '').trim();
          const sessionId = String(user?.idMiembros ?? user?.memberId ?? '').trim();

          return (
            (normalizedSessionCode && candidateCode === normalizedSessionCode) ||
            (sessionId && candidateId === sessionId) ||
            (String(item?.correo ?? '')
              .trim()
              .toLowerCase() &&
              String(item?.correo ?? '')
                .trim()
                .toLowerCase() ===
                String(user?.email ?? '')
                  .trim()
                  .toLowerCase())
          );
        });

        const resolvedMember = currentMember || buildFallbackMemberFromUser(user);
        const memberId = Number(resolvedMember?.idMiembros ?? 0) || null;
        const memberPhoto = memberId
          ? await obtenerFotoPrincipal({ tipoEntidad: 'miembro', idEntidad: memberId })
          : null;

        if (active) {
          setMember({
            ...resolvedMember,
            avatarUrl: memberPhoto?.urlFoto || resolvedMember?.avatarUrl || user?.photoURL || '',
          });
        }
      } catch (error) {
        console.error('[user-account] load member failed', error);
        if (active) {
          setMember(buildFallbackMemberFromUser(user));
        }
      } finally {
        if (active) {
          setLoadingMember(false);
        }
      }
    };

    loadMember();

    return () => {
      active = false;
    };
  }, [
    user,
    user?.codigoMiembro,
    user?.email,
    user?.idMiembros,
    user?.memberId,
    user?.nombres,
    user?.apellidos,
  ]);

  useEffect(() => {
    let active = true;

    const loadDests = async () => {
      try {
        const response = await fetch('/api/dest');
        const data = await response.json();
        const items = (data?.Data || data?.data || data?.items || []).map((dest) => ({
          id: String(dest?.idDestacamento ?? dest?.id ?? ''),
          name: dest?.nombre ?? dest?.name ?? '',
          destNumber: dest?.numero ?? dest?.destNumber ?? '',
        }));

        if (active) {
          setDests(items);
        }
      } catch (error) {
        console.error('[user-account] load dests failed', error);
        if (active) {
          setDests([]);
        }
      }
    };

    loadDests();

    return () => {
      active = false;
    };
  }, []);

  const initialValues = useMemo(() => mapMemberToValues(member), [member]);

  const methods = useForm({
    mode: 'all',
    resolver: zodResolver(AccountMemberSchema),
    defaultValues: initialValues,
    values: initialValues,
  });

  const {
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { isSubmitting },
  } = methods;

  const birthdate = watch('birthdate');
  const age = birthdate ? dayjs().diff(dayjs(birthdate), 'year') : null;
  const divisionLabel = age !== null ? `División (${age} años)` : 'División (cálculo según edad)';

  useEffect(() => {
    const loadDivision = async () => {
      if (!birthdate) {
        setValue('division', '');
        return;
      }

      try {
        const birthdateValue = dayjs(birthdate).format('YYYY-MM-DD');
        const response = await fetch(`/api/divisions/calculate?birthdate=${birthdateValue}`);
        const data = await response.json();
        setValue('division', data?.name || '');
      } catch (error) {
        console.error('[user-account] division calculation failed', error);
        setValue('division', '');
      }
    };

    loadDivision();
  }, [birthdate, setValue]);

  useEffect(() => {
    if (member) {
      reset(mapMemberToValues(member));
    }
  }, [member, reset]);

  const handleUploadAvatar = async (acceptedFiles) => {
    const file = acceptedFiles?.[0];
    const memberId = Number(member?.idMiembros ?? user?.idMiembros ?? 0) || null;

    if (!file) {
      return null;
    }

    if (!memberId) {
      toast.error('No se pudo identificar el miembro para subir la foto.');
      return null;
    }

    try {
      setUploadingPhoto(true);

      const photo = await subirFotoEntidad({
        file,
        tipoEntidad: 'miembro',
        idEntidad: memberId,
        subidoPor: user?.uid || user?.id || '',
      });
      const avatarUrl = photo?.urlFoto || '';

      if (isFirebaseConfigured && FIRESTORE && avatarUrl) {
        await setDoc(
          doc(FIRESTORE, 'usuarios_roles', String(memberId)),
          {
            idMiembros: Number(memberId),
            avatarUrl,
            photoURL: avatarUrl,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      setMember((prev) => ({ ...prev, avatarUrl }));
      setValue('avatarUrl', avatarUrl, { shouldValidate: true });

      registrarCambiosHistorialMiembro({
        idMiembros: memberId,
        codigoMiembro: member?.codigoMiembro || user?.codigoMiembro || '',
        nombreMiembro: `${member?.nombres ?? user?.nombres ?? ''} ${
          member?.apellidos ?? user?.apellidos ?? ''
        }`.trim(),
        modulo: 'Información general',
        antes: { avatarUrl: member?.avatarUrl || '' },
        despues: { avatarUrl },
        campos: { avatarUrl: 'Foto de perfil' },
        usuario: user,
        metadatos: {
          origen: 'user-account-general',
          accion: 'foto_perfil_usuario',
          realizadoPorElMismoMiembro: true,
        },
      }).catch((historyError) => {
        console.error('[user-account] photo history failed', historyError);
      });

      await checkUserSession?.();
      toast.success(getImageOptimizationMessage(file.__optimizationInfo));

      return avatarUrl;
    } catch (error) {
      console.error('[user-account] upload photo failed', error);
      crearNotificacionErrorSubidaArchivoImagen({
        archivo: file,
        error,
        contexto: 'foto_perfil_usuario',
        usuario: user,
      }).catch((notificationError) => {
        console.error('[user-account] upload error notification failed', notificationError);
      });
      toast.error(error?.message || 'No se pudo subir la foto.');
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    const memberId = Number(member?.idMiembros ?? user?.idMiembros ?? 0) || null;

    if (!memberId) {
      toast.error('No se encontró el miembro para actualizar.');
      return;
    }

    try {
      // Un correo, un miembro: si ya es de otra ficha no se guarda nada.
      if (data.email?.trim()) {
        const listaMiembros = await getMembers().catch(() => []);
        const duplicado = buscarMiembroConCorreo(listaMiembros, data.email, memberId);

        if (duplicado) {
          const mensaje = `Ese correo ya lo usa ${nombreDeMiembro(duplicado)}.`;

          methods.setError('email', { type: 'manual', message: mensaje });
          toast.error(mensaje);

          return;
        }
      }

      const parseGender = (value) => {
        if (value === 'Masculino' || value === 'M') return 'M';
        if (value === 'Femenino' || value === 'F') return 'F';
        return value || '';
      };

      const parseDate = (value) =>
        value && dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD') : null;

      const payload = {
        idMiembros: memberId,
        codigoMiembro: canEditAll
          ? data.codigoMiembro || member.codigoMiembro
          : member.codigoMiembro,
        nombres: canEditAll ? (data.firstName ?? member.nombres ?? '') : (member.nombres ?? ''),
        apellidos: canEditAll
          ? (data.lastName ?? member.apellidos ?? '')
          : (member.apellidos ?? ''),
        genero: canEditAll ? parseGender(data.gender ?? member.genero) : (member.genero ?? ''),
        fechaNacimiento: canEditAll
          ? parseDate(data.birthdate ?? member.fechaNacimiento)
          : (member.fechaNacimiento ?? null),
        idDestacamento: canEditAll
          ? Number(data.destId || member.idDestacamento || 0) || null
          : (member.idDestacamento ?? null),
        telefono: data.phoneNumber ?? member.telefono ?? '',
        direccion: buildAddress({
          provinceId: data.provinceId,
          municipioId: data.municipioId,
          sectorId: data.sectorId,
          street: data.street,
        }),
        correo: data.email?.trim() || null,
        idCargoLocal: canEditAll
          ? (data.idCargoLocal ?? member.idCargoLocal ?? null)
          : (member.idCargoLocal ?? null),
        idCargoInstitucional: canEditAll
          ? (data.idCargoInstitucional ?? member.idCargoInstitucional ?? null)
          : (member.idCargoInstitucional ?? null),
        idDivision: canEditAll
          ? Number(data.idDivision ?? member.idDivision ?? 0) || null
          : (member.idDivision ?? null),
        instructorCertificadoCi: canEditAll
          ? data.instructorCertificadoCi === 'Sí' || data.instructorCertificadoCi === '1'
          : (member.instructorCertificadoCi ?? false),
        estatusVigenciaCi: canEditAll
          ? (data.estatusVigenciaCi ?? member.estatusVigenciaCi ?? null)
          : (member.estatusVigenciaCi ?? null),
        fechaInicioCertificado: canEditAll
          ? parseDate(data.fechaInicioCertificado ?? member.fechaInicioCertificado)
          : (member.fechaInicioCertificado ?? null),
        fechaFinCertificado: canEditAll
          ? parseDate(data.fechaFinCertificado ?? member.fechaFinCertificado)
          : (member.fechaFinCertificado ?? null),
        estatusMiembro: canEditAll
          ? (data.status ?? member.estatusMiembro ?? 'active')
          : (member.estatusMiembro ?? 'active'),
      };

      await updateMemberApi(payload);

      // El correo pasa a ser tambien el de la cuenta: desde ese momento sirve
      // para entrar y para recuperar la clave. Se comprueba siempre que haya
      // correo —no solo cuando cambia aqui—, porque el que ya estaba guardado en
      // la ficha nunca llego a la cuenta. Si ya coincide, el servidor no hace
      // nada.
      const correoNuevo = String(payload.correo || '').trim().toLowerCase();

      if (correoNuevo) {
        try {
          await guardarCorreoDeAcceso({
            idMiembros: memberId,
            codigoMiembro: payload.codigoMiembro,
            correo: correoNuevo,
          });
        } catch (errorCorreo) {
          console.error('[user-account] no se pudo poner el correo en la cuenta', errorCorreo);
          toast.error(
            `${errorCorreo.message} El correo quedó guardado en tu ficha, pero todavía no sirve para iniciar sesión.`
          );
        }
      }

      registrarCambiosHistorialMiembro({
        idMiembros: memberId,
        codigoMiembro: payload.codigoMiembro,
        nombreMiembro: `${payload.nombres ?? ''} ${payload.apellidos ?? ''}`.trim(),
        modulo: 'Información general',
        antes: mapAccountMemberToHistoryPayload(member),
        despues: payload,
        campos: ACCOUNT_HISTORY_FIELDS,
        usuario: user,
        metadatos: {
          origen: 'user-account-general',
          accion: 'actualizacion_cuenta_usuario',
          realizadoPorElMismoMiembro: true,
        },
      }).catch((historyError) => {
        console.error('[user-account] account history failed', historyError);
      });

      if (isFirebaseConfigured && FIRESTORE) {
        await setDoc(
          doc(FIRESTORE, 'usuarios_roles', String(memberId)),
          {
            idMiembros: Number(memberId),
            codigoMiembro: payload.codigoMiembro,
            correo: data.email?.trim() || null,
            nombre: payload.nombres,
            apellidos: payload.apellidos,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      setMember((prev) => ({
        ...prev,
        ...payload,
      }));

      crearNotificacionPerfilActualizado({
        perfil: {
          ...member,
          ...payload,
          origen: 'user-account-general',
        },
        usuario: user,
      }).catch((notificationError) => {
        console.error('[user-account] profile notification failed', notificationError);
      });

      await checkUserSession?.();
      toast.success('Cuenta actualizada con éxito.');
    } catch (error) {
      console.error('[user-account] save failed', error);
      toast.error(error?.message || 'No se pudo actualizar la cuenta.');
    }
  });

  if (!user || loadingMember) {
    return <AccountSectionSkeleton variant="profile" />;
  }

  if (!member) {
    return (
      <Card sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          No se encontró la cuenta del miembro
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Verifica que el usuario tenga un registro en la tabla miembros de la API.
        </Typography>
      </Card>
    );
  }

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ pt: 10, pb: 5, px: 3, textAlign: 'center' }}>
            <Box sx={{ mb: 5 }}>
              <Field.UploadAvatar
                name="avatarUrl"
                loading={uploadingPhoto}
                disabled={uploadingPhoto}
                onDrop={handleUploadAvatar}
                optimizationToast={false}
              />
            </Box>

            <Typography variant="subtitle1">
              {`${member.nombres ?? ''} ${member.apellidos ?? ''}`.trim()}
            </Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {memberCode}
            </Typography>

            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
              {formatStatus(member.estatusMiembro)}
            </Typography>

            <SignOutButton sx={{ mt: 3 }} />
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
              <Field.Text
                name="firstName"
                label="Nombres"
                slotProps={{ htmlInput: { readOnly: !canEditAll } }}
              />
              <Field.Text
                name="lastName"
                label="Apellidos"
                slotProps={{ htmlInput: { readOnly: !canEditAll } }}
              />
              <ReadOnlyTextField name="codigoMiembro" label="Código de miembro" />
              <Field.Text
                name="gender"
                label="Género"
                slotProps={{ htmlInput: { readOnly: !canEditAll } }}
              />
              <Field.DatePicker
                name="birthdate"
                label={`Fecha de nacimiento${age !== null ? ` (${age} años)` : ''}`}
                format="DD/MM/YYYY"
                views={['year', 'month', 'day']}
                disabled={!canEditAll}
              />
              <ReadOnlyTextField name="division" label={divisionLabel} />
              <Field.Text name="phoneNumber" label="Núm. Teléfono" />
              <Field.Text name="email" label="Correo electrónico" />
              <Field.Select name="status" label="Estatus miembro" disabled={!canEditAll}>
                <MenuItem value="active">Activo</MenuItem>
                <MenuItem value="banned">Inactivo</MenuItem>
              </Field.Select>
              {canEditAll ? (
                <Field.Autocomplete
                  name="destId"
                  label="Destacamento"
                  options={dests}
                  value={dests.find((d) => String(d.id) === String(watch('destId'))) || null}
                  getOptionLabel={(option) =>
                    typeof option === 'string'
                      ? option
                      : `${option?.name || ''} ${option?.destNumber || ''}`.trim()
                  }
                  isOptionEqualToValue={(option, value) => String(option?.id) === String(value?.id)}
                  onChange={(event, option) => {
                    methods.setValue('destId', option?.id || '');
                  }}
                />
              ) : (
                <ReadOnlyTextField name="destDisplay" label="Destacamento" />
              )}
              <Field.Text
                name="idCargoLocal"
                label="Cargo local"
                slotProps={{ htmlInput: { readOnly: !canEditAll } }}
              />
              <Field.Text
                name="idCargoInstitucional"
                label="Cargo institucional"
                slotProps={{ htmlInput: { readOnly: !canEditAll } }}
              />
              <Field.Text
                name="instructorCertificadoCi"
                label="Instructor certificado CI"
                slotProps={{ htmlInput: { readOnly: !canEditAll } }}
              />
              <Field.Text
                name="estatusVigenciaCi"
                label="Estatus vigencia CI"
                slotProps={{ htmlInput: { readOnly: !canEditAll } }}
              />
              <Field.DatePicker
                name="fechaInicioCertificado"
                label="Fecha inicio certificado"
                format="DD/MM/YYYY"
                views={['year', 'month', 'day']}
                disabled={!canEditAll}
              />
              <Field.DatePicker
                name="fechaFinCertificado"
                label="Fecha fin certificado"
                format="DD/MM/YYYY"
                views={['year', 'month', 'day']}
                disabled={!canEditAll}
              />

              <Box sx={{ gridColumn: '1 / -1' }}>
                <DashedAccordion title="Dirección" defaultExpanded>
                  <Box
                    sx={{
                      rowGap: 3,
                      columnGap: 2,
                      display: 'grid',
                      gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
                    }}
                  >
                    <LocationSelect />
                  </Box>
                </DashedAccordion>
              </Box>
            </Box>

            <Stack spacing={3} sx={{ mt: 3, alignItems: 'flex-end' }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                Guardar cambios
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Form>
  );
}
