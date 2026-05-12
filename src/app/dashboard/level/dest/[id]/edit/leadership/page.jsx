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

import { useParams } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { obtenerFotoPrincipal, obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';

import {
  obtenerAsignacionesOrganigramaPorDestacamento,
  guardarAsignacionOrganigramaDirectivaDestacamento,
  desactivarAsignacionOrganigramaDirectivaDestacamento,
} from 'src/services/organigrama-directiva-destacamentos-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { OrganizationalChart } from 'src/components/organizational-chart';

import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { SIMPLE_DATA, LEADER_GROUP_DATA } from 'src/sections/_examples/extra/organizational-chart-view/data';

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

function DivisionNode({ name, avatarUrl, role, sx }) {
  return (
    <Card
      sx={[
        () => ({
          px: 1.5,
          py: 1,
          gap: 1,
          minWidth: 200,
          borderRadius: 1.5,
          textAlign: 'left',
          alignItems: 'center',
          display: 'inline-flex',
        }),
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

        <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary' }}>
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

function LeadershipNode({
  name,
  avatarUrl,
  role,
  sx,
  miembroAsignado,
  asignacionOrganigrama,
  onCambiarMiembro,
  onRemoverMiembro,
  onInformacionRol,
}) {
  const menuActions = usePopover();
  const displayName = miembroAsignado ? getMemberName(miembroAsignado) : name;
  const displayAvatar = miembroAsignado ? getMemberAvatar(miembroAsignado) : avatarUrl;
  const miembroAsignadoId = getMemberId(miembroAsignado);
  const memberProfileHref = miembroAsignadoId
    ? `/dashboard/level/member/${miembroAsignadoId}/edit`
    : '';

  const handleCambiarMiembro = () => {
    menuActions.onClose();
    onCambiarMiembro?.({ name, role, avatarUrl, asignacionOrganigrama });
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
        <MenuItem {...getMenuItemActionProps(handleCambiarMiembro)}>
          <Iconify icon="solar:user-plus-bold" />
          Cambiar miembro
        </MenuItem>

        <MenuItem {...getMenuItemActionProps(handleRemoverMiembro)} sx={{ color: 'error.main' }}>
          <Iconify icon="solar:user-cross-bold" />
          Remover miembro
        </MenuItem>

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
        sx={[
          () => ({
            p: 2,
            minWidth: 200,
            borderRadius: 1.5,
            textAlign: 'left',
            position: 'relative',
            display: 'inline-flex',
            flexDirection: 'column',
          }),
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
          <Avatar
            alt={displayName}
            src={displayAvatar}
            sx={{
              width: 1,
              height: 1,
            }}
          />
        </Box>

        <Typography variant="subtitle2" noWrap sx={{ mb: 0.5, pr: 3 }}>
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
        </Typography>

        <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary' }}>
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
  const displayName = assignedMember ? getMemberName(assignedMember) : node?.name;
  const displayAvatar = assignedMember ? getMemberAvatar(assignedMember) : node?.avatarUrl;

  return {
    name: displayName || '',
    role: node?.role || '',
    avatarUrl: await getPdfImageSrc(displayAvatar),
  };
};

const getLeadershipPdfChartData = async (getAssignedMember) => {
  const coordinator = SIMPLE_DATA.children?.[0] || {};
  const assistantCoordinator = coordinator.children?.[0] || {};
  const council = assistantCoordinator.children?.[0] || {};
  const chaplain = assistantCoordinator.children?.[1] || {};
  const divisions = await Promise.all(
    LEADER_GROUP_DATA.map(async (division) => {
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
    pastor: await getPdfPersonNode(SIMPLE_DATA, getAssignedMember),
    coordinator: await getPdfPersonNode(coordinator, getAssignedMember),
    assistantCoordinator: await getPdfPersonNode(assistantCoordinator, getAssignedMember),
    council: await getPdfPersonNode(council, getAssignedMember),
    chaplain: await getPdfPersonNode(chaplain, getAssignedMember),
    divisions,
  };
};

export default function Page() {
  const params = useParams();
  const destId = params?.id;
  const chartCaptureRef = useRef(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const skipNextDragRef = useRef(false);
  const [destName, setDestName] = useState('Destacamento');
  const [members, setMembers] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [roleInfoNode, setRoleInfoNode] = useState(null);
  const [removeMemberNode, setRemoveMemberNode] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const zoomPercentage = Math.round(zoom * 100);
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
        const data = await obtenerAsignacionesOrganigramaPorDestacamento(destId);

        setAssignments(
          data.reduce((acc, assignment) => {
            acc[getAssignmentKey(assignment)] = assignment;
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

    return assignment?.idMiembros ? membersById[String(assignment.idMiembros)] : null;
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
      const savedAssignment = await guardarAsignacionOrganigramaDirectivaDestacamento({
        idDestacamento: destId,
        idMiembros: memberId,
        ...assignmentInfo,
      });

      setAssignments((current) => ({
        ...current,
        [getAssignmentKey(savedAssignment)]: savedAssignment,
      }));
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

    try {
      await desactivarAsignacionOrganigramaDirectivaDestacamento(assignment.id);

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
        <LeadershipPdfDocument destName={destName} chartData={chartData} />
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
          minHeight: 680,
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
          '& button, & a, & input, & textarea, & select, & [role="button"]': {
            cursor: 'pointer',
            touchAction: 'auto',
          },
          '& .MuiCard-root': {
            cursor: 'default',
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
            zIndex: 2,
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
            sx={{
              mb: 3,
              textAlign: 'center',
              fontWeight: 700,
            }}
          >
            {destName && destName !== 'Destacamento'
              ? `Destacamento ${destName}`
              : 'Destacamento'}
          </Typography>

          <OrganizationalChart
            lineWidth="1px"
            lineHeight="34px"
            lineColor="var(--palette-grey-500)"
            data={SIMPLE_DATA}
            nodeItem={(props) => (
              <LeadershipNode
                sx={{}}
                {...props}
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
            {LEADER_GROUP_DATA.map((node) => (
              <OrganizationalChart
                key={node.id}
                lineWidth="1px"
                lineHeight="34px"
                lineColor="var(--palette-grey-500)"
                data={node}
                nodeItem={(props) =>
                  props.isDivision ? (
                    <DivisionNode sx={{}} {...props} />
                  ) : (
                    <LeadershipNode
                      sx={{}}
                      {...props}
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
      </Box>

      <Dialog
        open={!!selectedNode}
        onClose={handleCloseChangeMember}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Cambiar miembro</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {selectedNode?.role || 'Rol del organigrama'}
            </Typography>

            <Autocomplete
              options={members}
              value={selectedMember}
              loading={!members.length}
              onChange={(event, value) => setSelectedMember(value)}
              getOptionLabel={(option) => getMemberName(option)}
              getOptionKey={(option) => getMemberOptionKey(option)}
              isOptionEqualToValue={(option, value) =>
                getMemberOptionKey(option) === getMemberOptionKey(value)
              }
              renderOption={(optionProps, option) => {
                const { key, ...liProps } = optionProps;

                return (
                  <Box key={key} component="li" {...liProps}>
                    <Avatar
                      alt={getMemberName(option)}
                      src={getMemberAvatar(option)}
                      sx={{ width: 36, height: 36, mr: 1.5 }}
                    />

                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {getMemberName(option)}
                      </Typography>

                      <Typography
                        variant="caption"
                        component="div"
                        noWrap
                        sx={{ color: 'text.secondary' }}
                      >
                        {option.codigoMiembro || option.memberId || `ID ${getMemberId(option)}`}
                      </Typography>
                    </Box>
                  </Box>
                );
              }}
              renderInput={(autocompleteParams) => (
                <TextField {...autocompleteParams} label="Miembro" placeholder="Buscar miembro" />
              )}
            />
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
