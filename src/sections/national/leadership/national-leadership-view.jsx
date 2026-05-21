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

import { _mock } from 'src/_mock';

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

// ----------------------------------------------------------------------

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 1;
const DEFAULT_PAN = { x: 18, y: -6 };
const DEFAULT_CONTAINER_HEIGHT_OFFSET = -480;
const DEFAULT_NODE_OFFSETS = {
  'asambleas-de-dios': { x: 0, y: 11 },
  'capellan-nacional': { x: -440, y: 1 },
  'titulo-directiva-nacional': { x: -26, y: 0 },
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

const NATIONAL_LEADERSHIP_DATA = {
  ...createNode(1, 'asambleas-de-dios', 'Concilio de las Asambleas de Dios, INC.', [
  createNode(2, 'ministerios-infantiles', 'Ministerios infantiles', [
    createNode(3, 'consejo-nacional', 'Consejo Nacional', [
      createNode(4, 'director-nacional', 'Director Nacional', [
        createNode(5, 'consejo-ejecutivo', 'Consejo Ejecutivo', [
          createNode(6, 'coordinador-nacional-adiestramiento', 'Coordinador Nacional de Adiestramiento', [
            createNode(7, 'oficiales-adiestramientos-especiales', 'Oficiales de Adiestramientos Especiales'),
          ]),
          createNode(8, 'sub-director-nacional', 'Sub-Director Nacional'),
          createNode(9, 'coordinador-nacional-promocion', 'Coordinador Nacional de Promoción'),
          createNode(10, 'coordinador-nacional-produccion', 'Coordinador Nacional de Producción'),
          createNode(11, 'coordinador-nacional-programa', 'Coordinador Nacional de Programa'),
          createNode(12, 'comites-especiales', 'Comités Especiales'),
        ]),
        createNode(13, 'capellan-nacional', 'Capellán Nacional'),
      ]),
    ]),
  ]),
  ]),
  name: 'Concilio de las Asambleas de Dios',
  avatarUrl: '/logo/asambleas-de-dios.png',
  isDivision: true,
};

// ----------------------------------------------------------------------

function NationalDivisionNode({ id, name, depth, avatarUrl, role, layoutEditor }) {
  const editProps = layoutEditor.getNodeEditProps({ id, name, role });
  const isRootNode = depth === undefined;

  return (
    <Card
      data-leadership-node-id={id}
      data-leadership-editable="true"
      onPointerUp={editProps.onPointerUp}
      onPointerMove={editProps.onPointerMove}
      onPointerDown={editProps.onPointerDown}
      onPointerCancel={editProps.onPointerCancel}
      sx={{
        px: 1.5,
        py: 1,
        gap: 1,
        minWidth: 200,
        borderRadius: 1.5,
        textAlign: 'left',
        alignItems: 'center',
        display: 'inline-flex',
        ...getLeadershipEditableNodeSx(editProps, { applyTransform: isRootNode }),
      }}
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

function NationalLeadershipNode({ id, name, depth, avatarUrl, role, isDivision, layoutEditor }) {
  const menuActions = usePopover();
  const isRootNode = depth === undefined;

  if (isDivision) {
    return (
      <NationalDivisionNode
        id={id}
        name={name}
        depth={depth}
        role={role}
        avatarUrl={avatarUrl}
        layoutEditor={layoutEditor}
      />
    );
  }

  const editProps = layoutEditor.getNodeEditProps({ id, name, role });

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'left-center' } }}
    >
      <MenuList onPointerDown={(event) => event.stopPropagation()}>
        <MenuItem onClick={menuActions.onClose}>
          <Iconify icon="solar:user-plus-bold" />
          Cambiar miembro
        </MenuItem>

        <MenuItem onClick={menuActions.onClose} sx={{ color: 'error.main' }}>
          <Iconify icon="solar:user-cross-bold" />
          Remover miembro
        </MenuItem>

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
          <Avatar
            alt={name}
            src={avatarUrl}
            sx={{
              width: 1,
              height: 1,
            }}
          >
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

export function NationalLeadershipView() {
  const containerRef = useRef(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const skipNextDragRef = useRef(false);
  const layoutEditor = useLeadershipLayoutEditor({
    initialNodeOffsets: DEFAULT_NODE_OFFSETS,
    initialContainerHeightOffset: DEFAULT_CONTAINER_HEIGHT_OFFSET,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [pan, setPan] = useState(DEFAULT_PAN);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const zoomPercentage = useMemo(() => Math.round(zoom * 100), [zoom]);
  const containerMinHeight = 680 + layoutEditor.containerHeightOffset;
  const connections = useMemo(() => getLeadershipConnections(NATIONAL_LEADERSHIP_DATA), []);
  const connectorLayerActive = hasLeadershipLayoutOffsets(layoutEditor);
  const connectorWatchKey = `${pan.x}:${pan.y}:${zoom}:${containerMinHeight}:${JSON.stringify(layoutEditor.nodeOffsets)}`;

  useEffect(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

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
    id: 'titulo-directiva-nacional',
    name: 'Directiva nacional',
    role: 'Titulo de estructura',
  });

  return (
    <Box
      ref={containerRef}
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
          width: 1440,
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
          Directiva nacional
        </Typography>

        <OrganizationalChart
          lineWidth="2px"
          lineHeight="34px"
          lineColor="var(--palette-grey-500)"
          data={NATIONAL_LEADERSHIP_DATA}
          nodeClassName={layoutEditor.getNodeTreeClassName}
          nodeItem={(props) => (
            <NationalLeadershipNode {...props} layoutEditor={layoutEditor} />
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

      <LeadershipLayoutEditor
        pan={pan}
        zoom={zoom}
        chartWidth={1440}
        title="Directiva nacional"
        editor={layoutEditor}
        containerMinHeight={containerMinHeight}
      />
    </Box>
  );
}
