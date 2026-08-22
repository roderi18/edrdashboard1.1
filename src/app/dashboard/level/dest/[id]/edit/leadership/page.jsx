'use client';

import { usePopover } from 'minimal-shared/hooks';
import { useRef, useMemo, useState, useEffect } from 'react';
import {
  pdf,
  Text,
  Document,
  StyleSheet,
  View as PdfView,
  Page as PdfPage,
  Image as PdfImage,
} from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';

import { useParams } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { canManageDirectiva } from 'src/utils/admin-role-label';
import { puedeVerAvisoDatosPendientes } from 'src/utils/member-datos-pendientes';
import { construirResumenMiembro, resolverMiembroAsignado } from 'src/utils/leadership-assignments';
import { obtenerFotoPrincipal, obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import {
  getOwnDestIdsForUser,
  puedeVerMiembrosDeTodaLaOrganizacion,
} from 'src/utils/member-access';
import {
  buildOrgIndex,
  getLeadershipScopeLabel,
  buildLeadershipMemberOptions,
} from 'src/utils/leadership-member-options';

import { DIRECTIVA_POSITIONS, getOrganigramaDestSlot } from 'src/catalogs/directiva-positions';
import {
  guardarAsignacionDirectiva,
  obtenerAsignacionesDirectiva,
  desactivarAsignacionesDirectivaPorNivel,
} from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { OrganizationalChart } from 'src/components/organizational-chart';

import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { RETARDO_ASIGNACION_MS } from 'src/sections/common/use-leadership-assignments';
import { useLeadershipLayoutStorage } from 'src/sections/common/use-leadership-layout-storage';
import {
  DEST_LEADERSHIP_DATA,
  DEST_DIVISION_GROUPS,
} from 'src/sections/dest/leadership/dest-leadership-data';
import {
  ETIQUETA_VACANTE,
  LeadershipNodeName,
  LeadershipNodeAvatar,
  LEADERSHIP_NODE_SIZE_SX,
  getLeadershipNodeIdentity,
} from 'src/sections/common/leadership-node-identity';
import {
  LeadershipLayoutEditor,
  getLeadershipEditGridSx,
  getLeadershipConnections,
  useLeadershipLayoutEditor,
  hasLeadershipLayoutOffsets,
  getLeadershipEditableNodeSx,
  LeadershipLayoutOffsetStyles,
  LeadershipLayoutConnectorLayer,
  getLeadershipConnectorOverrideSx,
} from 'src/sections/common/leadership-layout-editor';

import { useAuthContext } from 'src/auth/hooks';

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;
const CONTROL_BUTTON_SIZE = 36;
const CONTROL_BUTTON_GAP = 6;
const ZOOM_PERCENT_WIDTH = CONTROL_BUTTON_SIZE * 2 + CONTROL_BUTTON_GAP;

const getDefaultZoom = () => {
  const mobileScreenQuery = window.matchMedia('(max-width: 599px)');
  const largeScreenQuery = window.matchMedia('(min-width: 1200px)');

  if (mobileScreenQuery.matches) {
    return 0.9;
  }

  if (largeScreenQuery.matches) {
    return 1.2;
  }

  return 1;
};

const pdfStyles = StyleSheet.create({
  page: {
    padding: 18,
    fontFamily: 'Helvetica',
    color: '#1C252E',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    marginBottom: 14,
    fontWeight: 700,
    textAlign: 'center',
  },
  chart: {
    position: 'relative',
    width: 806,
    height: 520,
    marginHorizontal: 'auto',
  },
  line: {
    position: 'absolute',
    backgroundColor: '#637381',
  },
  personCard: {
    position: 'absolute',
    width: 128,
    height: 64,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDE3EA',
    backgroundColor: '#F9FAFB',
  },
  divisionCard: {
    position: 'absolute',
    width: 128,
    height: 36,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDE3EA',
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 7,
    objectFit: 'cover',
  },
  avatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 7,
    backgroundColor: '#DFE3E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 9,
    fontWeight: 700,
    color: '#637381',
  },
  logo: {
    width: 24,
    height: 24,
    objectFit: 'contain',
    marginRight: 8,
  },
  name: {
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 4,
  },
  role: {
    fontSize: 6.5,
    color: '#637381',
  },
  divisionName: {
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 3,
  },
  divisionRole: {
    fontSize: 6.5,
    color: '#637381',
  },
  textColumn: {
    flex: 1,
  },
});

const PDF_POSITIONS = {
  center: 403,
  personWidth: 128,
  personHeight: 64,
  divisionWidth: 128,
  divisionHeight: 36,
  pastorY: 0,
  coordinatorY: 78,
  assistantY: 156,
  sideY: 250,
  branchY: 238,
  divisionsY: 322,
  leadersY: 380,
  assistantsY: 458,
  sideCenters: [286, 520],
  divisionCenters: [160, 322, 484, 646],
};

const getCenteredLeft = (center, width) => center - width / 2;

const PdfLine = ({ x, y, width = 1, height = 1 }) => (
  <PdfView style={[pdfStyles.line, { left: x, top: y, width, height }]} />
);

const PdfAvatar = ({ src, name }) =>
  src ? (
    <PdfImage src={src} style={pdfStyles.avatar} />
  ) : (
    <PdfView style={pdfStyles.avatarFallback}>
      <Text style={pdfStyles.avatarFallbackText}>{String(name || '?').charAt(0)}</Text>
    </PdfView>
  );

const PdfPersonNode = ({ node, x, y }) => (
  <PdfView style={[pdfStyles.personCard, { left: x, top: y }]}>
    <PdfAvatar src={node.avatarUrl} name={node.name} />
    <Text style={pdfStyles.name}>{node.name}</Text>
    <Text style={pdfStyles.role}>{node.role}</Text>
  </PdfView>
);

const PdfDivisionNode = ({ node, x, y }) => (
  <PdfView style={[pdfStyles.divisionCard, { left: x, top: y }]}>
    {node.avatarUrl ? <PdfImage src={node.avatarUrl} style={pdfStyles.logo} /> : null}
    <PdfView style={pdfStyles.textColumn}>
      <Text style={pdfStyles.divisionName}>{node.name}</Text>
      <Text style={pdfStyles.divisionRole}>{node.role}</Text>
    </PdfView>
  </PdfView>
);

function LeadershipPdfDocument({ destName, chartData }) {
  const personLeft = (center) => getCenteredLeft(center, PDF_POSITIONS.personWidth);
  const divisionLeft = (center) => getCenteredLeft(center, PDF_POSITIONS.divisionWidth);
  const pastorBottom = PDF_POSITIONS.pastorY + PDF_POSITIONS.personHeight;
  const coordinatorBottom = PDF_POSITIONS.coordinatorY + PDF_POSITIONS.personHeight;
  const assistantBottom = PDF_POSITIONS.assistantY + PDF_POSITIONS.personHeight;
  const divisionBottom = PDF_POSITIONS.divisionsY + PDF_POSITIONS.divisionHeight;
  const leaderBottom = PDF_POSITIONS.leadersY + PDF_POSITIONS.personHeight;

  return (
    <Document>
      <PdfPage size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>
          {destName && destName !== 'Destacamento' ? `Destacamento ${destName}` : 'Destacamento'}
        </Text>

        <PdfView style={pdfStyles.chart}>
          <PdfLine
            x={PDF_POSITIONS.center}
            y={pastorBottom}
            height={PDF_POSITIONS.coordinatorY - pastorBottom}
          />
          <PdfLine
            x={PDF_POSITIONS.center}
            y={coordinatorBottom}
            height={PDF_POSITIONS.assistantY - coordinatorBottom}
          />
          <PdfLine
            x={PDF_POSITIONS.center}
            y={assistantBottom}
            height={PDF_POSITIONS.branchY - assistantBottom}
          />
          <PdfLine
            x={PDF_POSITIONS.sideCenters[0]}
            y={PDF_POSITIONS.branchY}
            width={PDF_POSITIONS.sideCenters[1] - PDF_POSITIONS.sideCenters[0]}
          />
          {PDF_POSITIONS.sideCenters.map((center) => (
            <PdfLine
              key={`side-line-${center}`}
              x={center}
              y={PDF_POSITIONS.branchY}
              height={PDF_POSITIONS.sideY - PDF_POSITIONS.branchY}
            />
          ))}
          {PDF_POSITIONS.divisionCenters.map((center) => (
            <PdfView key={`division-lines-${center}`}>
              <PdfLine
                x={center}
                y={divisionBottom}
                height={PDF_POSITIONS.leadersY - divisionBottom}
              />
              <PdfLine
                x={center}
                y={leaderBottom}
                height={PDF_POSITIONS.assistantsY - leaderBottom}
              />
            </PdfView>
          ))}

          <PdfPersonNode
            node={chartData.pastor}
            x={personLeft(PDF_POSITIONS.center)}
            y={PDF_POSITIONS.pastorY}
          />
          <PdfPersonNode
            node={chartData.coordinator}
            x={personLeft(PDF_POSITIONS.center)}
            y={PDF_POSITIONS.coordinatorY}
          />
          <PdfPersonNode
            node={chartData.assistantCoordinator}
            x={personLeft(PDF_POSITIONS.center)}
            y={PDF_POSITIONS.assistantY}
          />
          <PdfPersonNode
            node={chartData.council}
            x={personLeft(PDF_POSITIONS.sideCenters[0])}
            y={PDF_POSITIONS.sideY}
          />
          <PdfPersonNode
            node={chartData.chaplain}
            x={personLeft(PDF_POSITIONS.sideCenters[1])}
            y={PDF_POSITIONS.sideY}
          />

          {chartData.divisions.map((division, index) => (
            <PdfView key={division.name}>
              <PdfDivisionNode
                node={division}
                x={divisionLeft(PDF_POSITIONS.divisionCenters[index])}
                y={PDF_POSITIONS.divisionsY}
              />
              <PdfPersonNode
                node={division.leader}
                x={personLeft(PDF_POSITIONS.divisionCenters[index])}
                y={PDF_POSITIONS.leadersY}
              />
              <PdfPersonNode
                node={division.assistant}
                x={personLeft(PDF_POSITIONS.divisionCenters[index])}
                y={PDF_POSITIONS.assistantsY}
              />
            </PdfView>
          ))}
        </PdfView>
      </PdfPage>
    </Document>
  );
}

function DivisionNode({ id, name, depth, avatarUrl, role, sx, layoutEditor }) {
  const nodeId = id || name;
  const editProps = layoutEditor?.getNodeEditProps({
    id: nodeId,
    name,
    role,
  });
  const isRootNode = depth === undefined;

  return (
    <Card
      data-leadership-node-id={nodeId}
      {...(editProps && {
        onPointerUp: editProps.onPointerUp,
        onPointerMove: editProps.onPointerMove,
        onPointerDown: editProps.onPointerDown,
        onPointerCancel: editProps.onPointerCancel,
      })}
      sx={[
        () => ({
          px: 1.5,
          py: 1,
          gap: 1,
          ...LEADERSHIP_NODE_SIZE_SX,
          borderRadius: 1.5,
          textAlign: 'left',
          alignItems: 'center',
          display: 'inline-flex',
        }),
        editProps ? getLeadershipEditableNodeSx(editProps, { applyTransform: isRootNode }) : null,
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        component="img"
        alt={name}
        src={avatarUrl}
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          objectFit: 'contain',
        }}
      />

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {name}
        </Typography>

        <Typography variant="caption" component="div" noWrap title={role} sx={{ color: 'text.secondary' }}>
          {role}
        </Typography>
      </Box>
    </Card>
  );
}

const getMemberId = (member) => Number(member?.idMiembros ?? member?.id ?? 0) || null;

const getMemberName = (member) =>
  [member?.nombres ?? member?.firstName, member?.apellidos ?? member?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  member?.name ||
  member?.displayName ||
  member?.codigoMiembro ||
  member?.memberId ||
  '';

const getMemberAvatar = (member) =>
  member?.avatarUrl ||
  member?.photoURL ||
  member?.urlFoto ||
  member?.fotoURL ||
  member?.fotoUrl ||
  member?.foto ||
  '';

const getMemberPhoto = (memberPhotos, member) => {
  const photoKeys = [
    getMemberId(member),
    member?.id,
    member?.idMiembros,
    member?.memberId,
    member?.codigoMiembro,
  ]
    .filter(Boolean)
    .map(String);

  return photoKeys.map((photoKey) => memberPhotos[photoKey]).find((photo) => photo?.urlFoto);
};

const mergeMemberPhotos = async (members, memberPhotos) =>
  Promise.all(
    members.map(async (member) => {
      const memberId = getMemberId(member);
      const memberPhoto =
        getMemberPhoto(memberPhotos, member) ||
        (memberId
          ? await obtenerFotoPrincipal({ tipoEntidad: 'miembro', idEntidad: memberId }).catch(
              () => null
            )
          : null);

      return {
        ...member,
        avatarUrl: memberPhoto?.urlFoto || member.avatarUrl || member.photoURL || '',
      };
    })
  );

const getMemberOptionKey = (member) =>
  member?.__organigramaOptionKey ||
  [
    getMemberId(member),
    member?.codigoMiembro,
    member?.memberId,
    member?.email,
    getMemberName(member),
  ]
    .filter(Boolean)
    .join('-');

const getAssignmentKey = (asignacion) =>
  [
    asignacion?.cargo || '',
    asignacion?.division || 'general',
    asignacion?.orden || 1,
  ].join('|');

// ----------------------------------------------------------------------
// El organigrama del destacamento se apoya en `asignacionesDirectiva`, la misma
// coleccion que las Directivas de seccion, region y nacion — y la misma que leen
// la ficha del miembro y la lista.
//
// Antes tenia su propia coleccion (`organigrama_directiva_destacamentos`) y era
// el unico que la escribia: asignar aqui no llegaba ni al perfil ni a la lista,
// asi que habia gente dibujada en el cuadro cuya ficha decia "Ninguna". Se
// conserva la CLAVE de casilla (cargo|division|orden) para no tocar el resto de
// la pantalla: las asignaciones se traducen a esa forma al cargarlas.
// ----------------------------------------------------------------------

const NIVEL_DESTACAMENTO = 'destacamento';

// Las tres cabezas del destacamento: quien las ocupa se ve desde fuera, porque
// son a quienes se acude. Del resto de las casillas, quien mira desde otro
// destacamento solo ve que estan cubiertas.
const CARGOS_VISIBLES_DESDE_FUERA = new Set([
  'pastor',
  'coordinador-destacamento',
  'coordinador-asistente-destacamento',
]);

// Casilla del organigrama -> posicion del catalogo. Es el inverso de
// `getOrganigramaDestSlot`, que hace el camino contrario.
const POSICION_POR_CASILLA = new Map(
  DIRECTIVA_POSITIONS.filter((position) => position.nivel === NIVEL_DESTACAMENTO)
    .map((position) => [position, getOrganigramaDestSlot(position)])
    .filter(([, slot]) => slot)
    .map(([position, slot]) => [getAssignmentKey(slot), position])
);

// Traduce una asignacion de directiva a la forma que espera esta pantalla
// (`cargo`, `division`, `orden`, `idMiembros`). Devuelve null si la posicion no
// tiene casilla en el cuadro del destacamento.
const asignacionDirectivaACasilla = (asignacion) => {
  const position = DIRECTIVA_POSITIONS.find(
    (item) => item.idCargo === asignacion?.idPosicionDirectiva
  );
  const slot = position ? getOrganigramaDestSlot(position) : null;

  if (!slot) return null;

  return {
    ...slot,
    id: asignacion.idAsignacion || asignacion.id,
    idMiembros: asignacion.idMiembro,
    nombreMiembro: asignacion.nombreMiembro || '',
    nombresMiembro: asignacion.nombresMiembro || '',
    apellidosMiembro: asignacion.apellidosMiembro || '',
    codigoMiembro: asignacion.codigoMiembro || '',
    fotoMiembro: asignacion.fotoMiembro || '',
  };
};

function LeadershipNode({
  id,
  name,
  depth,
  avatarUrl,
  role,
  sx,
  layoutEditor,
  miembroAsignado,
  asignacionOrganigrama,
  onCambiarMiembro,
  onRemoverMiembro,
  onInformacionRol,
  mostrarAvisoDatos = false,
  canManage = true,
  restringido = false,
}) {
  const menuActions = usePopover();
  // El nodo describe el CARGO: nombre y foto los pone el ocupante, y sin
  // ocupante el cargo se dibuja como vacante.
  const identity = getLeadershipNodeIdentity(
    miembroAsignado
      ? { ...miembroAsignado, avatarUrl: getMemberAvatar(miembroAsignado) }
      : null,
    { restringido }
  );
  const displayName = identity.displayName;
  const miembroAsignadoId = getMemberId(miembroAsignado);
  const memberProfileHref =
    miembroAsignadoId && !restringido ? `/dashboard/level/member/${miembroAsignadoId}/edit` : '';
  const nodeId = id || getAssignmentKey(asignacionOrganigrama) || role || name;
  const editProps = layoutEditor?.getNodeEditProps({
    id: nodeId,
    name: displayName,
    role,
  });
  const isRootNode = depth === undefined;

  const handleCambiarMiembro = () => {
    menuActions.onClose();
    onCambiarMiembro?.({ name, role, avatarUrl, asignacionOrganigrama, miembroAsignado });
  };

  const handleRemoverMiembro = () => {
    menuActions.onClose();
    onRemoverMiembro?.({ name, role, avatarUrl, asignacionOrganigrama });
  };

  const handleInformacionRol = () => {
    menuActions.onClose();
    onInformacionRol?.({ name, role, asignacionOrganigrama });
  };

  const getMenuItemActionProps = (handler) => ({
    onPointerDown: (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler();
    },
    onClick: (event) => {
      event.stopPropagation();

      if (event.detail === 0) {
        handler();
      }
    },
  });

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'left-center' } }}
    >
      <MenuList onPointerDown={(event) => event.stopPropagation()}>
        {canManage && (
          <MenuItem {...getMenuItemActionProps(handleCambiarMiembro)}>
            <Iconify icon="solar:user-plus-bold" />
            {/* Sin ocupante el nodo no se "cambia": se asigna por primera vez. */}
            {miembroAsignado ? 'Cambiar miembro' : 'Asignar miembro'}
          </MenuItem>
        )}

        {canManage && miembroAsignado && (
          <MenuItem {...getMenuItemActionProps(handleRemoverMiembro)} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:user-cross-bold" />
            Remover miembro
          </MenuItem>
        )}

        <MenuItem {...getMenuItemActionProps(handleInformacionRol)}>
          <Iconify icon="solar:info-circle-bold" />
          Información de rol
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      <Card
        data-leadership-node-id={nodeId}
        {...(editProps && {
          onPointerUp: editProps.onPointerUp,
          onPointerMove: editProps.onPointerMove,
          onPointerDown: editProps.onPointerDown,
          onPointerCancel: editProps.onPointerCancel,
        })}
        sx={[
          () => ({
            p: 2,
            ...LEADERSHIP_NODE_SIZE_SX,
            borderRadius: 1.5,
            textAlign: 'left',
            position: 'relative',
            display: 'inline-flex',
            flexDirection: 'column',
          }),
          editProps ? getLeadershipEditableNodeSx(editProps, { applyTransform: isRootNode }) : null,
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <IconButton
          color={menuActions.open ? 'inherit' : 'default'}
          onClick={menuActions.onOpen}
          sx={{ position: 'absolute', top: 8, right: 8 }}
        >
          <Iconify icon="eva:more-horizontal-fill" />
        </IconButton>

        <Box
          component={memberProfileHref ? RouterLink : 'div'}
          href={memberProfileHref || undefined}
          onClick={memberProfileHref ? (event) => event.stopPropagation() : undefined}
          onPointerDown={memberProfileHref ? (event) => event.stopPropagation() : undefined}
          sx={{
            mr: 2,
            mb: 2,
            width: 48,
            height: 48,
            display: 'block',
            borderRadius: '50%',
          }}
        >
          <LeadershipNodeAvatar identity={identity} />
        </Box>

        {/* El aviso de ficha incompleta, solo en la casilla del PASTOR: es la
            unica persona que el sistema da de alta por su cuenta, con el nombre
            como unico dato. Al resto se les registra desde su propio formulario. */}
        <LeadershipNodeName
          identity={identity}
          mostrarAvisoDatos={mostrarAvisoDatos && id === 'pastor'}
        >
          {memberProfileHref ? (
            <Link
              component={RouterLink}
              href={memberProfileHref}
              underline="hover"
              color="inherit"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {displayName}
            </Link>
          ) : (
            displayName
          )}
        </LeadershipNodeName>

        <Typography variant="caption" component="div" noWrap title={role} sx={{ color: 'text.secondary' }}>
          {role}
        </Typography>
      </Card>

      {renderMenuActions()}
    </>
  );
}

const slugify = (value) =>
  String(value || 'destacamento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const getAbsoluteAssetUrl = (src) => {
  if (!src || src.startsWith('data:') || src.startsWith('blob:') || /^https?:\/\//i.test(src)) {
    return src || '';
  }

  const normalizedSrc = src.startsWith('/') ? src : `/${src}`;

  return `${window.location.origin}${normalizedSrc}`;
};

const getPdfImageSrc = async (src) => {
  const assetUrl = getAbsoluteAssetUrl(src);

  if (!assetUrl || assetUrl.startsWith('data:')) {
    return assetUrl;
  }

  try {
    const response = await fetch(assetUrl);

    if (!response.ok) {
      return assetUrl;
    }

    return blobToDataUrl(await response.blob());
  } catch {
    return assetUrl;
  }
};

const getPdfPersonNode = async (node, getAssignedMember) => {
  const assignedMember = getAssignedMember(node);
  const displayName = assignedMember ? getMemberName(assignedMember) : ETIQUETA_VACANTE;
  const displayAvatar = assignedMember ? getMemberAvatar(assignedMember) : '';

  return {
    name: displayName || ETIQUETA_VACANTE,
    role: node?.role || '',
    avatarUrl: await getPdfImageSrc(displayAvatar),
  };
};

const getLeadershipPdfChartData = async (getAssignedMember) => {
  const coordinator = DEST_LEADERSHIP_DATA.children?.[0] || {};
  const assistantCoordinator = coordinator.children?.[0] || {};
  const council = assistantCoordinator.children?.[0] || {};
  const chaplain = assistantCoordinator.children?.[1] || {};
  const divisions = await Promise.all(
    DEST_DIVISION_GROUPS.map(async (division) => {
      const leader = division.children?.[0] || {};
      const assistant = leader.children?.[0] || {};

      return {
        name: division.name,
        role: division.role,
        avatarUrl: await getPdfImageSrc(division.avatarUrl),
        leader: await getPdfPersonNode(leader, getAssignedMember),
        assistant: await getPdfPersonNode(assistant, getAssignedMember),
      };
    })
  );

  return {
    pastor: await getPdfPersonNode(DEST_LEADERSHIP_DATA, getAssignedMember),
    coordinator: await getPdfPersonNode(coordinator, getAssignedMember),
    assistantCoordinator: await getPdfPersonNode(assistantCoordinator, getAssignedMember),
    council: await getPdfPersonNode(council, getAssignedMember),
    chaplain: await getPdfPersonNode(chaplain, getAssignedMember),
    divisions,
  };
};

export default function Page() {
  const params = useParams();
  const { user } = useAuthContext();
  // El administrador de destacamento consulta el organigrama en solo lectura:
  // sin cambiar/remover miembros ni edicion visual del layout.
  // Componer la directiva (asignar, cambiar, remover y mover el organigrama) es
  // competencia EXCLUSIVA del administrador global. Los demas roles la consultan
  // en solo lectura. Lo que de verdad lo impide son las reglas de Firestore.
  const canManageLeadership = canManageDirectiva(user);
  // Quien mira el organigrama de un destacamento que no es el suyo ve los cargos
  // y quien los ocupa solo en las tres cabezas; del resto, solo que estan
  // cubiertos. El Administrador Global y la Oficina Nacional lo ven todo.
  const esDeOtroDestacamento =
    !puedeVerMiembrosDeTodaLaOrganizacion(user) &&
    !getOwnDestIdsForUser(user).has(String(params?.id ?? '').trim());
  const cargoRestringido = (idNodo) =>
    esDeOtroDestacamento && !CARGOS_VISIBLES_DESDE_FUERA.has(String(idNodo ?? ''));
  // El aviso de ficha incompleta solo lo ven los cargos del destacamento y los
  // administradores: para el resto es ruido sobre datos que no les toca completar.
  const mostrarAvisoDatos = puedeVerAvisoDatosPendientes(user);
  const destId = params?.id;
  const chartCaptureRef = useRef(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const skipNextDragRef = useRef(false);
  const layoutEditor = useLeadershipLayoutEditor();
  const [destName, setDestName] = useState('Destacamento');
  // El diseno del diagrama se guarda en Firestore: antes vivia en memoria y cada
  // recolocacion se perdia al recargar.
  const [destNumber, setDestNumber] = useState('');
  const [members, setMembers] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [roleInfoNode, setRoleInfoNode] = useState(null);
  const [removeMemberNode, setRemoveMemberNode] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const layoutStorage = useLeadershipLayoutStorage({
    editor: layoutEditor,
    nivel: 'destacamento',
    idEntidad: destId,
    nombreEntidad: destName,
    canManage: canManageLeadership,
  });
  const [assignments, setAssignments] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const zoomPercentage = Math.round(zoom * 100);
  const containerMinHeight = 680 + layoutEditor.containerHeightOffset;
  // Con numero: dos destacamentos pueden llamarse igual, y el numero es lo que
  // los distingue en todas las demas pantallas ("Tribu de Juda 18").
  const destNombreCompleto = [destName, destNumber].filter(Boolean).join(' ').trim();
  const titleText =
    destName && destName !== 'Destacamento' ? `Destacamento ${destNombreCompleto}` : 'Destacamento';
  const titleEditProps = layoutEditor.getNodeEditProps({
    id: 'titulo-destacamento',
    name: titleText,
    role: 'Titulo del diagrama',
  });
  const connections = useMemo(
    () => getLeadershipConnections([DEST_LEADERSHIP_DATA, ...DEST_DIVISION_GROUPS]),
    []
  );
  const connectorLayerActive = hasLeadershipLayoutOffsets(layoutEditor);
  const connectorWatchKey = `${pan.x}:${pan.y}:${zoom}:${containerMinHeight}:${JSON.stringify(layoutEditor.nodeOffsets)}`;
  const membersById = useMemo(
    () =>
      members.reduce((acc, member) => {
        const memberId = getMemberId(member);

        if (memberId) {
          acc[String(memberId)] = member;
        }

        return acc;
      }, {}),
    [members]
  );

  // Rol que ocupa cada miembro dentro de ESTE organigrama: se recorre el arbol de
  // nodos y se cruza con las asignaciones guardadas. Alimenta el desplegable, que
  // muestra a los ya asignados al final y deshabilitados.
  const ocupantesPorMiembro = useMemo(() => {
    const porMiembro = new Map();

    const recorrer = (node) => {
      if (!node) return;

      const asignacion = assignments[getAssignmentKey(node.asignacionOrganigrama)];

      if (asignacion?.idMiembros) {
        porMiembro.set(String(asignacion.idMiembros), node.role || 'un cargo del organigrama');
      }

      (node.children || []).forEach(recorrer);
    };

    [DEST_LEADERSHIP_DATA, ...DEST_DIVISION_GROUPS].forEach(recorrer);

    return porMiembro;
  }, [assignments]);

  // Miembros que se ofrecen en el desplegable: SOLO los de este destacamento.
  const memberOptions = useMemo(
    () =>
      buildLeadershipMemberOptions({
        members,
        nivel: 'destacamento',
        idEntidad: destId,
        index: buildOrgIndex({}),
        ocupantesPorMiembro,
        idMiembroActual: getMemberId(selectedNode?.miembroAsignado),
      }),
    [members, destId, ocupantesPorMiembro, selectedNode]
  );

  useEffect(() => {
    setZoom(getDefaultZoom());
  }, []);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await fetch('/api/members');
        const data = await res.json();
        const loadedMembers = Array.isArray(data?.data) ? data.data : [];
        const memberPhotos = await obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' });

        const membersWithPhotos = await mergeMemberPhotos(loadedMembers, memberPhotos);

        setMembers(
          membersWithPhotos.map((member, index) => ({
            ...member,
            __organigramaOptionKey: `${getMemberOptionKey(member) || 'miembro'}-${index}`,
          }))
        );
      } catch (error) {
        console.error('Error cargando miembros:', error);
      }
    };

    loadMembers();
  }, []);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const data = await obtenerAsignacionesDirectiva({
          nivel: NIVEL_DESTACAMENTO,
          idEntidad: destId,
        });

        setAssignments(
          data.reduce((acc, asignacion) => {
            const casilla = asignacionDirectivaACasilla(asignacion);

            if (casilla) acc[getAssignmentKey(casilla)] = casilla;

            return acc;
          }, {})
        );
      } catch (error) {
        console.error('Error cargando asignaciones del organigrama:', error);
      }
    };

    if (destId) {
      loadAssignments();
    }
  }, [destId]);

  useEffect(() => {
    const handleClickAwayPopover = (event) => {
      // Los dialogos y el desplegable del Autocomplete viven en un Portal fuera
      // del organigrama: sin esta salida, un clic sobre una opcion disparaba el
      // Escape de abajo y cerraba el desplegable antes de registrar la seleccion.
      if (event.target?.closest?.('.MuiDialog-root, .MuiAutocomplete-popper')) {
        return;
      }

      const popoverPapers = Array.from(document.querySelectorAll('.MuiPopover-paper'));

      if (
        !popoverPapers.length ||
        popoverPapers.some((popoverPaper) => popoverPaper.contains(event.target))
      ) {
        return;
      }

      skipNextDragRef.current = true;
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
        })
      );
    };

    document.addEventListener('pointerdown', handleClickAwayPopover, true);

    return () => {
      document.removeEventListener('pointerdown', handleClickAwayPopover, true);
    };
  }, []);

  useEffect(() => {
    const loadDest = async () => {
      try {
        const res = await fetch('/api/dest');
        const data = await res.json();
        const found = (data?.data || []).find(
          (dest) =>
            String(dest.idDestacamento) === String(destId) || String(dest.id) === String(destId)
        );

        if (found?.nombre || found?.name) {
          setDestName(found.nombre || found.name);
        }

        // El numero es como el usuario identifica el destacamento (875, no 219).
        if (found?.numero || found?.destNumber) {
          setDestNumber(String(found.numero || found.destNumber));
        }
      } catch (error) {
        console.error('Error cargando destacamento:', error);
      }
    };

    if (destId) {
      loadDest();
    }
  }, [destId]);

  const handlePointerDown = (event) => {
    const interactiveElement = event.target.closest?.(
      '.MuiCard-root, button, a, input, textarea, select, [role="button"]'
    );

    if (skipNextDragRef.current) {
      skipNextDragRef.current = false;
      return;
    }

    if (event.button !== 0 || interactiveElement) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!isDragging) {
      return;
    }

    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;

    setPan({
      x: dragRef.current.panX + deltaX,
      y: dragRef.current.panY + deltaY,
    });
  };

  const handlePointerUp = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
  };

  const handleZoomOut = () => {
    setZoom((currentZoom) => Math.max(MIN_ZOOM, Number((currentZoom - ZOOM_STEP).toFixed(2))));
  };

  const handleZoomIn = () => {
    setZoom((currentZoom) => Math.min(MAX_ZOOM, Number((currentZoom + ZOOM_STEP).toFixed(2))));
  };

  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(getDefaultZoom());
  };

  const getAssignedMember = (node) => {
    const assignment = assignments[getAssignmentKey(node?.asignacionOrganigrama)];

    if (!assignment?.idMiembros) {
      return null;
    }

    // Si el ocupante no viene en el listado de miembros (baja, filtro), se usa
    // la copia guardada en la asignacion: el cargo esta ocupado y el nodo no
    // debe pintarse como vacante.
    return (
      membersById[String(assignment.idMiembros)] ||
      resolverMiembroAsignado({
        asignacion: { ...assignment, idMiembro: assignment.idMiembros },
        members: [],
      })
    );
  };

  const handleOpenChangeMember = (node) => {
    setSelectedNode(node);
    setSelectedMember(getAssignedMember(node));
  };

  const handleCloseChangeMember = () => {
    if (isSavingMember) {
      return;
    }

    setSelectedNode(null);
    setSelectedMember(null);
  };

  const handleSaveMemberAssignment = async () => {
    const memberId = getMemberId(selectedMember);
    const assignmentInfo = selectedNode?.asignacionOrganigrama;

    if (!assignmentInfo || !memberId) {
      toast.warning('Selecciona un miembro para asignarlo al rol.');
      return;
    }

    setIsSavingMember(true);

    try {
      // La barra "Asignando..." dura AL MENOS RETARDO_ASIGNACION_MS: van en
      // paralelo, asi que una escritura rapida no se salta el acuse de recibo y
      // una lenta tampoco suma la espera encima. El tiempo se cambia en
      // `use-leadership-assignments`, que es de donde sale la constante.
      const position = POSICION_POR_CASILLA.get(getAssignmentKey(assignmentInfo));

      if (!position) {
        throw new Error('Este nodo no está en el catálogo de cargos.');
      }

      const [asignacionGuardada] = await Promise.all([
        guardarAsignacionDirectiva({
          nivel: NIVEL_DESTACAMENTO,
          idEntidad: destId,
          idCargo: Number(position.idCargoApi) || null,
          idMiembro: memberId,
          idPosicionDirectiva: position.idCargo,
          division: position.division ?? null,
          orden: position.orden || 1,
          origen: 'organigrama-destacamento',
          activo: true,
          ...construirResumenMiembro(selectedMember || {}),
        }),
        new Promise((resolve) => {
          setTimeout(resolve, RETARDO_ASIGNACION_MS);
        }),
      ]);

      // Un miembro ocupa UNA casilla por destacamento: sin esto, moverlo de rol
      // lo dejaba dibujado tambien en el anterior.
      await desactivarAsignacionesDirectivaPorNivel({
        idMiembro: memberId,
        nivel: NIVEL_DESTACAMENTO,
        conservarIdAsignacion: asignacionGuardada?.idAsignacion || '',
      }).catch(() => 0);

      const casilla = asignacionDirectivaACasilla(asignacionGuardada);

      setAssignments((current) => {
        const siguientes = { ...current };

        // Fuera cualquier OTRA casilla del mismo miembro, que acaba de quedar
        // liberada arriba.
        Object.entries(siguientes).forEach(([clave, valor]) => {
          if (String(valor?.idMiembros) === String(memberId)) delete siguientes[clave];
        });

        if (casilla) siguientes[getAssignmentKey(casilla)] = casilla;

        return siguientes;
      });
      setSelectedNode(null);
      setSelectedMember(null);
      toast.success('Miembro asignado correctamente.');
    } catch (error) {
      console.error('Error guardando asignacion del organigrama:', error);
      toast.error(error?.message || 'No se pudo asignar el miembro.');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleOpenRemoveMember = (node) => {
    const assignmentInfo = node?.asignacionOrganigrama;
    const assignmentKey = getAssignmentKey(assignmentInfo);
    const assignment = assignments[assignmentKey];

    if (!assignment?.id) {
      toast.info('Este rol no tiene un miembro asignado.');
      return;
    }

    setRemoveMemberNode(node);
  };

  const handleCloseRemoveMember = () => {
    setRemoveMemberNode(null);
  };

  const handleConfirmRemoveMember = async () => {
    const assignmentInfo = removeMemberNode?.asignacionOrganigrama;
    const assignmentKey = getAssignmentKey(assignmentInfo);
    const assignment = assignments[assignmentKey];

    if (!assignment?.id) {
      toast.info('Este rol no tiene un miembro asignado.');
      setRemoveMemberNode(null);
      return;
    }

    const position = POSICION_POR_CASILLA.get(assignmentKey);

    try {
      // Se da de baja escribiendo la misma asignacion con activo=false, igual que
      // hacen las Directivas de seccion, region y nacion.
      await guardarAsignacionDirectiva({
        nivel: NIVEL_DESTACAMENTO,
        idEntidad: destId,
        idCargo: Number(position?.idCargoApi) || null,
        idMiembro: assignment.idMiembros,
        idPosicionDirectiva: position?.idCargo || '',
        division: position?.division ?? null,
        orden: position?.orden || 1,
        origen: 'organigrama-destacamento',
        activo: false,
      });

      setAssignments((current) => {
        const nextAssignments = { ...current };
        delete nextAssignments[assignmentKey];
        return nextAssignments;
      });
      toast.success('Miembro removido del rol.');
      setRemoveMemberNode(null);
    } catch (error) {
      console.error('Error removiendo miembro del organigrama:', error);
      toast.error(error?.message || 'No se pudo remover el miembro.');
    }
  };

  const handleRoleInfo = (node) => {
    setRoleInfoNode(node);
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);

    try {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
        })
      );

      const chartData = await getLeadershipPdfChartData(getAssignedMember);
      const blob = await pdf(
        <LeadershipPdfDocument destName={destNombreCompleto} chartData={chartData} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `organigrama-${slugify(destName)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <DestEditLayout>
      <Box
        ref={chartCaptureRef}
        aria-label="Mover organigrama"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        sx={{
          width: 1,
          mx: 'auto',
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          minHeight: containerMinHeight,
          justifyContent: 'center',
          bgcolor: 'background.neutral',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          py: { xs: 3, md: 4 },
          px: { xs: 1.5, md: 2 },
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          touchAction: 'none',
          ...getLeadershipEditGridSx(layoutEditor.editMode),
          ...getLeadershipConnectorOverrideSx(connectorLayerActive),
          '& button, & a, & input, & textarea, & select, & [role="button"]': {
            cursor: 'pointer',
            touchAction: 'auto',
          },
          '& .MuiCard-root': {
            cursor: layoutEditor.editMode ? 'move' : 'default',
            touchAction: 'auto',
          },
          '& .MuiCard-root button': {
            cursor: 'pointer',
          },
        }}
      >
        <Stack
          data-pdf-hidden="true"
          spacing={0.75}
          onPointerDown={(event) => event.stopPropagation()}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 20,
            pointerEvents: 'auto',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gap: `${CONTROL_BUTTON_GAP}px`,
              gridTemplateColumns: `repeat(3, ${CONTROL_BUTTON_SIZE}px)`,
            }}
          >
            <Tooltip title="Centrar vista">
              <IconButton
                size="small"
                aria-label="Centrar vista"
                onClick={handleResetView}
                sx={{
                  width: CONTROL_BUTTON_SIZE,
                  height: CONTROL_BUTTON_SIZE,
                  minWidth: CONTROL_BUTTON_SIZE,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  boxShadow: 1,
                  '&:hover': { bgcolor: 'background.paper' },
                }}
              >
                <Iconify width={18} icon="solar:restart-bold" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Descargar PDF">
              <Box component="span" sx={{ gridColumn: '1', gridRow: '2' }}>
                <IconButton
                  size="small"
                  aria-label="Descargar PDF"
                  disabled={isDownloading}
                  onClick={handleDownloadPdf}
                  sx={{
                    width: CONTROL_BUTTON_SIZE,
                    height: CONTROL_BUTTON_SIZE,
                    minWidth: CONTROL_BUTTON_SIZE,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    boxShadow: 1,
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  <Iconify width={18} icon="solar:download-bold" />
                </IconButton>
              </Box>
            </Tooltip>

            <Tooltip title="Reducir zoom">
              <Box component="span" sx={{ gridColumn: '2', gridRow: '1' }}>
                <IconButton
                  size="small"
                  aria-label="Reducir zoom"
                  disabled={zoom <= MIN_ZOOM}
                  onClick={handleZoomOut}
                  sx={{
                    width: CONTROL_BUTTON_SIZE,
                    height: CONTROL_BUTTON_SIZE,
                    minWidth: CONTROL_BUTTON_SIZE,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    boxShadow: 1,
                    fontSize: 20,
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  -
                </IconButton>
              </Box>
            </Tooltip>

            <Tooltip title="Aumentar zoom">
              <Box component="span" sx={{ gridColumn: '3', gridRow: '1' }}>
                <IconButton
                  size="small"
                  aria-label="Aumentar zoom"
                  disabled={zoom >= MAX_ZOOM}
                  onClick={handleZoomIn}
                  sx={{
                    width: CONTROL_BUTTON_SIZE,
                    height: CONTROL_BUTTON_SIZE,
                    minWidth: CONTROL_BUTTON_SIZE,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    boxShadow: 1,
                    fontSize: 20,
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  +
                </IconButton>
              </Box>
            </Tooltip>

            <Typography
              variant="caption"
              sx={{
                width: ZOOM_PERCENT_WIDTH,
                height: CONTROL_BUTTON_SIZE,
                minWidth: ZOOM_PERCENT_WIDTH,
                display: 'flex',
                gridColumn: '2 / 4',
                gridRow: '2',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                borderRadius: 1,
                boxShadow: 1,
                lineHeight: 1.5,
                fontWeight: 700,
                color: 'text.secondary',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {zoomPercentage}%
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            '--chart-pan-x': `${pan.x}px`,
            '--chart-pan-y': `${pan.y}px`,
            '--chart-zoom': zoom,
            width: 1080,
            zIndex: 2,
            position: 'relative',
            flexShrink: 0,
            '--chart-base-scale': {
              xs: 0.42,
              sm: 0.5,
              md: 0.58,
              lg: 0.68,
              xl: 0.78,
            },
            transform: {
              xs: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              sm: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              md: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              lg: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              xl: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
            },
            transformOrigin: 'top center',
          }}
        >
          <Typography
            variant="h3"
            onPointerUp={titleEditProps.onPointerUp}
            onPointerMove={titleEditProps.onPointerMove}
            onPointerDown={titleEditProps.onPointerDown}
            onPointerCancel={titleEditProps.onPointerCancel}
            sx={{
              mb: 3,
              mx: 'auto',
              width: 'fit-content',
              textAlign: 'center',
              fontWeight: 700,
              ...getLeadershipEditableNodeSx(titleEditProps),
            }}
          >
            {titleText}
          </Typography>

          <OrganizationalChart
            lineWidth="2px"
            lineHeight="34px"
            lineColor="var(--palette-grey-500)"
            data={DEST_LEADERSHIP_DATA}
            nodeClassName={layoutEditor.getNodeTreeClassName}
            nodeItem={(props) => (
              <LeadershipNode
                sx={{}}
                {...props}
                layoutEditor={layoutEditor}
                mostrarAvisoDatos={mostrarAvisoDatos}
                canManage={canManageLeadership}
                restringido={cargoRestringido(props?.id)}
                miembroAsignado={getAssignedMember(props)}
                onCambiarMiembro={handleOpenChangeMember}
                onRemoverMiembro={handleOpenRemoveMember}
                onInformacionRol={handleRoleInfo}
              />
            )}
          />

          <Box
            sx={{
              mt: '34px',
              display: 'flex',
              gap: 1,
              justifyContent: 'center',
            }}
          >
            {DEST_DIVISION_GROUPS.map((node) => (
              <OrganizationalChart
                key={node.id}
                lineWidth="2px"
                lineHeight="34px"
                lineColor="var(--palette-grey-500)"
                data={node}
                nodeClassName={layoutEditor.getNodeTreeClassName}
                nodeItem={(props) =>
                  props.isDivision ? (
                    <DivisionNode sx={{}} {...props} layoutEditor={layoutEditor} />
                  ) : (
                    <LeadershipNode
                      sx={{}}
                      {...props}
                      layoutEditor={layoutEditor}
                      mostrarAvisoDatos={mostrarAvisoDatos}
                      canManage={canManageLeadership}
                      restringido={cargoRestringido(props?.id)}
                      miembroAsignado={getAssignedMember(props)}
                      onCambiarMiembro={handleOpenChangeMember}
                      onRemoverMiembro={handleOpenRemoveMember}
                      onInformacionRol={handleRoleInfo}
                    />
                  )
                }
              />
            ))}
          </Box>
        </Box>

        <LeadershipLayoutConnectorLayer
          active={connectorLayerActive}
          watchKey={connectorWatchKey}
          connections={connections}
          containerRef={chartCaptureRef}
          lineWidth={2}
        />

        <LeadershipLayoutOffsetStyles editor={layoutEditor} />

        {canManageLeadership && (
          <LeadershipLayoutEditor
            pan={pan}
            zoom={zoom}
            chartWidth={1080}
            title={titleText}
            editor={layoutEditor}
            containerMinHeight={containerMinHeight}
            onSaveLayout={layoutStorage.guardar}
            savingLayout={layoutStorage.guardando}
          />
        )}
      </Box>

      <Dialog
        open={!!selectedNode}
        onClose={handleCloseChangeMember}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {selectedNode?.miembroAsignado ? 'Cambiar miembro' : 'Asignar miembro'}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {selectedNode?.role || 'Rol del organigrama'}
              </Typography>

              {/* De donde salen los miembros de la lista. */}
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {getLeadershipScopeLabel({
                  nivel: 'destacamento',
                  nombreEntidad: [destName, destNumber].filter(Boolean).join(' '),
                })}
              </Typography>
            </Box>

            <Autocomplete
              options={memberOptions}
              // Por id, no por identidad de objeto (ver dialogo compartido).
              value={
                memberOptions.find(
                  (option) => option.id === String(getMemberId(selectedMember) ?? '')
                ) || null
              }
              loading={!members.length}
              onChange={(event, option) => setSelectedMember(option?.member ?? null)}
              getOptionLabel={(option) => option?.nombre || ''}
              getOptionKey={(option) => option?.id}
              // Quien ya ocupa otro cargo se lista, pero no se puede elegir.
              getOptionDisabled={(option) => Boolean(option?.disabled)}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              noOptionsText="No hay miembros en este destacamento"
              renderOption={(optionProps, option) => {
                const { key, ...liProps } = optionProps;

                return (
                  // El texto que no cabe baja de linea en vez de recortarse,
                  // igual que en el dialogo de seccion, region y nacion.
                  <Box
                    key={key}
                    component="li"
                    {...liProps}
                    sx={{ alignItems: 'flex-start', ...liProps.sx }}
                  >
                    <Avatar
                      alt={option.nombre}
                      src={getMemberAvatar(option.member)}
                      sx={{ width: 36, height: 36, mr: 1.5, mt: 0.25, flexShrink: 0 }}
                    />

                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2">{option.nombre}</Typography>

                      <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                        {option.rolActual ? `Ya es ${option.rolActual}` : option.subtitulo}
                      </Typography>
                    </Box>
                  </Box>
                );
              }}
              renderInput={(autocompleteParams) => (
                <TextField {...autocompleteParams} label="Miembro" placeholder="Buscar miembro" />
              )}
            />

            {/* Acuse de recibo del clic, igual que en seccion, region y nacion.
                El hueco se reserva siempre para que el dialogo no salte. */}
            <Box sx={{ minHeight: 28 }}>
              {isSavingMember && (
                <>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Asignando...
                  </Typography>

                  <LinearProgress sx={{ mt: 0.5, borderRadius: 1 }} />
                </>
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button disabled={isSavingMember} onClick={handleCloseChangeMember}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            disabled={!selectedMember || isSavingMember}
            onClick={handleSaveMemberAssignment}
          >
            Asignar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!roleInfoNode} onClose={() => setRoleInfoNode(null)} fullWidth maxWidth="sm">
        <DialogTitle>Información de rol</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="subtitle1">{roleInfoNode?.role || 'Rol del organigrama'}</Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent
              libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum
              imperdiet. Duis sagittis ipsum.
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button variant="contained" onClick={() => setRoleInfoNode(null)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!removeMemberNode} onClose={handleCloseRemoveMember} fullWidth maxWidth="xs">
        <DialogTitle>Remover miembro</DialogTitle>

        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            ¿Realmente quieres remover a{' '}
            <Box component="strong" sx={{ color: 'text.primary' }}>
              {getMemberName(getAssignedMember(removeMemberNode)) || 'este miembro'}
            </Box>{' '}
            del rol {removeMemberNode?.role || 'seleccionado'}?
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseRemoveMember}>Cancelar</Button>

          <Button variant="contained" color="error" onClick={handleConfirmRemoveMember}>
            Remover
          </Button>
        </DialogActions>
      </Dialog>
    </DestEditLayout>
  );
}
