'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { formatPhoneNumber } from 'src/utils/format-phone-number';
import { getMemberFullName } from 'src/utils/get-member-fullname';

import { getDestsApi } from 'src/services/dest-service';
import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: 'present', label: 'Presente', color: 'success' },
  { value: 'absent', label: 'Ausente', color: 'warning' },
  { value: 'excused', label: 'Excusa', color: 'info' },
];

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

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

function AttendanceMemberSkeleton() {
  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Skeleton variant="circular" width={44} height={44} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="52%" />
          <Skeleton variant="text" width="36%" />
        </Box>
        <Skeleton variant="rounded" width={240} height={36} />
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function AttendanceQuickView() {
  const [date, setDate] = useState(TODAY);
  const [search, setSearch] = useState('');
  const [dests, setDests] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDestId, setSelectedDestId] = useState('');
  const [statusByMemberId, setStatusByMemberId] = useState({});
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
          setSelectedDestId((current) => current || String(nextDests[0]?.id ?? nextDests[0]?.idDestacamento ?? ''));
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

  const visibleMembers = useMemo(() => {
    const query = normalizeText(search);

    if (!query) {
      return selectedDestMembers;
    }

    return selectedDestMembers.filter((member) =>
      [getMemberName(member), member?.memberId, member?.codigoMiembro, member?.phoneNumber]
        .map(normalizeText)
        .some((value) => value.includes(query))
    );
  }, [search, selectedDestMembers]);

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

      setStatusByMemberId(parsed?.statuses && typeof parsed.statuses === 'object' ? parsed.statuses : {});
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

  const counts = useMemo(() => {
    const base = { present: 0, absent: 0, excused: 0, pending: 0 };

    selectedDestMembers.forEach((member) => {
      const status = statusByMemberId[getMemberId(member)];

      if (status && base[status] !== undefined) {
        base[status] += 1;
      } else {
        base.pending += 1;
      }
    });

    return base;
  }, [selectedDestMembers, statusByMemberId]);

  const handleStatusChange = useCallback((memberId, status) => {
    setStatusByMemberId((current) => ({
      ...current,
      [memberId]: status,
    }));
  }, []);

  const handleMarkAllPresent = useCallback(() => {
    setStatusByMemberId((current) => {
      const next = { ...current };

      selectedDestMembers.forEach((member) => {
        next[getMemberId(member)] = 'present';
      });

      return next;
    });
  }, [selectedDestMembers]);

  const handleClear = useCallback(() => {
    setStatusByMemberId({});
  }, []);

  const handleSave = useCallback(() => {
    toast.success('Asistencia guardada localmente.');
  }, []);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Asistencia rapida"
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Niveles Organizacionales', href: paths.dashboard.level.root },
          { name: 'Asistencia' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <TextField
              select
              label="Destacamento"
              value={selectedDestId}
              onChange={(event) => setSelectedDestId(event.target.value)}
              sx={{ minWidth: { md: 300 } }}
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

            <TextField
              type="date"
              label="Fecha"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: { md: 180 } }}
            />

            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar miembro..."
              sx={{ flex: 1 }}
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
          </Stack>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`${selectedDestMembers.length} miembros`} />
              <Chip color="success" label={`${counts.present} presentes`} />
              <Chip color="warning" label={`${counts.absent} ausentes`} />
              <Chip color="info" label={`${counts.excused} excusas`} />
              <Chip variant="outlined" label={`${counts.pending} pendientes`} />
            </Stack>

            <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-end', md: 'initial' }}>
              <Button
                color="inherit"
                variant="outlined"
                startIcon={<Iconify icon="solar:restart-bold" />}
                onClick={handleClear}
              >
                Limpiar
              </Button>
              <Button
                color="inherit"
                variant="outlined"
                startIcon={<Iconify icon="solar:checklist-minimalistic-bold" />}
                onClick={handleMarkAllPresent}
                disabled={!selectedDestMembers.length}
              >
                Todos presentes
              </Button>
              <Button
                variant="contained"
                startIcon={<Iconify icon="solar:diskette-bold" />}
                onClick={handleSave}
                disabled={!selectedDestId}
              >
                Guardar local
              </Button>
            </Stack>
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
                <Card key={memberId} sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                      <Avatar src={avatarUrl} alt={memberName} sx={{ width: 44, height: 44 }}>
                        {memberName.charAt(0)}
                      </Avatar>

                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>
                          {memberName}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" divider={<Divider orientation="vertical" flexItem />}>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {formatPhoneNumber(member?.phoneNumber)}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" noWrap>
                            {member?.memberId || member?.codigoMiembro || 'Sin codigo'}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-end', sm: 'initial' }}>
                      {STATUS_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          size="small"
                          color={option.color}
                          variant={status === option.value ? 'contained' : 'outlined'}
                          onClick={() => handleStatusChange(memberId, option.value)}
                          sx={{ minWidth: { xs: 0, sm: 88 } }}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </Stack>
                  </Stack>
                </Card>
              );
            })}

            {!visibleMembers.length && (
              <Card sx={{ p: 5, textAlign: 'center' }}>
                <Iconify icon="solar:users-group-rounded-bold" width={40} sx={{ color: 'text.disabled', mb: 1 }} />
                <Typography variant="subtitle1">
                  {selectedDestId ? 'Sin miembros en este destacamento' : 'Selecciona un destacamento'}
                </Typography>
              </Card>
            )}
          </>
        )}
      </Stack>
    </DashboardContent>
  );
}
