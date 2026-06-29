'use client';

import { usePopover } from 'minimal-shared/hooks';
import { useRef, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { useParams } from 'src/routes/hooks';

import { isDestacamentoAdminRole } from 'src/utils/admin-role-label';

import { _mock } from 'src/_mock';
import { getSectionalById } from 'src/services/sectional-service';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { OrganizationalChart } from 'src/components/organizational-chart';

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

// ----------------------------------------------------------------------

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 1.1;
const DEFAULT_PAN = { x: -46, y: 26 };
const DEFAULT_CONTAINER_HEIGHT_OFFSET = -120;
const DEFAULT_NODE_OFFSETS = {
  'capellan-seccional': { x: -417, y: 1 },
  'titulo-estructura-seccional': { x: 56, y: -11 },
};
const CONTROL_BUTTON_SIZE = 36;
const CONTROL_BUTTON_GAP = 6;
const ZOOM_PERCENT_WIDTH = CONTROL_BUTTON_SIZE * 2 + CONTROL_BUTTON_GAP;

const createNode = (index, id, role, children) => ({
  id,
  name: _mock.fullName(index),
  avatarUrl: _mock.image.avatar(index),
  role,
  children,
});

const SECTIONAL_LEADERSHIP_DATA = createNode(1, 'directiva-regional', 'Directiva Regional', [
  createNode(2, 'coordinador-seccional', 'Coordinador Seccional', [
    createNode(4, 'sub-coordinador-seccional', 'Sub-Coordinador Seccional'),
    createNode(5, 'coordinador-adiestramiento', 'Coordinador de Adiestramiento'),
    createNode(6, 'coordinador-promocion', 'Coordinador de Promoción'),
    createNode(7, 'coordinador-produccion', 'Coordinador de Producción'),
    createNode(8, 'coordinador-programa', 'Coordinador de Programa'),
    createNode(9, 'secretario-regional', 'Secretario Regional'),
    createNode(10, 'zonas', 'Zonas', [createNode(11, 'grupos-locales', 'Grupos Locales')]),
  ]),
  createNode(3, 'capellan-seccional', 'Capellán Seccional'),
]);

// ----------------------------------------------------------------------

function SectionalLeadershipNode({ id, name, depth, avatarUrl, role, layoutEditor, canManage = true }) {
  const menuActions = usePopover();
  const editProps = layoutEditor.getNodeEditProps({ id, name, role });
  const isRootNode = depth === undefined;

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'left-center' } }}
    >
      <MenuList onPointerDown={(event) => event.stopPropagation()}>
        {canManage && (
          <MenuItem onClick={menuActions.onClose}>
            <Iconify icon="solar:user-plus-bold" />
            Cambiar miembro
          </MenuItem>
        )}

        {canManage && (
          <MenuItem onClick={menuActions.onClose} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:user-cross-bold" />
            Remover miembro
          </MenuItem>
        )}

        <MenuItem onClick={menuActions.onClose}>
          <Iconify icon="solar:info-circle-bold" />
          Información de rol
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      <Card
        data-leadership-node-id={id}
        data-leadership-editable="true"
        onPointerUp={editProps.onPointerUp}
        onPointerMove={editProps.onPointerMove}
        onPointerDown={editProps.onPointerDown}
        onPointerCancel={editProps.onPointerCancel}
        sx={{
          p: 2,
          minWidth: 200,
          borderRadius: 1.5,
          textAlign: 'left',
          position: 'relative',
          overflow: 'visible',
          display: 'inline-flex',
          flexDirection: 'column',
          ...getLeadershipEditableNodeSx(editProps, { applyTransform: isRootNode }),
        }}
      >
        <IconButton
          color={menuActions.open ? 'inherit' : 'default'}
          onClick={menuActions.onOpen}
          sx={{ position: 'absolute', top: 8, right: 8 }}
        >
          <Iconify icon="eva:more-horizontal-fill" />
        </IconButton>

        <Box
          sx={{
            mr: 2,
            mb: 2,
            width: 48,
            height: 48,
            display: 'block',
            borderRadius: '50%',
          }}
        >
          <Avatar alt={name} src={avatarUrl} sx={{ width: 1, height: 1 }}>
            {String(name || '?').charAt(0)}
          </Avatar>
        </Box>

        <Typography variant="subtitle2" noWrap sx={{ mb: 0.5, pr: 3 }}>
          {name}
        </Typography>

        <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary' }}>
          {role}
        </Typography>
      </Card>

      {renderMenuActions()}
    </>
  );
}

// ----------------------------------------------------------------------

export function SectionalLeadershipView() {
  const params = useParams();
  const { user } = useAuthContext();
  // El administrador de destacamento consulta el organigrama en solo lectura:
  // sin cambiar/remover miembros ni edicion visual del layout.
  const canManageLeadership = !isDestacamentoAdminRole(user);
  const sectionalId = params?.id;
  const containerRef = useRef(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const skipNextDragRef = useRef(false);
  const layoutEditor = useLeadershipLayoutEditor({
    initialNodeOffsets: DEFAULT_NODE_OFFSETS,
    initialContainerHeightOffset: DEFAULT_CONTAINER_HEIGHT_OFFSET,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [sectionalName, setSectionalName] = useState('');
  const [pan, setPan] = useState(DEFAULT_PAN);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const zoomPercentage = useMemo(() => Math.round(zoom * 100), [zoom]);
  const structureTitle = useMemo(() => {
    const normalizedSectionalName = String(sectionalName || '').trim();

    return normalizedSectionalName ? `Sección ${normalizedSectionalName}` : 'Sección';
  }, [sectionalName]);
  const containerMinHeight = 680 + layoutEditor.containerHeightOffset;
  const connections = useMemo(() => getLeadershipConnections(SECTIONAL_LEADERSHIP_DATA), []);
  const connectorLayerActive = hasLeadershipLayoutOffsets(layoutEditor);
  const connectorWatchKey = `${pan.x}:${pan.y}:${zoom}:${containerMinHeight}:${JSON.stringify(layoutEditor.nodeOffsets)}`;

  useEffect(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSectionalName = async () => {
      const sectional = await getSectionalById(sectionalId);

      if (isMounted) {
        setSectionalName(sectional?.sectionalName || sectional?.name || '');
      }
    };

    if (sectionalId) {
      loadSectionalName();
    } else {
      setSectionalName('');
    }

    return () => {
      isMounted = false;
    };
  }, [sectionalId]);

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
    setPan(DEFAULT_PAN);
    setZoom(DEFAULT_ZOOM);
  };

  const titleEditProps = layoutEditor.getNodeEditProps({
    id: 'titulo-estructura-seccional',
    name: structureTitle,
    role: 'Titulo del diagrama',
  });

  return (
    <Box
      ref={containerRef}
      aria-label="Mover organigrama seccional"
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
          width: 1360,
          zIndex: 2,
          position: 'relative',
          flexShrink: 0,
          '--chart-base-scale': {
            xs: 0.36,
            sm: 0.44,
            md: 0.5,
            lg: 0.58,
            xl: 0.66,
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
          {structureTitle}
        </Typography>

        <OrganizationalChart
          lineWidth="2px"
          lineHeight="34px"
          lineColor="var(--palette-grey-500)"
          data={SECTIONAL_LEADERSHIP_DATA}
          nodeClassName={layoutEditor.getNodeTreeClassName}
          nodeItem={(props) => (
            <SectionalLeadershipNode
              {...props}
              layoutEditor={layoutEditor}
              canManage={canManageLeadership}
            />
          )}
        />
      </Box>

      <LeadershipLayoutConnectorLayer
        active={connectorLayerActive}
        watchKey={connectorWatchKey}
        connections={connections}
        containerRef={containerRef}
        lineWidth={2}
      />

      <LeadershipLayoutOffsetStyles editor={layoutEditor} />

      {canManageLeadership && (
        <LeadershipLayoutEditor
          pan={pan}
          zoom={zoom}
          chartWidth={1360}
          editor={layoutEditor}
          title={structureTitle}
          containerMinHeight={containerMinHeight}
        />
      )}
    </Box>
  );
}
