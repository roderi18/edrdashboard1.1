'use client';

import dayjs from 'dayjs';
import { useBoolean, usePopover } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import AlertTitle from '@mui/material/AlertTitle';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { paths } from 'src/routes/paths';

import { getMemberFullName } from 'src/utils/get-member-fullname';
import { getMemberAllowedDestIds } from 'src/utils/member-access';

import { MEMBER_DIVISION_OPTIONS } from 'src/_mock';
import { getDestsApi } from 'src/services/dest-service';
import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { getSectionals } from 'src/services/sectional-service';
import {
  limpiarAsistenciaDestacamento,
  guardarAsistenciaDestacamento,
  obtenerAsistenciaDestacamento,
  obtenerUltimasPresenciasMiembros,
} from 'src/services/attendance-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISOS } from 'src/auth/permissions/permissions';
import { can, puedeModificar } from 'src/auth/permissions/can';

// ----------------------------------------------------------------------

const STATUS_OPTIONS = [
  {
    value: 'excused',
    label: 'Excusa',
    color: 'info',
    icon: 'solar:info-circle-bold',
    width: { xs: 42, sm: 50 },
  },
  {
    value: 'absent',
    label: 'Ausente',
    color: 'warning',
    icon: 'solar:minus-circle-bold',
    width: { xs: 48, sm: 58 },
  },
  {
    value: 'present',
    label: 'Presente',
    color: 'success',
    icon: 'solar:check-circle-bold',
    width: { xs: 48, sm: 58 },
  },
];

const DIVISION_ICON_PATHS = {
  Liderazgo: '/assets/images/divisions/member/liderazgo-ico.png',
  Exploradores: '/assets/images/divisions/member/exploradores-ico.png',
  Seguidores: '/assets/images/divisions/member/seguidores-ico.png',
  Pioneros: '/assets/images/divisions/member/pioneros-ico.png',
  Navegantes: '/assets/images/divisions/member/navegantes-ico.png',
};

const TODAY = new Date().toISOString().slice(0, 10);
const AUTO_ABSENT_STATUS = 'absent-unmarked';

const getMemberDestId = (member) =>
  member?.idDestacamento ?? member?.destId ?? member?.destacamentoId ?? member?.idDest ?? '';

const getDestId = (dest) => String(dest?.id ?? dest?.idDestacamento ?? dest?.destId ?? '');

const getDestName = (dest) => dest?.name || dest?.nombre || dest?.destName || '';

const getDestNumber = (dest) => dest?.destNumber || dest?.numero || dest?.numeroDestacamento || '';

const getDestTitle = (dest, fallbackId = '') => {
  const name = getDestName(dest);
  const number = getDestNumber(dest);
  const label = [name, number].filter(Boolean).join(' ').trim();

  if (!label) {
    return fallbackId ? `Destacamento ${fallbackId}` : 'Destacamento';
  }

  return normalizeText(label).startsWith('destacamento') ? label : `Destacamento ${label}`;
};

const getMemberId = (member) => String(member?.idMiembros ?? member?.id ?? member?.memberId ?? '');

const getFirstWord = (value) =>
  String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || '';

const getMemberName = (member) => {
  const firstName = getFirstWord(member?.firstName ?? member?.nombres);
  const lastName = getFirstWord(member?.lastName ?? member?.apellidos);

  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ');
  }

  const fallbackName =
    getMemberFullName(member) ||
    member?.name ||
    member?.memberName ||
    member?.fullName ||
    member?.codigoMiembro ||
    '';

  const [fallbackFirstName = '', fallbackLastName = ''] = String(fallbackName)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return [fallbackFirstName, fallbackLastName].filter(Boolean).join(' ') || 'Miembro sin nombre';
};

const getMemberAvatar = (member) =>
  member?.avatarUrl || member?.photoURL || member?.urlFoto || member?.fotoUrl || member?.foto || '';

const getDivisionIconSrc = (division) => DIVISION_ICON_PATHS[division] || '';

function DivisionOptionContent({ option }) {
  const iconSrc = getDivisionIconSrc(option?.value);

  return (
    <Stack component="span" direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      {iconSrc ? (
        <Box
          component="img"
          loading="lazy"
          decoding="async"
          alt=""
          src={iconSrc}
          sx={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <Box component="span" sx={{ width: 24, height: 24, flexShrink: 0 }} />
      )}
      <Box
        component="span"
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {option?.label || 'Todos'}
      </Box>
    </Stack>
  );
}

const getMemberAge = (birthdate) => {
  if (!birthdate) return null;

  const parsed = new Date(birthdate);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return age;
};

const resolveMemberDivision = (member) => {
  const currentDivision = String(
    member?.memberDivision ?? member?.division ?? member?.divisionName ?? ''
  ).trim();

  if (currentDivision) {
    const normalized = currentDivision.toLowerCase();
    if (normalized.includes('lider')) return 'Liderazgo';
    if (normalized.includes('explor')) return 'Exploradores';
    if (normalized.includes('segu')) return 'Seguidores';
    if (normalized.includes('pion')) return 'Pioneros';
    if (normalized.includes('naveg')) return 'Navegantes';
    return currentDivision;
  }

  const age = getMemberAge(
    member?.birthDate || member?.birth || member?.dateOfBirth || member?.fechaNacimiento
  );

  if (age === null) return '';
  if (age >= 18) return 'Liderazgo';
  if (age >= 14) return 'Exploradores';
  if (age >= 11) return 'Seguidores';
  if (age >= 8) return 'Pioneros';
  if (age >= 5) return 'Navegantes';

  return '';
};

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const formatAttendanceDate = (value) => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : 'sin registro';
};

function AttendanceMemberSkeleton() {
  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Skeleton variant="circular" width={44} height={44} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="52%" />
          <Skeleton variant="text" width="36%" />
        </Box>
        <Skeleton variant="rounded" width={172} height={50} />
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function AttendanceQuickView() {
  const { user } = useAuthContext();
  const menuActions = usePopover();
  const confirmClear = useBoolean();

  const [date, setDate] = useState(TODAY);
  const [search, setSearch] = useState('');
  const [dests, setDests] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDestId, setSelectedDestId] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [statusByMemberId, setStatusByMemberId] = useState({});
  const [lastPresentByMemberId, setLastPresentByMemberId] = useState({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [estructura, setEstructura] = useState({ churches: [], sectionals: [] });
  // La asistencia se pasa SOBRE SU GENTE. Sin la estructura, `getMemberAllowedDestIds`
  // no puede acotar y devuelve "sin restriccion": el desplegable ofrecia los
  // destacamentos del pais entero.
  const allowedDestIds = useMemo(
    () => getMemberAllowedDestIds(user, { churches: estructura.churches, sectionals: estructura.sectionals }),
    [user, estructura]
  );
  const scopedToDest = allowedDestIds instanceof Set;
  // Quien no lleva `asistencia.ver` no entra, aunque escriba la URL: el menu no
  // le ofrecia la pantalla, pero la pantalla no comprobaba nada.
  const puedeVerAsistencia = can(user, PERMISOS.ASISTENCIA_VER);
  // Y pasarla es otra cosa que verla: los cargos de consulta —solo lectura— no
  // marcan a nadie.
  const puedePasarAsistencia =
    puedeModificar(user, PERMISOS.ASISTENCIA_CREAR) ||
    puedeModificar(user, PERMISOS.ASISTENCIA_EDITAR);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);

      try {
        const [memberItems, destItems, churches, sectionals] = await Promise.all([
          getMembers(),
          getDestsApi(),
          getChurches().catch(() => []),
          getSectionals({ includePhotos: false }).catch(() => []),
        ]);

        if (!active) return;

        setEstructura({ churches, sectionals });

        const nextDests = Array.isArray(destItems)
          ? destItems.filter((dest) => {
            if (!(allowedDestIds instanceof Set)) {
              return true;
            }

            return allowedDestIds.has(getDestId(dest));
          })
          : [];
        const nextMembers = Array.isArray(memberItems) ? memberItems : [];

        setDests(nextDests);
        setMembers(nextMembers);

        if (nextDests.length) {
          setSelectedDestId(
            (current) =>
              nextDests.some((dest) => getDestId(dest) === String(current))
                ? current
                : getDestId(nextDests[0])
          );
        } else {
          setSelectedDestId('');
        }
      } catch {
        toast.error('No se pudo cargar la lista de asistencia.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [allowedDestIds]);

  const selectedDest = useMemo(
    () =>
      dests.find((dest) =>
        [dest?.id, dest?.idDestacamento, dest?.destId].some((value) => String(value ?? '') === String(selectedDestId))
      ),
    [dests, selectedDestId]
  );
  const attendanceTitle = selectedDestId
    ? `Asistencia ${getDestTitle(selectedDest, selectedDestId)}`
    : 'Asistencia';
  const showDestFilter = !scopedToDest;

  const selectedDestMembers = useMemo(
    () =>
      members
        .filter((member) => String(getMemberDestId(member)) === String(selectedDestId))
        .sort((a, b) => getMemberName(a).localeCompare(getMemberName(b))),
    [members, selectedDestId]
  );

  const divisionFilteredMembers = useMemo(() => {
    if (selectedDivision === 'all') {
      return selectedDestMembers;
    }

    return selectedDestMembers.filter(
      (member) => resolveMemberDivision(member) === selectedDivision
    );
  }, [selectedDestMembers, selectedDivision]);

  const visibleMembers = useMemo(() => {
    const query = normalizeText(search);

    if (!query) {
      return divisionFilteredMembers;
    }

    return divisionFilteredMembers.filter((member) =>
      [
        getMemberName(member),
        resolveMemberDivision(member),
        member?.memberId,
        member?.codigoMiembro,
        member?.phoneNumber,
      ]
        .map(normalizeText)
        .some((value) => value.includes(query))
    );
  }, [search, divisionFilteredMembers]);

  useEffect(() => {
    let active = true;

    const loadAttendance = async () => {
      if (!selectedDestId) {
        setStatusByMemberId({});
        return;
      }

      try {
        setLoadingAttendance(true);
        const statuses = await obtenerAsistenciaDestacamento({
          fecha: date,
          idDestacamento: selectedDestId,
        });

        if (active) {
          setStatusByMemberId(statuses);
        }
      } catch (error) {
        if (active) {
          setStatusByMemberId({});
          toast.error(error?.message || 'No se pudo cargar la asistencia desde Firebase.');
        }
      } finally {
        if (active) {
          setLoadingAttendance(false);
        }
      }
    };

    loadAttendance();

    return () => {
      active = false;
    };
  }, [date, selectedDestId]);

  useEffect(() => {
    let active = true;

    const loadLastPresentDates = async () => {
      const memberIds = selectedDestMembers.map(getMemberId).filter(Boolean);

      if (!memberIds.length) {
        setLastPresentByMemberId({});
        return;
      }

      const dates = await obtenerUltimasPresenciasMiembros(memberIds);

      if (active) {
        setLastPresentByMemberId(dates);
      }
    };

    loadLastPresentDates();

    return () => {
      active = false;
    };
  }, [selectedDestMembers]);

  const counts = useMemo(() => {
    const base = { present: 0, absent: 0, excused: 0, pending: 0 };

    divisionFilteredMembers.forEach((member) => {
      const status = statusByMemberId[getMemberId(member)];

      if (status === AUTO_ABSENT_STATUS) {
        base.absent += 1;
      } else if (status && base[status] !== undefined) {
        base[status] += 1;
      } else {
        base.pending += 1;
      }
    });

    return base;
  }, [divisionFilteredMembers, statusByMemberId]);

  const handleStatusChange = useCallback((memberId, status) => {
    setStatusByMemberId((current) => {
      const next = { ...current };

      if (next[memberId] === status) {
        delete next[memberId];
        return next;
      }

      next[memberId] = status;
      return next;
    });
  }, []);

  const handleMarkAllPresent = useCallback(() => {
    setStatusByMemberId((current) => {
      const next = { ...current };

      divisionFilteredMembers.forEach((member) => {
        next[getMemberId(member)] = 'present';
      });

      return next;
    });
  }, [divisionFilteredMembers]);

  const handleClear = useCallback(() => {
    setStatusByMemberId({});
  }, []);

  const getAuditUser = useCallback(
    () =>
      user
        ? {
          uid: user.uid || user.id || '',
          nombre:
            user.displayName ||
            user.name ||
            [user.nombres, user.apellidos].filter(Boolean).join(' ') ||
            user.email ||
            '',
          correo: user.email || '',
        }
        : null,
    [user]
  );

  const handleClearSaved = useCallback(async () => {
    if (!selectedDestId) {
      return;
    }

    try {
      setSavingAttendance(true);
      await limpiarAsistenciaDestacamento({
        fecha: date,
        idDestacamento: selectedDestId,
        usuario: getAuditUser(),
      });
      handleClear();
      toast.success('Asistencia limpiada.');
    } catch (error) {
      toast.error(error?.message || 'No se pudo limpiar la asistencia.');
    } finally {
      setSavingAttendance(false);
    }
  }, [date, getAuditUser, handleClear, selectedDestId]);

  const handleSave = useCallback(async () => {
    // Ver la asistencia y PASARLA son cosas distintas: los cargos de consulta
    // —solo lectura— entran a mirarla y no marcan a nadie. La comprobacion de
    // verdad la hace el servidor; esto evita lanzar una escritura que va a
    // rechazar y, sobre todo, no ofrecer un boton que miente.
    if (!puedePasarAsistencia) {
      toast.error('Tu cargo no pasa asistencia.');
      return;
    }

    if (!selectedDestId) {
      return;
    }

    const statusesToSave = { ...statusByMemberId };

    divisionFilteredMembers.forEach((member) => {
      const memberId = getMemberId(member);

      if (!statusesToSave[memberId]) {
        statusesToSave[memberId] = AUTO_ABSENT_STATUS;
      }
    });

    try {
      setSavingAttendance(true);

      await guardarAsistenciaDestacamento({
        fecha: date,
        destacamento: {
          idDestacamento: selectedDestId,
          nombreDestacamento: selectedDest?.name || selectedDest?.nombre || '',
        },
        miembros: divisionFilteredMembers,
        estados: statusesToSave,
        usuario: getAuditUser(),
      });

      setStatusByMemberId(statusesToSave);
      setLastPresentByMemberId((current) => {
        const next = { ...current };

        divisionFilteredMembers.forEach((member) => {
          const memberId = getMemberId(member);

          if (statusesToSave[memberId] === 'present') {
            next[memberId] = date;
          }
        });

        return next;
      });
      toast.success('Asistencia guardada en Firebase.');
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la asistencia en Firebase.');
    } finally {
      setSavingAttendance(false);
    }
  }, puedePasarAsistencia, [
    date,
    selectedDest,
    selectedDestId,
    statusByMemberId,
    divisionFilteredMembers,
    getAuditUser,
  ]);

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList sx={{ minWidth: 220 }}>
        <MenuItem
          onClick={() => {
            menuActions.onClose();
            confirmClear.onTrue();
          }}
          sx={{ whiteSpace: 'nowrap' }}
        >
          <Iconify icon="solar:restart-bold-duotone" />
          Limpiar
        </MenuItem>

        <MenuItem
          disabled={!divisionFilteredMembers.length}
          onClick={() => {
            menuActions.onClose();
            handleMarkAllPresent();
          }}
          sx={{ whiteSpace: 'nowrap' }}
        >
          <Iconify icon="solar:check-circle-bold" />
          Marcar todos presentes
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  const renderConfirmClearDialog = () => (
    <ConfirmDialog
      open={confirmClear.value}
      onClose={confirmClear.onFalse}
      title="Limpiar asistencia"
      content="¿Seguro que deseas limpiar las marcas de asistencia de esta vista?"
      action={
        <Button
          variant="contained"
          color="warning"
          disabled={savingAttendance}
          onClick={async () => {
            await handleClearSaved();
            confirmClear.onFalse();
          }}
        >
          {savingAttendance ? 'Limpiando...' : 'Limpiar'}
        </Button>
      }
    />
  );

  // La pantalla no comprobaba NADA: el menu no se la ofrecia a quien no lleva
  // `asistencia.ver`, pero escribiendo la URL entraba cualquiera —y con el
  // desplegable de destacamentos del pais entero, porque el alcance se pedia sin
  // estructura con la que acotarlo—.
  if (!puedeVerAsistencia) {
    return (
      <DashboardContent>
        <CustomBreadcrumbs
          heading="Asistencia"
          links={[{ name: 'Panel', href: paths.dashboard.root }, { name: 'Asistencia' }]}
          sx={{ mb: 3 }}
        />

        <Alert severity="info" sx={{ alignItems: 'center' }}>
          <AlertTitle>La asistencia no te toca</AlertTitle>
          Este cargo no pasa asistencia. Si crees que deberías, pídeselo a tu Coordinador de
          Destacamento.
        </Alert>
      </DashboardContent>
    );
  }

  return (
    <>
      <DashboardContent sx={{ pb: 'calc(var(--layout-dashboard-content-pb) + 72px)' }}>
        <CustomBreadcrumbs
          heading={attendanceTitle}
          links={[{ name: 'Panel', href: paths.dashboard.root }, { name: 'Asistencia' }]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card
          sx={{
            p: { xs: 2, md: 3 },
            mb: 3,
            bgcolor: 'background.paper',
          }}
        >
          <Stack spacing={2.5}>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: showDestFilter
                    ? 'minmax(220px, 1.25fr) minmax(220px, 1fr) minmax(180px, 0.75fr) minmax(170px, 0.75fr)'
                    : 'minmax(220px, 1.25fr) minmax(180px, 0.75fr) minmax(170px, 0.75fr)',
                },
              }}
            >
              <TextField
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar miembro..."
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              {showDestFilter && (
                <TextField
                  select
                  label="Destacamento"
                  value={selectedDestId}
                  onChange={(event) => setSelectedDestId(event.target.value)}
                >
                  {dests.map((dest) => {
                    const destId = getDestId(dest);

                    return (
                      <MenuItem key={destId || getDestName(dest)} value={destId}>
                        {getDestTitle(dest, destId)}
                      </MenuItem>
                    );
                  })}
                </TextField>
              )}

              <DatePicker
                label="Fecha"
                value={date ? dayjs(date) : null}
                onChange={(newValue) => {
                  const parsed = dayjs(newValue);
                  setDate(parsed.isValid() ? parsed.format('YYYY-MM-DD') : '');
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                  },
                }}
              />

              <TextField
                select
                label="División"
                value={selectedDivision}
                onChange={(event) => setSelectedDivision(event.target.value)}
                slotProps={{
                  select: {
                    renderValue: (selected) => {
                      const option =
                        MEMBER_DIVISION_OPTIONS.find((division) => division.value === selected) ||
                        MEMBER_DIVISION_OPTIONS[0];

                      return <DivisionOptionContent option={option} />;
                    },
                  },
                }}
              >
                {MEMBER_DIVISION_OPTIONS.map((division) => (
                  <MenuItem key={division.value} value={division.value}>
                    <DivisionOptionContent option={division} />
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
              sx={{ width: 1 }}
            >
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip color="success" label={`${counts.present} presentes`} />
                <Chip color="warning" label={`${counts.absent} ausentes`} />
                <Chip color="info" label={`${counts.excused} excusas`} />
              </Stack>
              <IconButton
                color="inherit"
                onClick={menuActions.onOpen}
                edge="end"
                sx={{ width: 32, height: 32 }}
                aria-label="Acciones de asistencia"
              >
                <Iconify icon="eva:more-vertical-fill" />
              </IconButton>
            </Stack>
          </Stack>
        </Card>

        <Stack spacing={1.5}>
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => <AttendanceMemberSkeleton key={index} />)
          ) : loadingAttendance ? (
            Array.from({ length: Math.max(visibleMembers.length, 3) }).map((_, index) => (
              <AttendanceMemberSkeleton key={index} />
            ))
          ) : (
            <>
              {visibleMembers.map((member) => {
                const memberId = getMemberId(member);
                const memberName = getMemberName(member);
                const status = statusByMemberId[memberId] || '';
                const avatarUrl = getMemberAvatar(member);

                return (
                  <Card
                    key={memberId}
                    sx={{ p: { xs: 2, md: 2.5 }, minHeight: { xs: 82, sm: 92 } }}
                  >
                    <Stack
                      direction="row"
                      spacing={{ xs: 1, sm: 2 }}
                      alignItems="center"
                      sx={{ minWidth: 0 }}
                    >
                      <Stack
                        direction="row"
                        spacing={{ xs: 1, sm: 2 }}
                        alignItems="center"
                        sx={{ flex: '1 1 auto', minWidth: 0 }}
                      >
                        <Avatar
                          src={avatarUrl}
                          alt={memberName}
                          sx={{
                            width: { xs: 42, sm: 50 },
                            height: { xs: 42, sm: 50 },
                            flexShrink: 0,
                          }}
                        >
                          {memberName.charAt(0)}
                        </Avatar>

                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" noWrap>
                            {memberName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            Última: {formatAttendanceDate(lastPresentByMemberId[memberId])}
                          </Typography>
                        </Box>
                      </Stack>

                      <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} sx={{ flexShrink: 0 }}>
                        {STATUS_OPTIONS.map((option) => (
                          <Button
                            key={option.value}
                            aria-label={option.label}
                            title={option.label}
                            size="small"
                            color={option.color}
                            variant={status === option.value ? 'contained' : 'outlined'}
                            onClick={() => handleStatusChange(memberId, option.value)}
                            sx={{
                              width: option.width,
                              minWidth: option.width,
                              height: 50,
                              px: 0,
                            }}
                          >
                            <Iconify icon={option.icon} width={18} />
                          </Button>
                        ))}
                      </Stack>
                    </Stack>
                  </Card>
                );
              })}

              {!visibleMembers.length && (
                <Card sx={{ p: 5, textAlign: 'center' }}>
                  <Iconify
                    icon="solar:users-group-rounded-bold"
                    width={40}
                    sx={{ color: 'text.disabled', mb: 1 }}
                  />
                  <Typography variant="subtitle1">
                    {selectedDestId
                      ? 'Sin miembros en este destacamento'
                      : 'Selecciona un destacamento'}
                  </Typography>
                </Card>
              )}

              {!!visibleMembers.length && (
                <Stack
                  sx={(theme) => ({
                    pt: 1,
                    bottom: { xs: 16, md: 24 },
                    zIndex: theme.zIndex.appBar - 1,
                    position: 'sticky',
                  })}
                >
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Iconify icon="solar:diskette-bold" />}
                    onClick={handleSave}
                    disabled={!selectedDestId || savingAttendance}
                  >
                    {savingAttendance ? 'Guardando...' : 'Guardar'}
                  </Button>
                </Stack>
              )}
            </>
          )}
        </Stack>
      </DashboardContent>

      {renderMenuActions()}
      {renderConfirmClearDialog()}
    </>
  );
}
