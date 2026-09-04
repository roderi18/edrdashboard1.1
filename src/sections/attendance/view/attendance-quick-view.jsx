'use client';

import dayjs from 'dayjs';
import { varAlpha } from 'minimal-shared/utils';
import { useBoolean, usePopover } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import AlertTitle from '@mui/material/AlertTitle';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { getMemberFullName } from 'src/utils/get-member-fullname';
import { getMemberAllowedDestIds } from 'src/utils/member-access';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';

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

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { ExportTableButton } from 'src/components/export-table-button';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISOS } from 'src/auth/permissions/permissions';
import { can, puedeModificar } from 'src/auth/permissions/can';

// ----------------------------------------------------------------------

const AUTO_ABSENT_STATUS = 'absent-unmarked';

// PASAR LISTA NO ES SOLO "VINO O NO VINO".
//
// A las tres marcas de siempre —asistio, ausente, excusa— se suman "Enfermo",
// que ya no es lo mismo que una excusa cualquiera y conviene poder contarlo
// aparte, y "Otro", para lo que no entra en ninguna: sin ella, quien pasa lista
// tenia que elegir la marca menos falsa.
//
// El orden es el de la fila: de lo mas frecuente a lo menos.
const STATUS_OPTIONS = [
  {
    value: 'present',
    label: 'Asistió',
    color: 'success',
    icon: 'solar:check-circle-bold',
  },
  {
    value: 'absent',
    label: 'Ausente',
    color: 'warning',
    icon: 'solar:minus-circle-bold',
  },
  {
    value: 'excused',
    label: 'Excusa',
    color: 'info',
    icon: 'solar:document-text-bold',
  },
  {
    value: 'sick',
    label: 'Enfermo',
    color: 'secondary',
    icon: 'solar:health-bold',
  },
  {
    value: 'other',
    label: 'Otro',
    color: 'inherit',
    icon: 'solar:menu-dots-bold',
  },
];

const STATUS_OPTION_BY_VALUE = Object.fromEntries(
  STATUS_OPTIONS.map((option) => [option.value, option])
);

// Los contadores de arriba, que ademas FILTRAN la lista. "Otro" no tiene el
// suyo: es el cajon de lo que no encaja, y un contador de "otros" no dice nada
// que se pueda mirar de un vistazo.
const STATUS_FILTERS = [
  { value: 'present', label: 'Presentes', color: 'success' },
  { value: 'absent', label: 'Ausentes', color: 'warning' },
  { value: 'excused', label: 'Con excusa', color: 'info' },
  { value: 'sick', label: 'Enfermos', color: 'secondary' },
];

// Lo que se lee en la columna ESTADO. Sin marcar no es lo mismo que ausente:
// nadie ha dicho todavia nada de esta persona.
const SIN_REGISTRO = { label: 'Sin registro', color: 'default' };

const getStatusLabel = (status) => {
  if (status === AUTO_ABSENT_STATUS) {
    return { label: 'Ausente', color: 'warning' };
  }

  const option = STATUS_OPTION_BY_VALUE[status];

  return option ? { label: option.label, color: option.color } : SIN_REGISTRO;
};

const DIVISION_ICON_PATHS = {
  // "Todos" es el valor `all` del desplegable, no una division: lleva el icono
  // de Exploradores del Rey, que es la casa entera. Sin el, la unica opcion sin
  // imagen era justamente la primera, y la lista arrancaba con un hueco.
  all: '/exploradores-del-rey-icono.ico',
  Liderazgo: '/assets/images/divisions/member/liderazgo-ico.png',
  Exploradores: '/assets/images/divisions/member/exploradores-ico.png',
  Seguidores: '/assets/images/divisions/member/seguidores-ico.png',
  Pioneros: '/assets/images/divisions/member/pioneros-ico.png',
  Navegantes: '/assets/images/divisions/member/navegantes-ico.png',
};

const TODAY = new Date().toISOString().slice(0, 10);

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

// La MISMA rejilla para la cabecera y para cada fila: es lo unico que mantiene
// las columnas alineadas. En movil se apila —una fila de cuatro columnas no cabe
// en 375px— y la cabecera se esconde, porque cada dato ya se explica solo.
//
// Las tres ultimas columnas van con ANCHO FIJO a proposito. Con `auto` cada
// rejilla se medía por su contenido: en la cabecera la ultima columna era el
// ancho de la palabra "Acciones" y en la fila el de cinco botones, asi que los
// titulos aparecian corridos respecto de lo que nombraban.
//
// Los 352px de "Acciones" son exactamente los cinco botones: 5 x 64 mas los
// cuatro huecos de 8. Si cambia el tamaño del boton, cambia aqui.
const ANCHO_ACCIONES = 5 * 64 + 4 * 8;

// Se reparte por AREAS y no por orden, porque en cada tamaño van en sitios
// distintos: en pantalla ancha las cuatro en una fila, y en el movil el nombre y
// su estado arriba —el estado a la derecha, que es donde se busca—, el resumen
// del dia debajo y los botones al final, ocupando el ancho.
const FILA_ASISTENCIA_SX = {
  display: 'grid',
  alignItems: 'center',
  gap: { xs: 1.5, md: 2 },
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr) auto',
    md: `minmax(0, 1fr) 132px 200px ${ANCHO_ACCIONES}px`,
  },
  gridTemplateAreas: {
    xs: `"miembro estado" "asistencia asistencia" "acciones acciones"`,
    md: `"miembro estado asistencia acciones"`,
  },
};

// Cada titulo sobre lo que nombra: el nombre a la izquierda y las otras tres
// centradas, que es como se reparte el contenido de la fila.
const COLUMNAS_ASISTENCIA = [
  { titulo: 'Miembro', alineacion: 'left', area: 'miembro' },
  { titulo: 'Estado', alineacion: 'center', area: 'estado' },
  { titulo: 'Asistencia del día', alineacion: 'center', area: 'asistencia' },
  { titulo: 'Acciones', alineacion: 'center', area: 'acciones' },
];

const getMemberCode = (member) => member?.memberId || member?.codigoMiembro || '';

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
  const resumenDelDia = useBoolean();

  const [date, setDate] = useState(TODAY);
  const [search, setSearch] = useState('');
  const [dests, setDests] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDestId, setSelectedDestId] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('all');
  // Contador pulsado arriba: '' es "todos". Se pulsa de nuevo y se suelta.
  const [statusFilter, setStatusFilter] = useState('');
  const [memberPhotoUrls, setMemberPhotoUrls] = useState({});
  const [statusByMemberId, setStatusByMemberId] = useState({});
  const [lastPresentByMemberId, setLastPresentByMemberId] = useState({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [estructura, setEstructura] = useState({ churches: [], sectionals: [] });
  // La asistencia se pasa SOBRE SU GENTE. Sin la estructura, `getMemberAllowedDestIds`
  // no puede acotar y devuelve "sin restriccion": el desplegable ofrecia los
  // destacamentos del pais entero.
  const allowedDestIds = useMemo(
    () =>
      getMemberAllowedDestIds(user, {
        churches: estructura.churches,
        sectionals: estructura.sectionals,
      }),
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
          setSelectedDestId((current) =>
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

  // LA CARA DE CADA UNO. Pasar lista es reconocer a la persona, y aqui salian
  // todos con la inicial en un circulo de color: el mismo grupo que en la lista
  // de miembros se ve con su foto.
  //
  // Las fotos viven en Firebase, no en el padron, asi que van por su cuenta y
  // sin bloquear la lista: aparecen cuando llegan, y si no llegan queda la
  // inicial de siempre.
  useEffect(() => {
    let active = true;

    obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' })
      .then((fotos) => {
        if (!active) return;

        setMemberPhotoUrls(
          Object.fromEntries(
            Object.entries(fotos)
              .filter(([, foto]) => foto?.urlFoto)
              .map(([idMiembro, foto]) => [String(idMiembro), foto.urlFoto])
          )
        );
      })
      .catch((error) => {
        console.error('[asistencia] no se pudieron cargar las fotos de los miembros', error);
      });

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

  const searchedMembers = useMemo(() => {
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

  // Los contadores de arriba filtran: pulsar "2 Ausentes" deja en pantalla esos
  // dos. Va DESPUES de la busqueda para que las dos cosas se sumen en vez de
  // pisarse.
  const visibleMembers = useMemo(() => {
    if (!statusFilter) return searchedMembers;

    return searchedMembers.filter((member) => {
      const status = statusByMemberId[getMemberId(member)];

      if (statusFilter === 'absent') {
        return status === 'absent' || status === AUTO_ABSENT_STATUS;
      }

      return status === statusFilter;
    });
  }, [searchedMembers, statusByMemberId, statusFilter]);

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
    const base = { present: 0, absent: 0, excused: 0, sick: 0, other: 0, pending: 0 };

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

  // EL RESUMEN ES DEL DESTACAMENTO ENTERO, no de lo que se este viendo.
  //
  // Los contadores de arriba siguen a la lista —se acotan con la busqueda, la
  // division y el propio contador pulsado—, pero "Resumen del dia" se abre
  // justamente para ver el cuadro completo: acotarlo con un filtro puesto haria
  // que dos personas leyeran numeros distintos del mismo dia.
  const resumen = useMemo(() => {
    const conteo = { present: 0, absent: 0, excused: 0, sick: 0, other: 0, pending: 0 };

    const miembros = selectedDestMembers.map((member) => {
      const memberId = getMemberId(member);
      const status = statusByMemberId[memberId];
      const clave =
        status === AUTO_ABSENT_STATUS
          ? 'absent'
          : conteo[status] !== undefined
            ? status
            : 'pending';

      conteo[clave] += 1;

      return {
        id: memberId,
        nombre: getMemberName(member),
        codigo: getMemberCode(member),
        division: resolveMemberDivision(member),
        estado: getStatusLabel(status),
      };
    });

    const total = miembros.length;

    return {
      total,
      conteo,
      miembros,
      // Sobre el total del destacamento: es el numero que se mira para saber si
      // hubo reunion de verdad.
      porcentajePresentes: total ? Math.round((conteo.present / total) * 100) : 0,
    };
  }, [selectedDestMembers, statusByMemberId]);

  // Lo que se lleva quien pulsa "Exportar": la misma lista que esta viendo, con
  // la marca de cada quien en palabras y no en el codigo interno.
  const exportRows = useMemo(
    () =>
      visibleMembers.map((member) => {
        const memberId = getMemberId(member);

        return {
          codigo: member?.memberId || member?.codigoMiembro || '',
          nombre: getMemberName(member),
          division: resolveMemberDivision(member),
          estado: getStatusLabel(statusByMemberId[memberId]).label,
          ultimaPresencia: formatAttendanceDate(lastPresentByMemberId[memberId]),
        };
      }),
    [visibleMembers, statusByMemberId, lastPresentByMemberId]
  );

  const exportColumns = useMemo(
    () => [
      { id: 'codigo', label: 'Código' },
      { id: 'nombre', label: 'Miembro' },
      { id: 'division', label: 'División' },
      { id: 'estado', label: 'Estado' },
      { id: 'ultimaPresencia', label: 'Última presencia' },
    ],
    []
  );

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

    // SE GUARDA EL DESTACAMENTO ENTERO, no lo que se este viendo.
    //
    // Antes se guardaba `divisionFilteredMembers`: con el filtro de division
    // puesto, la asistencia del dia quedaba escrita a medias —y lo marcado en
    // otra division antes de cambiar de filtro no llegaba a Firebase—. La
    // asistencia es del destacamento y de la fecha, no de la vista.
    const statusesToSave = { ...statusByMemberId };

    selectedDestMembers.forEach((member) => {
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
        miembros: selectedDestMembers,
        estados: statusesToSave,
        usuario: getAuditUser(),
      });

      setStatusByMemberId(statusesToSave);
      setLastPresentByMemberId((current) => {
        const next = { ...current };

        selectedDestMembers.forEach((member) => {
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
    // El segundo argumento era `puedePasarAsistencia` —un booleano— y la lista de
    // dependencias iba de tercero, donde `useCallback` no la mira: la funcion se
    // rehacia en cada pintado. Ahora las dependencias van donde toca, con el
    // permiso dentro.
  }, [
    date,
    selectedDest,
    selectedDestId,
    statusByMemberId,
    selectedDestMembers,
    puedePasarAsistencia,
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

  // Ventana flotante con el cuadro del dia: cuantos hay de cada marca y, debajo,
  // uno por uno todos los miembros del destacamento con la suya.
  const renderResumenDialog = () => (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={resumenDelDia.value}
      onClose={resumenDelDia.onFalse}
      slotProps={{ paper: { sx: { maxHeight: '90vh' } } }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        Resumen del día
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {getDestTitle(selectedDest, selectedDestId)} · {formatAttendanceDate(date)}
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
            <Typography variant="h3">{resumen.porcentajePresentes}%</Typography>
            <Box>
              <Typography variant="subtitle2">Asistencia del destacamento</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {resumen.conteo.present} de {resumen.total}{' '}
                {resumen.total === 1 ? 'miembro' : 'miembros'}
              </Typography>
            </Box>
          </Stack>

          <Box
            sx={{
              gap: 1,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
            }}
          >
            {[...STATUS_OPTIONS, { value: 'pending', ...SIN_REGISTRO }].map((option) => (
              <Stack
                key={option.value}
                spacing={0.25}
                sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.neutral' }}
              >
                <Typography variant="h6">{resumen.conteo[option.value] ?? 0}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {option.label}
                </Typography>
              </Stack>
            ))}
          </Box>
        </Box>

        <Divider />

        <Stack divider={<Divider />}>
          {resumen.miembros.map((miembro) => (
            <Stack
              key={miembro.id}
              direction="row"
              spacing={2}
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: { xs: 2, md: 3 }, py: 1.25 }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {miembro.nombre}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                  {[miembro.codigo, miembro.division].filter(Boolean).join(' • ')}
                </Typography>
              </Box>

              <Label
                variant="soft"
                color={miembro.estado.color === 'inherit' ? 'default' : miembro.estado.color}
                sx={{ width: 104, height: 28, flexShrink: 0 }}
              >
                {miembro.estado.label}
              </Label>
            </Stack>
          ))}

          {!resumen.total && (
            <Typography variant="body2" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              Este destacamento no tiene miembros.
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={resumenDelDia.onFalse}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
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
              {/* Cada contador es tambien un filtro: se pulsa y la lista se
                  queda con esa marca. Vuelto a pulsar, se suelta. */}
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                {STATUS_FILTERS.map((filter) => {
                  const activo = statusFilter === filter.value;

                  return (
                    <Chip
                      key={filter.value}
                      clickable
                      color={filter.color}
                      variant={activo ? 'filled' : 'soft'}
                      onClick={() =>
                        setStatusFilter((current) => (current === filter.value ? '' : filter.value))
                      }
                      aria-pressed={activo}
                      label={
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box
                            component="span"
                            sx={{
                              px: 0.75,
                              minWidth: 20,
                              borderRadius: 0.75,
                              textAlign: 'center',
                              typography: 'caption',
                              fontWeight: 'fontWeightBold',
                              bgcolor: activo ? 'common.white' : `${filter.color}.main`,
                              color: activo ? `${filter.color}.main` : 'common.white',
                            }}
                          >
                            {counts[filter.value]}
                          </Box>
                          <Box component="span">{filter.label}</Box>
                        </Stack>
                      }
                    />
                  );
                })}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                <ExportTableButton
                  rows={exportRows}
                  columns={exportColumns}
                  title={attendanceTitle}
                  fileNamePrefix="asistencia"
                  buttonProps={{ size: 'small', endIcon: null }}
                />

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
          </Stack>
        </Card>

        {/* Cabecera de la tabla. Solo en pantalla ancha: en movil la fila se
            apila y unos titulos sueltos arriba no dirian a que se refieren. */}
        {!loading && !!visibleMembers.length && (
          <Box
            sx={{
              ...FILA_ASISTENCIA_SX,
              px: 2.5,
              pb: 1.5,
              display: { xs: 'none', md: 'grid' },
            }}
          >
            {COLUMNAS_ASISTENCIA.map((columna) => (
              <Typography
                key={columna.titulo}
                variant="overline"
                sx={{
                  color: 'text.disabled',
                  letterSpacing: 0.6,
                  gridArea: columna.area,
                  textAlign: columna.alineacion,
                }}
              >
                {columna.titulo}
              </Typography>
            ))}
          </Box>
        )}

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
                const avatarUrl = memberPhotoUrls[memberId] || getMemberAvatar(member);

                const estado = getStatusLabel(status);
                // La reunion del dia cuenta como UNA actividad, y la persona la
                // tiene puesta si asistio. No hay asistencia por actividad en
                // ningun sitio todavia: cuando la haya, este es el punto que
                // cambia, y el resto de la fila se queda igual.
                const actividadesDelDia = 1;
                const asistidas = status === 'present' ? 1 : 0;
                const porcentaje = Math.round((asistidas / actividadesDelDia) * 100);

                return (
                  <Card key={memberId} sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Box sx={FILA_ASISTENCIA_SX}>
                      {/* MIEMBRO */}
                      <Stack
                        direction="row"
                        spacing={{ xs: 1, sm: 2 }}
                        alignItems="center"
                        sx={{ minWidth: 0, gridArea: 'miembro' }}
                      >
                        <Avatar
                          src={avatarUrl}
                          alt={memberName}
                          sx={{
                            width: { xs: 42, sm: 48 },
                            height: { xs: 42, sm: 48 },
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
                            {[getMemberCode(member), resolveMemberDivision(member)]
                              .filter(Boolean)
                              .join(' • ')}
                          </Typography>
                        </Box>
                      </Stack>

                      {/* ESTADO. Todas las etiquetas miden lo mismo y van centradas
                          en su columna: con el ancho pegado al texto, "Excusa" y
                          "Sin registro" empezaban en sitios distintos y la
                          columna se leia torcida. */}
                      <Box
                        sx={{
                          display: 'flex',
                          gridArea: 'estado',
                          justifyContent: { xs: 'flex-end', md: 'center' },
                        }}
                      >
                        <Label
                          variant="soft"
                          color={estado.color === 'inherit' ? 'default' : estado.color}
                          sx={{ width: 104, height: 28 }}
                        >
                          {estado.label}
                        </Label>
                      </Box>

                      {/* ASISTENCIA DEL DÍA */}
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        sx={{
                          gridArea: 'asistencia',
                          justifyContent: { xs: 'flex-start', md: 'center' },
                        }}
                      >
                        <Box
                          sx={{
                            width: 42,
                            height: 42,
                            flexShrink: 0,
                            display: 'inline-flex',
                            position: 'relative',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <CircularProgress
                            variant="determinate"
                            value={100}
                            size={42}
                            thickness={4}
                            sx={{ color: 'divider', position: 'absolute' }}
                          />
                          <CircularProgress
                            variant="determinate"
                            value={porcentaje}
                            size={42}
                            thickness={4}
                            color="success"
                            sx={{ position: 'absolute' }}
                          />
                          <Typography variant="caption" sx={{ fontWeight: 'fontWeightBold' }}>
                            {porcentaje}%
                          </Typography>
                        </Box>

                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {asistidas} de {actividadesDelDia}{' '}
                            {actividadesDelDia === 1 ? 'actividad' : 'actividades'}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            noWrap
                            sx={{ display: 'block' }}
                          >
                            Última: {formatAttendanceDate(lastPresentByMemberId[memberId])}
                          </Typography>
                        </Box>
                      </Stack>

                      {/* ACCIONES */}
                      <Stack
                        useFlexGap
                        direction="row"
                        flexWrap="wrap"
                        spacing={{ xs: 0.5, sm: 1 }}
                        sx={{
                          rowGap: 1,
                          flexShrink: 0,
                          gridArea: 'acciones',
                          // Los botones ya se reparten el ancho con `flex: 1`;
                          // aqui solo importa como se centran de `md` en adelante.
                          justifyContent: { xs: 'flex-start', md: 'center' },
                        }}
                      >
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
                              px: 0,
                              gap: 0.25,
                              height: 56,
                              // En el movil los cinco se reparten el ancho de la
                              // tarjeta —con 58px fijos se salian de 375px—; de
                              // `sm` en adelante vuelven a su tamaño de columna.
                              flex: { xs: 1, sm: '0 0 auto' },
                              width: { sm: 64 },
                              minWidth: { xs: 0, sm: 64 },
                              flexDirection: 'column',
                              typography: 'caption',
                            }}
                          >
                            <Iconify icon={option.icon} width={20} />
                            {option.label}
                          </Button>
                        ))}
                      </Stack>
                    </Box>
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
            </>
          )}
          {/* LA BARRA SE QUEDA ABAJO, PEGADA. Pasar lista es ir bajando por la
              lista, y el boton de guardar no puede estar al final del todo:
              quien marca a treinta personas tendria que recorrerlas otra vez
              para guardar.
              
              Y DEBAJO DE ELLA NO SE VE NADA. Los botones flotaban sueltos sobre
              la lista: por los huecos asomaban medias filas, y lo que quedaba
              tapado seguia respondiendo al raton. La barra lleva ahora su propio
              fondo —opaco, del color de la pagina, asi que no se lee como una
              caja— que tapa lo que pasa por detras y se queda con los clics. El
              velo de encima desvanece las filas al llegar, en vez de cortarlas a
              media altura. */}
          {!loading && !!visibleMembers.length && (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={(theme) => ({
                py: 2,
                bottom: 0,
                position: 'sticky',
                bgcolor: 'background.default',
                zIndex: theme.zIndex.appBar - 1,
                '&::before': {
                  left: 0,
                  right: 0,
                  height: 32,
                  content: '""',
                  bottom: '100%',
                  position: 'absolute',
                  pointerEvents: 'none',
                  background: `linear-gradient(to top, ${theme.vars.palette.background.default}, ${varAlpha(theme.vars.palette.background.defaultChannel, 0)})`,
                },
              })}
            >
              <Button
                size="large"
                color="inherit"
                variant="outlined"
                onClick={resumenDelDia.onTrue}
                disabled={!selectedDestId}
                startIcon={<Iconify icon="solar:chart-2-bold" width={24} />}
                sx={{
                  py: 1.25,
                  flex: 1,
                  bgcolor: 'background.paper',
                  justifyContent: 'flex-start',
                  '&:hover': { bgcolor: 'background.paper' },
                }}
              >
                <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    Resumen del día
                  </Typography>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}
                  >
                    Ver estadísticas completas de asistencia
                  </Typography>
                </Box>
              </Button>

              <Button
                size="large"
                variant="contained"
                onClick={handleSave}
                disabled={!selectedDestId || savingAttendance}
                startIcon={<Iconify icon="solar:diskette-bold" width={24} />}
                sx={{ py: 1.25, flex: 1, justifyContent: 'flex-start' }}
              >
                <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {savingAttendance ? 'Guardando asistencia...' : 'Guardar asistencia'}
                  </Typography>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{ display: 'block', opacity: 0.72, fontWeight: 400 }}
                  >
                    Se guardarán los cambios realizados
                  </Typography>
                </Box>
              </Button>
            </Stack>
          )}
        </Stack>
      </DashboardContent>

      {renderMenuActions()}
      {renderConfirmClearDialog()}
      {renderResumenDialog()}
    </>
  );
}
