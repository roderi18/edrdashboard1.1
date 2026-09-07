'use client';

import dayjs from 'dayjs';
import { varAlpha } from 'minimal-shared/utils';
import { useBoolean, usePopover } from 'minimal-shared/hooks';
import { memo, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
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
import { RouterLink } from 'src/routes/components';

import { getMemberFullName } from 'src/utils/get-member-fullname';
import { getMemberAllowedDestIds } from 'src/utils/member-access';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { rolesQueEjerce, ROLES_CONSEJO_EJECUTIVO } from 'src/utils/org-level-access';

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

import { DivisionOptionContent } from 'src/sections/common/division-option-content';

import { useAuthContext } from 'src/auth/hooks';
import { ROLES } from 'src/auth/permissions/roles';
import { PERMISOS } from 'src/auth/permissions/permissions';
import { can, puedeModificar } from 'src/auth/permissions/can';

import { AttendanceAdvancedReportDialog } from '../attendance-advanced-report-dialog';

// ----------------------------------------------------------------------
// ¿HAY RED?
//
// El pase de lista se hace donde no siempre la hay, y lo que se marca se guarda
// igual: Firestore lo deja en el propio telefono y lo envia al recuperar la
// conexion. Pero eso hay que DECIRLO, o quien pasa lista no sabe si su trabajo
// esta a salvo.
//
// Se arranca en linea a proposito: en el servidor no existe `navigator`, y
// suponer lo contrario pintaria el aviso un instante en cada carga.
// ----------------------------------------------------------------------
function useHayConexion() {
  const [hayConexion, setHayConexion] = useState(true);

  useEffect(() => {
    const actualizar = () => setHayConexion(navigator.onLine);

    actualizar();

    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);

    return () => {
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, []);

  return hayConexion;
}

// ----------------------------------------------------------------------

const AUTO_ABSENT_STATUS = 'absent-unmarked';

// EL DESPLEGABLE DE DESTACAMENTOS ES PARA QUIEN RESPONDE POR VARIOS.
//
// El Administrador Global, el Funcional y los cargos del Consejo Ejecutivo miran
// la asistencia de cualquier destacamento del pais, asi que necesitan elegir. Al
// resto —el Coordinador de su destacamento, los cargos de seccion o region— la
// pantalla les abre el suyo y ya: ofrecerles un selector era ensenarles una
// pregunta con una sola respuesta util.
const ROLES_QUE_ELIGEN_DESTACAMENTO = [
  ROLES.ADMINISTRADOR_GLOBAL,
  ROLES.ADMINISTRADOR_FUNCIONAL,
  // El rol del Consejo Ejecutivo y, con el, cada una de sus casillas —Director
  // Nacional, Capellan, los coordinadores de area—: quien ocupa una de ellas
  // ejerce en el Consejo aunque su rol principal se llame de otra forma.
  ROLES.CONSEJO_EJECUTIVO,
  ...ROLES_CONSEJO_EJECUTIVO,
];

// Por TODOS sus cargos, no solo por el principal: quien ejerce uno del Consejo
// Ejecutivo lo ejerce aunque entre con otro.
const puedeElegirDestacamento = (user = {}) =>
  rolesQueEjerce(user).some((codigo) => ROLES_QUE_ELIGEN_DESTACAMENTO.includes(codigo));

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
const SIN_REGISTRO = { label: 'Sin registro', color: 'default', icon: 'solar:question-circle-bold' };

const getStatusLabel = (status) => {
  if (status === AUTO_ABSENT_STATUS) {
    return {
      label: 'Ausente',
      color: 'warning',
      icon: STATUS_OPTION_BY_VALUE.absent?.icon,
    };
  }

  const option = STATUS_OPTION_BY_VALUE[status];

  return option
    ? { label: option.label, color: option.color, icon: option.icon }
    : SIN_REGISTRO;
};

// LA MARCA DEL DIA, EN EL MOVIL, ES SU ICONO. La etiqueta con la palabra se
// lleva un tercio del ancho de la fila y deja el nombre en dos lineas; el icono
// es el MISMO de los cinco botones con los que se marca, asi que se reconoce sin
// tener que leerlo. La etiqueta sigue midiendo lo mismo para todos los estados,
// que es lo que mantiene la columna derecha alineada.
function AttendanceStatusLabel({ estado, sx }) {
  return (
    <Label
      variant="soft"
      color={estado.color === 'inherit' ? 'default' : estado.color}
      aria-label={estado.label}
      sx={[{ height: 28, width: { xs: 40, sm: 104 } }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {estado.icon ? (
        <Iconify
          icon={estado.icon}
          width={18}
          sx={{ display: { xs: 'block', sm: 'none' } }}
        />
      ) : null}
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
        {estado.label}
      </Box>
    </Label>
  );
}

const TODAY = new Date().toISOString().slice(0, 10);

// EL CALENDARIO EMPIEZA DONDE EMPIEZA LA ASISTENCIA.
//
// Antes de agosto de 2026 no hay nada que consultar, asi que enero a julio se
// ven pero no se pueden abrir. El año llega entero hasta diciembre —los meses
// que faltan siguen siendo del año y se pueden mirar—, y es dentro del mes
// donde se apagan los dias que todavia no llegaron.
const PRIMER_DIA_CON_ASISTENCIA = dayjs('2026-08-01');

const ULTIMO_DIA_CON_ASISTENCIA = dayjs().endOf('year');

const getMemberDestId = (member) =>
  member?.idDestacamento ?? member?.destId ?? member?.destacamentoId ?? member?.idDest ?? '';

const getDestId = (dest) => String(dest?.id ?? dest?.idDestacamento ?? dest?.destId ?? '');

const getDestName = (dest) => dest?.name || dest?.nombre || dest?.destName || '';

const getDestNumber = (dest) => dest?.destNumber || dest?.numero || dest?.numeroDestacamento || '';

// EL DESTACAMENTO SE REUNE UN DIA, Y ESE ES EL DIA QUE SE PASA LISTA.
//
// El dia se guarda escrito ("Domingos", "Miercoles") en la ficha del
// destacamento. Aqui se traduce al numero que usa dayjs —0 es domingo— para
// poder apagar en el calendario los dias en que ese destacamento no se reune.
//
// Lunes, martes, miercoles, jueves y viernes se escriben igual en singular y en
// plural; sabado y domingo, no. Se aceptan las dos formas para no depender de
// como se escribiera el dia el dia que se creo el destacamento.
const DIA_SEMANA_POR_NOMBRE = {
  domingo: 0,
  domingos: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sabados: 6,
};

const getDestMeetingDay = (dest) => {
  const nombre = normalizeText(dest?.destMeetingDays ?? dest?.diaReunion ?? '').trim();
  const dia = DIA_SEMANA_POR_NOMBRE[nombre];

  // Un destacamento sin dia apuntado no se queda sin poder pasar lista: se le
  // dejan todos los dias hasta que alguien complete su ficha.
  return dia === undefined ? null : dia;
};

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

// Pasar asistencia es mirar caras y nombres: desde la foto y desde el nombre se
// llega a la ficha. Sin subrayado, para que la fila se siga leyendo como una
// lista y no como un parrafo de enlaces.
function AttendanceMemberProfileLink({ memberId, children, sx }) {
  if (!memberId) {
    return children;
  }

  return (
    <Link
      component={RouterLink}
      href={paths.dashboard.level.member.edit(memberId)}
      color="inherit"
      underline="none"
      sx={sx}
    >
      {children}
    </Link>
  );
}

function AttendanceMemberNameLink({ memberId, name, sx }) {
  return (
    <AttendanceMemberProfileLink memberId={memberId} sx={{ display: 'block', minWidth: 0 }}>
      <Typography variant="subtitle2" noWrap sx={sx}>
        {name}
      </Typography>
    </AttendanceMemberProfileLink>
  );
}

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
    // En el movil no hay franja de "asistencia": el porcentaje y la ultima
    // presencia no caben sin robarle sitio a lo que se viene a hacer aqui, que
    // es marcar. La etiqueta de estado, que es el dato del dia, si esta.
    xs: `"miembro estado" "acciones acciones"`,
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

// EL ARCHIVO DICE DE QUE DESTACAMENTO ES.
//
// Se descargaban como "asistencia-2026-09-04...": con dos destacamentos bajados
// el mismo dia, los dos archivos se llamaban casi igual y no habia forma de
// saber cual era cual sin abrirlos. Aqui siempre se baja UNO —la pantalla
// trabaja sobre el destacamento elegido—, asi que su nombre y su numero van en
// el nombre del archivo. Sin destacamento resuelto se queda el prefijo a secas,
// que es lo que habia.
const construirPrefijoDescarga = (prefijo, dest, fallbackId = '') => {
  const nombre = [getDestName(dest), getDestNumber(dest)].filter(Boolean).join(' ').trim();
  const etiqueta = normalizeText(nombre || '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (etiqueta) return `${prefijo}-${etiqueta}`;

  return fallbackId ? `${prefijo}-destacamento-${fallbackId}` : prefijo;
};

const getMemberAvatar = (member) =>
  member?.avatarUrl || member?.photoURL || member?.urlFoto || member?.fotoUrl || member?.foto || '';

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

// EL ESQUELETO SE PARECE A LA FILA QUE VIENE.
//
// Se habia quedado con la fila de antes —foto, nombre y un bloque de tres
// botones—, asi que al cargar se veia una lista corta que, al llegar los datos,
// se estiraba de golpe y movia todo hacia abajo. Usa la MISMA rejilla que la
// fila y las mismas medidas, de modo que lo que aparece ocupa lo que ya estaba
// ocupado.
// UNA FILA QUE SE REPINTA SOLA, Y NADIE MAS.
//
// Marcar a alguien solo cambia SU marca, pero la fila vivia dentro de la vista y
// cada pulsacion repintaba las treinta: treinta avatares, treinta enlaces y
// ciento cincuenta botones con su icono. En el movil eso se notaba como un
// retraso entre el dedo y el boton, y daba la sensacion de estar esperando a que
// algo se guardara —no se guarda nada aqui: lo escrito va a Firebase cuando se
// pulsa "Guardar asistencia"—.
//
// Con la fila aparte y memorizada, la pulsacion repinta una sola.
const AttendanceMemberRow = memo(function AttendanceMemberRow({
  member,
  memberId,
  memberName,
  avatarUrl,
  status,
  lastPresentAt,
  onStatusChange,
}) {
  const estado = getStatusLabel(status);
  // La reunion del dia cuenta como UNA actividad, y la persona la tiene puesta
  // si asistio. No hay asistencia por actividad en ningun sitio todavia: cuando
  // la haya, este es el punto que cambia, y el resto de la fila se queda igual.
  const actividadesDelDia = 1;
  const asistidas = status === 'present' ? 1 : 0;
  const porcentaje = Math.round((asistidas / actividadesDelDia) * 100);

  return (
    <Card sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={FILA_ASISTENCIA_SX}>
        {/* MIEMBRO */}
        <Stack
          direction="row"
          spacing={{ xs: 1, sm: 2 }}
          alignItems="center"
          sx={{ minWidth: 0, gridArea: 'miembro' }}
        >
          <AttendanceMemberProfileLink
            memberId={memberId}
            sx={{ display: 'flex', flexShrink: 0 }}
          >
            <Avatar
              src={avatarUrl}
              alt={memberName}
              sx={{
                width: { xs: 42, sm: 48 },
                height: { xs: 42, sm: 48 },
              }}
            >
              {memberName.charAt(0)}
            </Avatar>
          </AttendanceMemberProfileLink>

          <Box sx={{ minWidth: 0 }}>
            <AttendanceMemberNameLink memberId={memberId} name={memberName} />
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
          <AttendanceStatusLabel estado={estado} />
        </Box>

        {/* ASISTENCIA DEL DÍA */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{
            gridArea: 'asistencia',
            display: { xs: 'none', md: 'flex' },
            justifyContent: 'center',
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
              Última: {formatAttendanceDate(lastPresentAt)}
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
              onClick={() => onStatusChange(memberId, option.value)}
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
});

function AttendanceMemberSkeleton() {
  return (
    <Card sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={FILA_ASISTENCIA_SX}>
        <Stack
          direction="row"
          spacing={{ xs: 1, sm: 2 }}
          alignItems="center"
          sx={{ minWidth: 0, gridArea: 'miembro' }}
        >
          <Skeleton variant="circular" width={48} height={48} sx={{ flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
          </Box>
        </Stack>

        <Box
          sx={{
            display: 'flex',
            gridArea: 'estado',
            justifyContent: { xs: 'flex-end', md: 'center' },
          }}
        >
          <Skeleton variant="rounded" width={104} height={28} />
        </Box>

        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{
            gridArea: 'asistencia',
            justifyContent: 'center',
            display: { xs: 'none', md: 'flex' },
          }}
        >
          <Skeleton variant="circular" width={42} height={42} sx={{ flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </Box>
        </Stack>

        <Stack
          useFlexGap
          direction="row"
          flexWrap="wrap"
          spacing={{ xs: 0.5, sm: 1 }}
          sx={{ rowGap: 1, gridArea: 'acciones', justifyContent: 'center' }}
        >
          {STATUS_OPTIONS.map((option) => (
            <Skeleton
              key={option.value}
              variant="rounded"
              height={56}
              sx={{
                flex: { xs: 1, sm: '0 0 auto' },
                width: { sm: 64 },
                minWidth: { xs: 0, sm: 64 },
              }}
            />
          ))}
        </Stack>
      </Box>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function AttendanceQuickView() {
  const { user } = useAuthContext();
  const menuActions = usePopover();
  const confirmClear = useBoolean();
  const resumenDelDia = useBoolean();
  const informeAvanzado = useBoolean();

  const [date, setDate] = useState(TODAY);
  const [search, setSearch] = useState('');
  // Los destacamentos que se ofrecen: los de la estructura, acotados al alcance.
  // Derivado y no estado: la carga no puede depender de lo que ella misma
  // produce, o se relanza en bucle.
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  // El padron va por su cuenta: la pantalla ya esta en pie mientras baja.
  const [cargandoMiembros, setCargandoMiembros] = useState(false);
  const [selectedDestId, setSelectedDestId] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('all');
  // Contador pulsado arriba: '' es "todos". Se pulsa de nuevo y se suelta.
  const [statusFilter, setStatusFilter] = useState('');
  const [memberPhotoUrls, setMemberPhotoUrls] = useState({});
  // LO QUE HAY GUARDADO, aparte de lo que se esta marcando. El resumen del dia
  // se lee de aqui: si contara las marcas sin guardar, ensenaria un cuadro que
  // no existe en ninguna parte y que se pierde al recargar. `null` = todavia no
  // se ha guardado nada de este dia.
  const [estadosGuardados, setEstadosGuardados] = useState(null);
  // Presentes del MISMO destacamento siete dias antes, para la comparacion.
  // `null` cuando esa semana no tiene asistencia guardada, que no es lo mismo
  // que cero.
  const [presentesSemanaAnterior, setPresentesSemanaAnterior] = useState(null);
  const [statusByMemberId, setStatusByMemberId] = useState({});
  const [lastPresentByMemberId, setLastPresentByMemberId] = useState({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const hayConexion = useHayConexion();
  // LA ESTRUCTURA CON LA QUE SE ACOTA, entera y sin filtrar.
  //
  // `dests` va aparte de la lista que se pinta: aquella ya viene acotada por el
  // alcance, y darsela de vuelta a quien calcula el alcance seria pedirle que se
  // muerda la cola.
  const [estructura, setEstructura] = useState({ dests: [], churches: [], sectionals: [] });
  // La asistencia se pasa SOBRE SU GENTE.
  //
  // `dests` es OBLIGATORIO: sin el, las dos ramas que acotan por region salen por
  // su puerta de "no puedo acotar" —`if (!dests.length) return null`— y devuelven
  // "sin restriccion". Como no se le pasaba, el desplegable ofrecia los
  // destacamentos del pais entero a cualquier cargo regional o seccional, y no
  // solo cuando fallaba la red: SIEMPRE.
  const allowedDestIds = useMemo(
    () =>
      getMemberAllowedDestIds(user, {
        dests: estructura.dests,
        churches: estructura.churches,
        sectionals: estructura.sectionals,
      }),
    [user, estructura]
  );
  const dests = useMemo(() => {
    const todos = estructura.dests;

    if (!(allowedDestIds instanceof Set)) return todos;

    return todos.filter((dest) => allowedDestIds.has(getDestId(dest)));
  }, [estructura.dests, allowedDestIds]);

  const scopedToDest = allowedDestIds instanceof Set;
  // Quien no lleva `asistencia.ver` no entra, aunque escriba la URL: el menu no
  // le ofrecia la pantalla, pero la pantalla no comprobaba nada.
  const puedeVerAsistencia = can(user, PERMISOS.ASISTENCIA_VER);
  // Y pasarla es otra cosa que verla: los cargos de consulta —solo lectura— no
  // marcan a nadie.
  const puedePasarAsistencia =
    puedeModificar(user, PERMISOS.ASISTENCIA_CREAR) ||
    puedeModificar(user, PERMISOS.ASISTENCIA_EDITAR);

  // PRIMERO LO LIGERO: destacamentos, iglesias y secciones.
  //
  // Es lo unico que hace falta para que el desplegable funcione, y son tres
  // listas cortas. El padron —todos los miembros del pais— se descarga despues,
  // cuando ya hay un destacamento elegido: bajarlo por delante retrasaba la
  // pantalla entera, y en el movil, donde la red se corta, se llevaba por
  // delante tambien a los destacamentos.
  //
  // `allSettled` y no `all`: si una de las tres falla, las otras dos siguen
  // sirviendo. Con `all` una sola caida dejaba la pantalla sin nada.
  useEffect(() => {
    let active = true;

    async function cargarEstructura() {
      setLoading(true);

      const [destItems, churches, sectionals] = await Promise.allSettled([
        getDestsApi(),
        getChurches(),
        getSectionals({ includePhotos: false }),
      ]).then((resultados) =>
        resultados.map((resultado) =>
          resultado.status === 'fulfilled' && Array.isArray(resultado.value) ? resultado.value : []
        )
      );

      if (!active) return;

      if (!destItems.length) {
        toast.error('No se pudo cargar la lista de destacamentos.');
      }

      setEstructura({ dests: destItems, churches, sectionals });
      setLoading(false);
    }

    cargarEstructura();

    return () => {
      active = false;
    };
    // Una sola vez: el alcance se aplica despues, sobre lo cargado.
  }, []);

  // Y DESPUES EL PADRON, solo cuando ya hay a quien pasarle lista.
  //
  // `getMembers` guarda lo suyo en memoria durante medio minuto y cae al espejo
  // local si la red falla, asi que volver a entrar no vuelve a descargarlo.
  //
  // Depende de que HAYA destacamento, no de cual: el padron es el mismo para
  // todos y cambiar de destacamento en el desplegable no debe volver a bajarlo
  // ni dejar la lista en esqueletos otra vez.
  const hayDestacamentoElegido = Boolean(selectedDestId);

  useEffect(() => {
    if (!hayDestacamentoElegido) return undefined;

    let active = true;

    setCargandoMiembros(true);

    getMembers()
      .then((memberItems) => {
        if (!active) return;

        setMembers(Array.isArray(memberItems) ? memberItems : []);
      })
      .catch(() => {
        if (active) toast.error('No se pudo cargar la lista de asistencia.');
      })
      .finally(() => {
        if (active) setCargandoMiembros(false);
      });

    return () => {
      active = false;
    };
  }, [hayDestacamentoElegido]);

  // El destacamento elegido tiene que seguir estando en la lista. Antes vivia
  // dentro de la carga; ahora la lista se recalcula sola y esto la acompaña.
  useEffect(() => {
    setSelectedDestId((current) => {
      if (!dests.length) return '';
      if (dests.some((dest) => getDestId(dest) === String(current))) return current;

      return getDestId(dests[0]);
    });
  }, [dests]);

  // LA CARA DE CADA UNO. Pasar lista es reconocer a la persona, y aqui salian
  // todos con la inicial en un circulo de color: el mismo grupo que en la lista
  // de miembros se ve con su foto.
  //
  // Las fotos viven en Firebase, no en el padron, asi que van por su cuenta y
  // sin bloquear la lista: aparecen cuando llegan, y si no llegan queda la
  // inicial de siempre.
  useEffect(() => {
    // Sin miembros en pantalla no hay nada que ilustrar, y son las fotos de
    // TODO el padron: bajarlas al entrar competia con lo que si hacia falta.
    if (!members.length) return undefined;

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
  }, [members.length]);

  const selectedDest = useMemo(
    () =>
      dests.find((dest) =>
        [dest?.id, dest?.idDestacamento, dest?.destId].some(
          (value) => String(value ?? '') === String(selectedDestId)
        )
      ),
    [dests, selectedDestId]
  );
  // Dia de la semana en que se reune el destacamento elegido, o null si su ficha
  // no lo dice.
  const diaDeReunion = getDestMeetingDay(selectedDest);

  // LA FECHA CAE SOLA EN UN DIA QUE SE PUEDE ELEGIR.
  //
  // Dos reglas acotan el calendario: solo el dia en que el destacamento se
  // reune, y ningun dia futuro —una reunion que no ha ocurrido no tiene
  // asistencia que registrar—. Si la fecha no cumple las dos, el campo se
  // pintaba en rojo como si el usuario hubiera hecho algo mal, cuando lo unico
  // que pasa es que ese dia no toca.
  //
  // Se corrige sola, y siempre HACIA ATRAS: al ultimo dia de reunion ya
  // celebrado, que es el que se viene a pasar.
  useEffect(() => {
    if (!date) return;

    const hoy = dayjs();
    let fecha = dayjs(date);

    if (!fecha.isValid()) return;

    // Primero se trae del futuro; despues se retrocede a su dia de la semana.
    if (fecha.isAfter(hoy, 'day')) {
      fecha = hoy;
    }

    if (diaDeReunion !== null) {
      fecha = fecha.subtract((fecha.day() - diaDeReunion + 7) % 7, 'day');
    }

    const corregida = fecha.format('YYYY-MM-DD');

    if (corregida !== date) {
      setDate(corregida);
    }
  }, [date, diaDeReunion]);

  const attendanceTitle = selectedDestId
    ? `Asistencia ${getDestTitle(selectedDest, selectedDestId)}`
    : 'Asistencia';
  const showDestFilter = !scopedToDest && puedeElegirDestacamento(user);

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
        setEstadosGuardados(null);
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
          // Lo que viene de Firebase ES lo guardado: un dia ya pasado abre con
          // su resumen listo. Un dia sin nada escrito deja el resumen apagado
          // hasta que se guarde.
          setEstadosGuardados(Object.keys(statuses || {}).length ? statuses : null);
        }
      } catch (error) {
        if (active) {
          setStatusByMemberId({});
          setEstadosGuardados(null);
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
  // LA SEMANA ANTERIOR, para saber si se sube o se baja. Se pide el mismo dia de
  // la semana pasada del mismo destacamento: comparar contra "el ultimo dia que
  // hubo algo" mezclaria una reunion normal con un campamento.
  useEffect(() => {
    let active = true;

    const cargarSemanaAnterior = async () => {
      if (!selectedDestId || !date) {
        setPresentesSemanaAnterior(null);
        return;
      }

      try {
        const estados = await obtenerAsistenciaDestacamento({
          fecha: dayjs(date).subtract(7, 'day').format('YYYY-MM-DD'),
          idDestacamento: selectedDestId,
        });

        if (!active) return;

        const marcas = Object.values(estados || {});

        setPresentesSemanaAnterior(
          marcas.length ? marcas.filter((estado) => estado === 'present').length : null
        );
      } catch {
        // Sin el dato no se compara y ya esta: el resumen del dia no depende de
        // esto para leerse.
        if (active) setPresentesSemanaAnterior(null);
      }
    };

    cargarSemanaAnterior();

    return () => {
      active = false;
    };
  }, [date, selectedDestId]);

  const resumen = useMemo(() => {
    const conteo = { present: 0, absent: 0, excused: 0, sick: 0, other: 0, pending: 0 };

    const guardados = estadosGuardados || {};

    const miembros = selectedDestMembers.map((member) => {
      const memberId = getMemberId(member);
      const status = guardados[memberId];
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
        // La misma foto que en la lista: quien repasa el resumen busca caras,
        // igual que al pasar lista.
        avatarUrl: memberPhotoUrls[memberId] || getMemberAvatar(member),
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
      // Cuantos presentes mas o menos que la semana pasada. `null` cuando no hay
      // con que comparar.
      diferenciaSemanal:
        presentesSemanaAnterior === null ? null : conteo.present - presentesSemanaAnterior,
      presentesSemanaAnterior,
    };
  }, [selectedDestMembers, estadosGuardados, memberPhotoUrls, presentesSemanaAnterior]);

  // El resumen se abre cuando hay algo guardado que resumir.
  const hayResumenGuardado = Boolean(estadosGuardados && Object.keys(estadosGuardados).length);

  // El resumen, para llevarselo. Son las MISMAS filas que se estan leyendo en la
  // ventana —nombre, codigo, division y su marca del dia—, no una segunda
  // consulta que pudiera contar otra cosa.
  const resumenExportRows = useMemo(
    () =>
      resumen.miembros.map((miembro) => ({
        codigo: miembro.codigo,
        nombre: miembro.nombre,
        division: miembro.division,
        estado: miembro.estado.label,
      })),
    [resumen]
  );

  const resumenExportColumns = useMemo(
    () => [
      { id: 'codigo', label: 'Código' },
      { id: 'nombre', label: 'Miembro' },
      { id: 'division', label: 'División' },
      { id: 'estado', label: 'Estado' },
    ],
    []
  );

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
      setEstadosGuardados(null);
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
      // Lo recien escrito pasa a ser "lo guardado": si el resumen se abre otra
      // vez, cuenta esto y no lo de antes.
      setEstadosGuardados(statusesToSave);
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

  // El destacamento y la fecha: arriba en pantalla ancha, al pie en el movil.
  const subtituloResumen = `${getDestTitle(selectedDest, selectedDestId)} · ${formatAttendanceDate(date)}`;

  const textoComparacion =
    resumen.diferenciaSemanal === null
      ? 'Sin asistencia la semana anterior'
      : 'Presentes a la semana anterior';

  const propsDescargaResumen = {
    rows: resumenExportRows,
    columns: resumenExportColumns,
    title: `Resumen del día · ${subtituloResumen}`,
    fileNamePrefix: construirPrefijoDescarga('resumen-del-dia', selectedDest, selectedDestId),
  };

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
      <DialogTitle sx={{ pb: 2, display: { xs: 'none', sm: 'block' } }}>
        <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            Resumen del día
            {/* En el movil baja al pie: dos lineas de cabecera empujaban el
                cuadro del dia hacia abajo y la lista arrancaba fuera de la
                pantalla. */}
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}
            >
              {subtituloResumen}
            </Typography>
          </Box>

          {/* El resumen se descarga desde donde se lee. Quien lo abre para
              enviarlo no tiene que cerrarlo y buscar el "Exportar" de la
              pantalla, que ademas se lleva otra cosa: aquel exporta la lista que
              se este viendo y este, el destacamento entero. */}
          {/* EL MISMO BOTON QUE EL DE LA BARRA: mismo tamaño y misma forma. Lo
              que cambia es lo que se lleva cada uno —el de la barra, la lista
              que se este viendo; este, el destacamento entero, como los numeros
              de encima—. */}
          <ExportTableButton
            {...propsDescargaResumen}
            buttonLabel="Descargar"
            buttonProps={{
              size: 'small',
              endIcon: null,
              sx: { px: 1.5, flexShrink: 0, whiteSpace: 'nowrap' },
            }}
          />
        </Stack>
      </DialogTitle>

      {/* EL CUADRO DEL DIA NO SE VA CON EL DESPLAZAMIENTO. Es el resumen de
          verdad —el porcentaje y cuantos hay de cada marca—, y con veintisiete
          miembros debajo desaparecia en cuanto se bajaba a buscar a alguien. Va
          fuera del `DialogContent`, que es la parte que se desplaza; asi lo unico
          que corre es la lista. */}
      <Box
        sx={{
          flexShrink: 0,
          px: { xs: 2, md: 3 },
          pb: { xs: 2, md: 3 },
          // Sin cabecera que lo separe del borde, en el movil se pone el hueco
          // aqui.
          pt: { xs: 2, sm: 0 },
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h3">{resumen.porcentajePresentes}%</Typography>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle2" noWrap>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Asistencia del destacamento
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                Asistencia
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {resumen.conteo.present} de {resumen.total}{' '}
              {resumen.total === 1 ? 'miembro' : 'miembros'}
            </Typography>
          </Box>

          {/* Descargar y cerrar, en la misma linea que el porcentaje: en una
              ventana de movil cada franja propia cuesta dos filas de la lista.
              La X sustituye al "Cerrar" del pie. */}
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ flexShrink: 0, display: { xs: 'flex', sm: 'none' } }}
          >
            <ExportTableButton
              {...propsDescargaResumen}
              buttonLabel=""
              buttonProps={{
                size: 'small',
                endIcon: null,
                'aria-label': 'Descargar',
                sx: {
                  px: 1,
                  minWidth: 0,
                  flexShrink: 0,
                  '& .MuiButton-startIcon': { mx: 0 },
                },
              }}
            />

            <IconButton aria-label="Cerrar" onClick={resumenDelDia.onFalse}>
              <Iconify icon="mingcute:close-line" width={20} />
            </IconButton>
          </Stack>
        </Stack>

        <Box
          sx={{
            gap: 1,
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <Stack
              key={option.value}
              direction={{ xs: 'row', sm: 'column' }}
              spacing={{ xs: 1, sm: 0.25 }}
              alignItems={{ xs: 'center', sm: 'flex-start' }}
              sx={{
                p: { xs: 1.25, sm: 1.5 },
                borderRadius: 1.5,
                bgcolor: 'background.neutral',
              }}
            >
              <Typography variant="h6">{resumen.conteo[option.value] ?? 0}</Typography>
              <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                {option.label}
              </Typography>
            </Stack>
          ))}

          {/* EN VEZ DE "SIN REGISTRO", CUANTO SE SUBIO O SE BAJO.
              Al guardar, quien no se marco queda como ausente, asi que ese
              recuadro salia siempre en cero. Lo que si dice algo es la
              comparacion con la semana pasada: dos presentes menos es una
              noticia; que nadie quedara sin marcar, no. */}
          <Stack
            direction={{ xs: 'row', sm: 'column' }}
            spacing={{ xs: 1, sm: 0.25 }}
            alignItems={{ xs: 'center', sm: 'flex-start' }}
            sx={{
              p: { xs: 1.25, sm: 1.5 },
              borderRadius: 1.5,
              bgcolor: 'background.neutral',
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color:
                  resumen.diferenciaSemanal === null || resumen.diferenciaSemanal === 0
                    ? 'text.primary'
                    : resumen.diferenciaSemanal > 0
                      ? 'success.main'
                      : 'error.main',
              }}
            >
              {resumen.diferenciaSemanal === null
                ? '—'
                : `${resumen.diferenciaSemanal > 0 ? '+' : ''}${resumen.diferenciaSemanal}`}
            </Typography>
            {/* "Sin asistencia la semana anterior" no cabe al lado del numero
                sin partirse en tres lineas y devolverle al recuadro el alto que
                se le acaba de quitar. Se queda en "Comparación", y el texto
                entero sale al señalarlo o pulsarlo. */}
            <Tooltip title={textoComparacion} enterTouchDelay={0} placement="top">
              <Typography
                variant="caption"
                noWrap
                sx={{ minWidth: 0, cursor: 'help', color: 'text.secondary' }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {textoComparacion}
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  Comparación
                </Box>
              </Typography>
            </Tooltip>
          </Stack>
        </Box>
      </Box>

      <DialogContent dividers sx={{ p: 0 }}>
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
              <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
                <AttendanceMemberProfileLink
                  memberId={miembro.id}
                  sx={{ display: 'flex', flexShrink: 0 }}
                >
                  <Avatar
                    src={miembro.avatarUrl}
                    alt={miembro.nombre}
                    sx={{ width: 40, height: 40 }}
                  >
                    {miembro.nombre.charAt(0)}
                  </Avatar>
                </AttendanceMemberProfileLink>

                <Box sx={{ minWidth: 0 }}>
                  <AttendanceMemberNameLink memberId={miembro.id} name={miembro.nombre} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                    {[miembro.codigo, miembro.division].filter(Boolean).join(' • ')}
                  </Typography>
                </Box>
              </Stack>

              <AttendanceStatusLabel estado={miembro.estado} sx={{ flexShrink: 0 }} />
            </Stack>
          ))}

          {!resumen.total && (
            <Typography variant="body2" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              Este destacamento no tiene miembros.
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          gap: 1,
          justifyContent: 'space-between',
          px: { xs: 2, sm: 3 },
          py: { xs: 0.7, sm: 1 },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            minWidth: 0,
            lineHeight: 1.35,
            color: 'text.secondary',
            display: { xs: 'block', sm: 'none' },
          }}
        >
          {subtituloResumen}
        </Typography>

        <Button
          color="inherit"
          onClick={resumenDelDia.onFalse}
          sx={{ ml: 'auto', display: { xs: 'none', sm: 'inline-flex' } }}
        >
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

        {/* Sin red se sigue pasando lista: lo marcado se queda en el telefono y
            sube solo al volver la conexion. Se avisa para que nadie crea que ha
            perdido el trabajo, ni cierre la aplicacion antes de que suba. */}
        {!hayConexion && (
          <Alert severity="info" icon={<Iconify icon="solar:wi-fi-router-minimalistic-bold" />} sx={{ mb: 3 }}>
            <AlertTitle>Sin conexión</AlertTitle>
            Puedes seguir pasando lista: lo que marques se guarda en este dispositivo y se envía
            solo en cuanto vuelva la señal. No cierres la aplicación hasta entonces.
          </Alert>
        )}

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
      <DashboardContent>
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
                minDate={PRIMER_DIA_CON_ASISTENCIA}
                maxDate={ULTIMO_DIA_CON_ASISTENCIA}
                // Se pasa por el año y por el mes antes de llegar al dia, para
                // poder saltar a un mes de atras sin ir flecha a flecha.
                views={['year', 'month', 'day']}
                // Un dia queda apagado por dos razones: todavia no llego, o el
                // destacamento no se reune ese dia de la semana y no hay
                // asistencia que pasar.
                shouldDisableDate={(fecha) => {
                  const dia = dayjs(fecha);

                  if (dia.isAfter(dayjs(), 'day')) return true;

                  return diaDeReunion !== null && dia.day() !== diaDeReunion;
                }}
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

            {/* CONTADORES Y ACCIONES.

                En pantalla ancha van uno al lado del otro, cada cual a su
                extremo. En el movil no caben: los contadores se derramaban en
                una tira de cuatro filas y los dos botones quedaban apretados a
                su derecha, medio salidos. Ahi se apila: los cuatro contadores en
                un bloque de dos por dos, y los botones debajo, en su propia
                fila. */}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              sx={{ width: 1 }}
            >
              {/* Cada contador es tambien un filtro: se pulsa y la lista se
                  queda con esa marca. Vuelto a pulsar, se suelta. */}
              <Box
                sx={{
                  gap: 1,
                  alignItems: 'center',
                  // Dos columnas en el movil; en fila, como siempre, a partir de
                  // que hay sitio. `gridTemplateColumns` no estorba cuando manda
                  // el `flex`.
                  display: { xs: 'grid', md: 'flex' },
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  flexWrap: 'wrap',
                }}
              >
                {STATUS_FILTERS.map((filter) => {
                  const activo = statusFilter === filter.value;

                  return (
                    <Chip
                      key={filter.value}
                      clickable
                      color={filter.color}
                      variant={activo ? 'filled' : 'soft'}
                      // Llena su columna: cuatro pastillas de anchos distintos
                      // dejaban el bloque desigual.
                      sx={{ width: { xs: 1, md: 'auto' } }}
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
              </Box>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ flexShrink: 0, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}
              >
                {/* La pantalla responde por UN dia; el informe, por la racha:
                    como va la asistencia semana a semana, mes a mes, hasta el
                    historico completo. */}
                <Button
                  size="small"
                  color="inherit"
                  variant="outlined"
                  disabled={!selectedDestId}
                  onClick={informeAvanzado.onTrue}
                  startIcon={<Iconify icon="solar:chart-square-outline" />}
                  // A medias con Descargar mientras no haya sitio de sobra.
                  sx={{ flex: { xs: 1, md: '0 0 auto' }, minWidth: 0 }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    Informe avanzado
                  </Box>
                  <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                    Avanzado
                  </Box>
                </Button>

                <ExportTableButton
                  rows={exportRows}
                  columns={exportColumns}
                  title={attendanceTitle}
                  fileNamePrefix={construirPrefijoDescarga(
                    'asistencia',
                    selectedDest,
                    selectedDestId
                  )}
                  buttonLabel="Descargar"
                  buttonProps={{
                    size: 'small',
                    endIcon: null,
                    sx: { flex: { xs: 1, md: '0 0 auto' }, minWidth: 0 },
                  }}
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
            apila y unos titulos sueltos arriba no dirian a que se refieren.

            Se mantiene mientras carga: es la cabecera de lo que va a venir, y
            hacerla aparecer despues empujaba la lista hacia abajo. */}
        {(loading || cargandoMiembros || loadingAttendance || !!visibleMembers.length) && (
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
          {loading || cargandoMiembros ? (
            Array.from({ length: 6 }).map((_, index) => <AttendanceMemberSkeleton key={index} />)
          ) : loadingAttendance ? (
            Array.from({ length: Math.max(visibleMembers.length, 3) }).map((_, index) => (
              <AttendanceMemberSkeleton key={index} />
            ))
          ) : (
            <>
              {visibleMembers.map((member) => {
                const memberId = getMemberId(member);

                return (
                  <AttendanceMemberRow
                    key={memberId}
                    member={member}
                    memberId={memberId}
                    memberName={getMemberName(member)}
                    avatarUrl={memberPhotoUrls[memberId] || getMemberAvatar(member)}
                    status={statusByMemberId[memberId] || ''}
                    lastPresentAt={lastPresentByMemberId[memberId]}
                    onStatusChange={handleStatusChange}
                  />
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
        </Stack>

        {/* LA BARRA SE QUEDA ABAJO, PEGADA. Pasar lista es ir bajando por la
            lista, y el boton de guardar no puede estar al final del todo:
            quien marca a treinta personas tendria que recorrerlas otra vez
            para guardar.

            CON POCOS MIEMBROS TAMBIEN. Pegarse solo funciona mientras el
            contenedor siga pasando por debajo del borde de la pantalla; con
            cuatro fichas la lista terminaba a media altura y los botones se
            quedaban ahi, en el medio, encima de las tarjetas. Por eso la barra
            cuelga ahora del contenido —no de la lista— y se empuja al fondo con
            un margen automatico: sin scroll cae al pie de la pantalla, y con
            scroll vuelve a pegarse.

            Y DEBAJO DE ELLA NO SE VE NADA. Los botones flotaban sueltos sobre
            la lista: por los huecos asomaban medias filas, y lo que quedaba
            tapado seguia respondiendo al raton. La barra lleva ahora su propio
            fondo —opaco, del color de la pagina, asi que no se lee como una
            caja— que tapa lo que pasa por detras y se queda con los clics. El
            velo de encima desvanece las filas al llegar, en vez de cortarlas a
            media altura. */}
        {!loading && !cargandoMiembros && !!visibleMembers.length && (
          <Stack
            direction="row"
            spacing={1.5}
            sx={(theme) => ({
              py: 2,
              bottom: 0,
              mt: 'auto',
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
              // Hasta que no se guarda no hay resumen: contar marcas que
              // todavia no existen en ninguna parte seria ensenar un dia que
              // se pierde al recargar.
              disabled={!selectedDestId || !hayResumenGuardado}
              startIcon={<Iconify icon="solar:chart-2-bold" width={24} />}
              sx={{
                py: 1.25,
                flex: 1,
                minWidth: 0,
                bgcolor: 'background.paper',
                justifyContent: { xs: 'center', sm: 'flex-start' },
                '&:hover': { bgcolor: 'background.paper' },
              }}
            >
              <Box sx={{ textAlign: { xs: 'center', sm: 'left' }, minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  Resumen del día
                </Typography>
                {/* Los dos botones caben en una sola linea del movil sin este
                    renglon, que ademas partia el titulo en dos. */}
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 400,
                    display: { xs: 'none', sm: 'block' },
                  }}
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
              sx={{
                py: 1.25,
                flex: 1,
                minWidth: 0,
                justifyContent: { xs: 'center', sm: 'flex-start' },
              }}
            >
              <Box sx={{ textAlign: { xs: 'center', sm: 'left' }, minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {savingAttendance ? 'Guardando asistencia...' : 'Guardar asistencia'}
                </Typography>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ opacity: 0.72, fontWeight: 400, display: { xs: 'none', sm: 'block' } }}
                >
                  Se guardarán los cambios realizados
                </Typography>
              </Box>
            </Button>
          </Stack>
        )}
      </DashboardContent>

      {renderMenuActions()}
      {renderConfirmClearDialog()}
      {renderResumenDialog()}

      <AttendanceAdvancedReportDialog
        open={informeAvanzado.value}
        onClose={informeAvanzado.onFalse}
        destId={selectedDestId}
        dest={getDestTitle(selectedDest, selectedDestId)}
      />
    </>
  );
}
