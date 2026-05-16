'use client';

import dayjs from 'dayjs';
import { usePopover } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { paths } from 'src/routes/paths';

import { getMemberFullName } from 'src/utils/get-member-fullname';

import { MEMBER_DIVISION_OPTIONS } from 'src/_mock';
import { getDestsApi } from 'src/services/dest-service';
import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

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

const getAttendanceStorageKey = (date, destId) => `rr-attendance:${date}:${destId}`;

const getMemberDestId = (member) =>
  member?.idDestacamento ?? member?.destId ?? member?.destacamentoId ?? member?.idDest ?? '';

const getMemberId = (member) => String(member?.idMiembros ?? member?.id ?? member?.memberId ?? '');

const getFirstWord = (value) => String(value ?? '').trim().split(/\s+/).filter(Boolean)[0] || '';

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
          alt=""
          src={iconSrc}
          sx={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <Box component="span" sx={{ width: 24, height: 24, flexShrink: 0 }} />
      )}
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

const getStoredLastPresentDates = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  const latestByMemberId = {};

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (!key?.startsWith('rr-attendance:')) {
      continue;
    }

    try {
      const stored = JSON.parse(window.localStorage.getItem(key) || '{}');
      const [, keyDate] = key.split(':');
      const attendanceDate = stored?.date || keyDate;
      const statuses = stored?.statuses && typeof stored.statuses === 'object' ? stored.statuses : {};

      Object.entries(statuses).forEach(([memberId, status]) => {
        if (status !== 'present') {
          return;
        }

        const currentDate = latestByMemberId[memberId];

        if (!currentDate || dayjs(attendanceDate).isAfter(dayjs(currentDate))) {
          latestByMemberId[memberId] = attendanceDate;
        }
      });
    } catch {
      // Ignore malformed local attendance snapshots.
    }
  }

  return latestByMemberId;
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
  const menuActions = usePopover();

  const [date, setDate] = useState(TODAY);
  const [search, setSearch] = useState('');
  const [dests, setDests] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDestId, setSelectedDestId] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [statusByMemberId, setStatusByMemberId] = useState({});
  const [lastPresentByMemberId, setLastPresentByMemberId] = useState({});
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);

      try {
        const [memberItems, destItems] = await Promise.all([getMembers(), getDestsApi()]);

        if (!active) return;

        const nextDests = Array.isArray(destItems) ? destItems : [];
        const nextMembers = Array.isArray(memberItems) ? memberItems : [];

        setDests(nextDests);
        setMembers(nextMembers);

        if (nextDests.length) {
          setSelectedDestId(
            (current) => current || String(nextDests[0]?.id ?? nextDests[0]?.idDestacamento ?? '')
          );
        }
      } catch (error) {
        console.error('Error loading attendance data:', error);
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
  }, []);

  const selectedDest = useMemo(
    () =>
      dests.find((dest) =>
        [dest?.id, dest?.idDestacamento, dest?.destId].some(
          (value) => String(value ?? '') === String(selectedDestId)
        )
      ),
    [dests, selectedDestId]
  );

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

    return selectedDestMembers.filter((member) => resolveMemberDivision(member) === selectedDivision);
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
    setStorageReady(false);

    if (!selectedDestId) {
      setStatusByMemberId({});
      setStorageReady(true);
      return;
    }

    try {
      const stored = window.localStorage.getItem(getAttendanceStorageKey(date, selectedDestId));
      const parsed = stored ? JSON.parse(stored) : {};

      setStatusByMemberId(
        parsed?.statuses && typeof parsed.statuses === 'object' ? parsed.statuses : {}
      );
    } catch {
      setStatusByMemberId({});
    } finally {
      setStorageReady(true);
    }
  }, [date, selectedDestId]);

  useEffect(() => {
    if (!storageReady || !selectedDestId) {
      return;
    }

    window.localStorage.setItem(
      getAttendanceStorageKey(date, selectedDestId),
      JSON.stringify({
        date,
        destId: selectedDestId,
        destName: selectedDest?.name || '',
        statuses: statusByMemberId,
        updatedAt: new Date().toISOString(),
      })
    );
  }, [date, selectedDest, selectedDestId, statusByMemberId, storageReady]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    setLastPresentByMemberId(getStoredLastPresentDates());
  }, [date, selectedDestId, statusByMemberId, storageReady]);

  const counts = useMemo(() => {
    const base = { present: 0, absent: 0, excused: 0, pending: 0 };

    divisionFilteredMembers.forEach((member) => {
      const status = statusByMemberId[getMemberId(member)];

      if (status && base[status] !== undefined) {
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

  const handleSave = useCallback(() => {
    toast.success('Asistencia guardada localmente.');
  }, []);

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
            handleClear();
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

  return (
    <>
      <DashboardContent sx={{ pb: 'calc(var(--layout-dashboard-content-pb) + 72px)' }}>
        <CustomBreadcrumbs
          heading="Asistencia rapida"
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Asistencia' },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card
          sx={(theme) => ({
            p: { xs: 2, md: 3 },
            mb: 3,
            top: { xs: 72, md: 88 },
            zIndex: theme.zIndex.appBar - 1,
            position: 'sticky',
            bgcolor: 'background.paper',
          })}
        >
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', md: 'center' }}
            >
              <TextField
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar miembro..."
                sx={{
                  flex: { md: '1 1 auto' },
                  minWidth: { md: 320 },
                }}
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

              <TextField
                select
                label="Destacamento"
                value={selectedDestId}
                onChange={(event) => setSelectedDestId(event.target.value)}
                sx={{
                  flex: { md: '0 0 300px' },
                }}
              >
                {dests.map((dest) => {
                  const destId = String(dest?.id ?? dest?.idDestacamento ?? '');

                  return (
                    <MenuItem key={destId || dest.name} value={destId}>
                      {dest?.name || `Dest. ${destId}`}
                    </MenuItem>
                  );
                })}
              </TextField>

              <Stack
                direction="row"
                spacing={2}
                sx={{
                  width: { xs: 1, md: 'auto' },
                  flex: { md: '0 0 420px' },
                }}
              >
                <DatePicker
                  label="Fecha"
                  value={date ? dayjs(date) : null}
                  onChange={(newValue) => {
                    const parsed = dayjs(newValue);
                    setDate(parsed.isValid() ? parsed.format('YYYY-MM-DD') : '');
                  }}
                slotProps={{
                  textField: {
                    sx: { flex: '1 1 0' },
                  },
                }}
              />

                <TextField
                  select
                  label="División"
                  value={selectedDivision}
                  onChange={(event) => setSelectedDivision(event.target.value)}
                  sx={{ flex: '1 1 0' }}
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
              </Stack>
            </Stack>

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
                    {selectedDestId ? 'Sin miembros en este destacamento' : 'Selecciona un destacamento'}
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
                    disabled={!selectedDestId}
                  >
                    Guardar
                  </Button>
                </Stack>
              )}
            </>
          )}
        </Stack>
      </DashboardContent>

      {renderMenuActions()}
    </>
  );
}
