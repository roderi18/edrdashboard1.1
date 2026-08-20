'use client';

import { usePopover } from 'minimal-shared/hooks';
import { useRef, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { useParams } from 'src/routes/hooks';

import { canManageDirectiva } from 'src/utils/admin-role-label';

import { getRegionals } from 'src/services/regional-service';
import { REGIONAL_LEADERSHIP_DATA } from 'src/catalogs/directiva-diagrams';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';
import { OrganizationalChart } from 'src/components/organizational-chart';

import { LeadershipAssignDialog } from 'src/sections/common/leadership-assign-dialog';
import { useLeadershipAssignments } from 'src/sections/common/use-leadership-assignments';
import { useLeadershipLayoutStorage } from 'src/sections/common/use-leadership-layout-storage';
import {
  LeadershipNodeName,
  LeadershipNodeAvatar,
  getMemberDisplayName,
  LeadershipStructureNode,
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

// ----------------------------------------------------------------------

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 1.1;
const DEFAULT_PAN = { x: -24, y: 19 };
const DEFAULT_NODE_OFFSETS = {
  'titulo-estructura-regional': { x: 13, y: 3 },
  'directiva-regional': { x: -6, y: 11 },
  'capellan-regional': { x: -403, y: 19 },
};
const CONTROL_BUTTON_SIZE = 36;
const CONTROL_BUTTON_GAP = 6;
const ZOOM_PERCENT_WIDTH = CONTROL_BUTTON_SIZE * 2 + CONTROL_BUTTON_GAP;

// El arbol vive en `src/catalogs/directiva-diagrams`: es la misma fuente con la
// que el catalogo decide que cargos se pueden asignar desde la ficha del miembro.

// ----------------------------------------------------------------------

function RegionalLeadershipNode({
  id,
  name,
  depth,
  role,
  avatarUrl,
  isDivision,
  layoutEditor,
  canManage = true,
  miembroAsignado = null,
  onAsignarMiembro,
  onRemoverMiembro,
}) {
  const menuActions = usePopover();
  const identity = getLeadershipNodeIdentity(miembroAsignado);
  const editProps = layoutEditor.getNodeEditProps({
    id,
    name: isDivision ? name : identity.displayName,
    role,
  });
  const isRootNode = depth === undefined;

  // El Consejo Ejecutivo es el cuerpo del que cuelga la Directiva Regional, no un
  // cargo que alguien ocupe: se dibuja como caja de estructura, igual que el
  // Consejo Nacional y el Concilio.
  if (isDivision) {
    return (
      <LeadershipStructureNode
        name={name}
        role={role}
        avatarUrl={avatarUrl}
        data-leadership-node-id={id}
        data-leadership-editable="true"
        onPointerUp={editProps.onPointerUp}
        onPointerMove={editProps.onPointerMove}
        onPointerDown={editProps.onPointerDown}
        onPointerCancel={editProps.onPointerCancel}
        sx={getLeadershipEditableNodeSx(editProps, { applyTransform: isRootNode })}
      />
    );
  }

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'left-center' } }}
    >
      <MenuList onPointerDown={(event) => event.stopPropagation()}>
        {canManage && (
          <MenuItem
            onClick={() => {
              menuActions.onClose();
              onAsignarMiembro?.({ id, role });
            }}
          >
            <Iconify icon="solar:user-plus-bold" />
            {/* Sin ocupante el nodo no se "cambia": se asigna por primera vez. */}
            {miembroAsignado ? 'Cambiar miembro' : 'Asignar miembro'}
          </MenuItem>
        )}

        {canManage && miembroAsignado && (
          <MenuItem
            onClick={() => {
              menuActions.onClose();
              onRemoverMiembro?.({ id, role });
            }}
            sx={{ color: 'error.main' }}
          >
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
          ...LEADERSHIP_NODE_SIZE_SX,
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
          <LeadershipNodeAvatar identity={identity} />
        </Box>

        <LeadershipNodeName identity={identity} />

        <Typography variant="caption" component="div" noWrap title={role} sx={{ color: 'text.secondary' }}>
          {role}
        </Typography>
      </Card>

      {renderMenuActions()}
    </>
  );
}

// ----------------------------------------------------------------------

export function RegionalLeadershipView() {
  const params = useParams();
  const { user } = useAuthContext();
  // Componer la directiva (asignar, cambiar, remover y mover el organigrama) es
  // competencia EXCLUSIVA del administrador global. Los demas roles la consultan
  // en solo lectura. Lo que de verdad lo impide son las reglas de Firestore.
  const canManageLeadership = canManageDirectiva(user);
  const regionalId = params?.id;
  const containerRef = useRef(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const skipNextDragRef = useRef(false);
  const layoutEditor = useLeadershipLayoutEditor({
    initialNodeOffsets: DEFAULT_NODE_OFFSETS,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [regionalName, setRegionalName] = useState('');
  // Asignacion de miembros: mismo flujo que el organigrama del destacamento.
  const leadership = useLeadershipAssignments({
    nivel: 'regional',
    idEntidad: regionalId,
    nombreEntidad: regionalName,
    canManage: canManageLeadership,
  });
  // El diseno del diagrama se guarda en Firestore: antes vivia en memoria y cada
  // recolocacion se perdia al recargar.
  const layoutStorage = useLeadershipLayoutStorage({
    editor: layoutEditor,
    nivel: 'regional',
    idEntidad: regionalId,
    nombreEntidad: regionalName,
    canManage: canManageLeadership,
    defaultNodeOffsets: DEFAULT_NODE_OFFSETS,
  });
  const [pan, setPan] = useState(DEFAULT_PAN);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const zoomPercentage = useMemo(() => Math.round(zoom * 100), [zoom]);
  const structureTitle = useMemo(() => {
    const normalizedRegionalName = String(regionalName || '').trim();

    return normalizedRegionalName ? `Región ${normalizedRegionalName}` : 'Región';
  }, [regionalName]);
  const containerMinHeight = 680 + layoutEditor.containerHeightOffset;
  const connections = useMemo(() => getLeadershipConnections(REGIONAL_LEADERSHIP_DATA), []);
  const connectorLayerActive = hasLeadershipLayoutOffsets(layoutEditor);
  const connectorWatchKey = `${pan.x}:${pan.y}:${zoom}:${containerMinHeight}:${JSON.stringify(layoutEditor.nodeOffsets)}`;

  useEffect(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadRegionalName = async () => {
      const regionals = await getRegionals();
      const regional = (Array.isArray(regionals) ? regionals : []).find(
        (item) => String(item.id) === String(regionalId)
      );

      if (isMounted) {
        setRegionalName(regional?.name || regional?.regionalName || '');
      }
    };

    if (regionalId) {
      loadRegionalName();
    } else {
      setRegionalName('');
    }

    return () => {
      isMounted = false;
    };
  }, [regionalId]);

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

  const handlePointerDown = (event) => {
    // Los dialogos y el desplegable del Autocomplete se renderizan en un Portal,
    // pero React propaga sus eventos por el arbol de componentes: sin excluirlos,
    // este handler capturaba el puntero y el clic nunca llegaba a la opcion.
    const interactiveElement = event.target.closest?.(
      '.MuiCard-root, .MuiDialog-root, .MuiAutocomplete-popper, [role="option"], button, a, input, textarea, select, [role="button"]'
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
    id: 'titulo-estructura-regional',
    name: structureTitle,
    role: 'Titulo del diagrama',
  });

  return (
    <>
      <Box
      ref={containerRef}
      aria-label="Mover organigrama regional"
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
          width: 1180,
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
          {structureTitle}
        </Typography>

        <OrganizationalChart
          lineWidth="2px"
          lineHeight="34px"
          lineColor="var(--palette-grey-500)"
          data={REGIONAL_LEADERSHIP_DATA}
          nodeClassName={layoutEditor.getNodeTreeClassName}
          nodeItem={(props) => (
            <RegionalLeadershipNode
              {...props}
              layoutEditor={layoutEditor}
              canManage={canManageLeadership}
              miembroAsignado={leadership.getAssignedMember(props.id)}
              onAsignarMiembro={leadership.openAssign}
              onRemoverMiembro={leadership.pedirRemoverMiembro}
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
          chartWidth={1180}
          editor={layoutEditor}
          title={structureTitle}
          containerMinHeight={containerMinHeight}
          onSaveLayout={layoutStorage.guardar}
          savingLayout={layoutStorage.guardando}
        />
      )}

    </Box>

      <LeadershipAssignDialog
        open={Boolean(leadership.selectedNode)}
        node={leadership.selectedNode}
        nivel="regional"
        nombreEntidad={regionalName}
        options={leadership.memberOptions}
        loading={!leadership.members.length}
        value={leadership.selectedMember}
        saving={leadership.isSaving}
        yaAsignado={Boolean(leadership.getAssignedMember(leadership.selectedNode?.id))}
        onChange={leadership.setSelectedMember}
        onClose={leadership.closeAssign}
        onSubmit={leadership.asignarMiembro}
      />

      <ConfirmDialog
        open={Boolean(leadership.nodoARemover)}
        onClose={leadership.cancelarRemover}
        title="Remover miembro"
        content={
          <>
            ¿Realmente quieres remover a
            <strong>
              {' '}
              {getMemberDisplayName(
                leadership.getAssignedMember(leadership.nodoARemover?.id)
              ) || 'este miembro'}{' '}
            </strong>
            del cargo de {leadership.nodoARemover?.role || 'la directiva'}?
          </>
        }
        action={
          <Button
            variant="contained"
            color="error"
            disabled={leadership.isSaving}
            onClick={leadership.confirmarRemover}
          >
            Remover
          </Button>
        }
      />
    </>
  );
}
