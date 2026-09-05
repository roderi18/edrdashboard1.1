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
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { useParams } from 'src/routes/hooks';

import { canManageDirectiva } from 'src/utils/admin-role-label';
import { getOwnDestIdsForUser, canManageDestLeadership } from 'src/utils/member-access';

import { getDestsApi } from 'src/services/dest-service';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { OrganizationalChart } from 'src/components/organizational-chart';
import { ConfirmDialog, ConfirmEscribiendoDialog } from 'src/components/custom-dialog';

import { DivisionOptionContent } from 'src/sections/common/division-option-content';
import { LeadershipAssignDialog } from 'src/sections/common/leadership-assign-dialog';
import { useLeadershipAssignments } from 'src/sections/common/use-leadership-assignments';
import { useLeadershipLayoutStorage } from 'src/sections/common/use-leadership-layout-storage';
import {
  LeadershipNodeAvatar,
  getMemberDisplayName,
  LEADERSHIP_NODE_SIZE_SX,
  LeadershipMemberNameLink,
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

import { DIVISIONES_JUVENILES, construirArbolJuvenil } from './dest-youth-leadership-data';

// ----------------------------------------------------------------------
// DIRECTIVA DE LIDERES JUVENILES.
//
// Continua hacia abajo lo que la Directiva Local dibuja: donde aquella termina
// en el Lider de Grupo, esta sigue con el equipo que ese lider dirige. El Lider
// y su primer Asistente son los MISMOS cargos, asi que quien este puesto alla
// sale puesto aqui.
//
// Se ve un cuadro por vez, elegido en el desplegable de division —con su escudo,
// como en Asistencia—. Los cuatro a la vez no caben: dieciseis casillas cada uno.
//
// Cada division guarda SU PROPIA distribucion de cajas: la clave del diseno
// lleva la division dentro, porque los cuadros son iguales en forma pero se
// recolocan por separado.
// ----------------------------------------------------------------------

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 0.9;
const DEFAULT_PAN = { x: 0, y: 0 };
const CONTROL_BUTTON_SIZE = 36;
const CONTROL_BUTTON_GAP = 6;

// El nivel con el que se guarda el DISENO del cuadro. No es un nivel
// organizacional: solo forma la clave del documento, y hace falta que sea
// distinto del de la Directiva Local para que una no se lleve la colocacion de
// la otra.
const NIVEL_DISENO = 'destacamento-juvenil';

// Las asignaciones, en cambio, SI son de destacamento: son los mismos cargos que
// lee la ficha del miembro y la Directiva Local.
const NIVEL_ASIGNACIONES = 'destacamento';

const OPCIONES_DIVISION = DIVISIONES_JUVENILES.map(({ id, nombre, edades }) => ({
  value: nombre,
  id,
  label: `${nombre} · ${edades}`,
}));

// ----------------------------------------------------------------------

function YouthLeadershipNode({
  id,
  depth,
  role,
  layoutEditor,
  canManage = true,
  miembroAsignado = null,
  onAsignarMiembro,
  onRemoverMiembro,
}) {
  const menuActions = usePopover();
  const identity = getLeadershipNodeIdentity(miembroAsignado);
  const editProps = layoutEditor.getNodeEditProps({ id, name: identity.displayName, role });
  const isRootNode = depth === undefined;

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

        <Box sx={{ mr: 2, mb: 2, width: 48, height: 48, display: 'block', borderRadius: '50%' }}>
          <LeadershipNodeAvatar identity={identity} />
        </Box>

        <LeadershipMemberNameLink identity={identity} miembroAsignado={miembroAsignado} />

        <Typography
          variant="caption"
          component="div"
          noWrap
          title={role}
          sx={{ color: 'text.secondary' }}
        >
          {role}
        </Typography>
      </Card>

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
        </MenuList>
      </CustomPopover>
    </>
  );
}

// ----------------------------------------------------------------------

export function DestYouthLeadershipView() {
  const params = useParams();
  const { user } = useAuthContext();
  const destId = params?.id;

  // Componer la directiva: las mismas reglas que la Directiva Local. Quien edita
  // las fichas de su destacamento la compone; la de los demas se consulta.
  const canManageLeadership = canManageDestLeadership(user, destId);

  // MOVER LAS CAJAS es otra cosa, y solo la hace el Administrador Global.
  //
  // El diseno se guarda con un `nivel` propio —`destacamento-juvenil`— y con la
  // division dentro del `idEntidad`, para no pisar la colocacion de la Directiva
  // Local. Pero la regla de `disenosDirectiva` deja escribir al cargo del
  // destacamento solo cuando el nivel es exactamente 'destacamento' y el
  // idEntidad es su destacamento a secas, asi que con esas claves su escritura
  // se rechazaba: se ensenaba el lapiz y al guardar saltaba "Missing or
  // insufficient permissions".
  const canManageLayout = canManageDirectiva(user);

  const containerRef = useRef(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const skipNextDragRef = useRef(false);

  const [divisionId, setDivisionId] = useState(DIVISIONES_JUVENILES[0].id);
  const [destName, setDestName] = useState('');
  const [destNumber, setDestNumber] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [pan, setPan] = useState(DEFAULT_PAN);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const layoutEditor = useLeadershipLayoutEditor();

  const division = DIVISIONES_JUVENILES.find(({ id }) => id === divisionId);
  const destNombreCompleto = [destName, destNumber].filter(Boolean).join(' ').trim();

  const leadership = useLeadershipAssignments({
    nivel: NIVEL_ASIGNACIONES,
    idEntidad: destId,
    nombreEntidad: destNombreCompleto,
    canManage: canManageLeadership,
  });

  const layoutStorage = useLeadershipLayoutStorage({
    editor: layoutEditor,
    nivel: NIVEL_DISENO,
    // La division va en la clave: cada cuadro se recoloca por su cuenta.
    idEntidad: destId ? `${destId}-${divisionId}` : '',
    nombreEntidad: destNombreCompleto,
    canManage: canManageLayout,
  });

  const arbol = useMemo(() => construirArbolJuvenil(divisionId), [divisionId]);
  const connections = useMemo(() => getLeadershipConnections(arbol), [arbol]);
  const connectorLayerActive = hasLeadershipLayoutOffsets(layoutEditor);
  const containerMinHeight = 760 + layoutEditor.containerHeightOffset;
  const connectorWatchKey = `${divisionId}:${pan.x}:${pan.y}:${zoom}:${containerMinHeight}:${JSON.stringify(layoutEditor.nodeOffsets)}`;

  const structureTitle = destNombreCompleto
    ? `${destNombreCompleto} · ${division?.nombre ?? ''}`
    : (division?.nombre ?? 'Líderes Juveniles');

  useEffect(() => {
    let montado = true;

    const cargar = async () => {
      // `getDestById` lee del espejo en localStorage y es SINCRONA: en una
      // pestana recien abierta ese espejo puede estar vacio y el titulo saldria
      // sin nombre. Se pide a la API, igual que hace la Directiva Local.
      const dests = await getDestsApi({ includePhotos: false }).catch(() => []);

      if (!montado) return;

      const dest = (Array.isArray(dests) ? dests : []).find(
        (fila) =>
          String(fila?.id) === String(destId) || String(fila?.idDestacamento) === String(destId)
      );

      setDestName(dest?.name || dest?.nombre || '');
      setDestNumber(String(dest?.destNumber || dest?.numero || ''));
    };

    if (destId) cargar();

    return () => {
      montado = false;
    };
  }, [destId]);

  // Al cambiar de division se vuelve al centro: el cuadro anterior podia quedar
  // desplazado y el nuevo aparecia fuera de la vista.
  useEffect(() => {
    setPan(DEFAULT_PAN);
  }, [divisionId]);

  const handlePointerDown = (event) => {
    const interactivo = event.target.closest?.(
      '.MuiCard-root, .MuiDialog-root, .MuiAutocomplete-popper, [role="option"], button, a, input, textarea, select, [role="button"]'
    );

    if (skipNextDragRef.current) {
      skipNextDragRef.current = false;
      return;
    }

    if (event.button !== 0 || interactivo) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!isDragging) return;

    setPan({
      x: dragRef.current.panX + (event.clientX - dragRef.current.x),
      y: dragRef.current.panY + (event.clientY - dragRef.current.y),
    });
  };

  const handlePointerUp = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
  };

  const botonSx = {
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    minWidth: CONTROL_BUTTON_SIZE,
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 1,
    boxShadow: 1,
    '&:hover': { bgcolor: 'background.paper' },
  };

  const puedeVerDeOtro = getOwnDestIdsForUser(user);
  const esDeOtroDestacamento =
    puedeVerDeOtro.size > 0 && !puedeVerDeOtro.has(String(destId ?? '').trim());

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <TextField
          select
          label="División"
          value={division?.nombre ?? ''}
          onChange={(event) => {
            const elegida = OPCIONES_DIVISION.find((opcion) => opcion.value === event.target.value);

            if (elegida) setDivisionId(elegida.id);
          }}
          sx={{ minWidth: { xs: 1, sm: 280 } }}
          slotProps={{
            select: {
              renderValue: (seleccionada) => {
                const opcion = OPCIONES_DIVISION.find((item) => item.value === seleccionada);

                return <DivisionOptionContent option={opcion} />;
              },
            },
          }}
        >
          {OPCIONES_DIVISION.map((opcion) => (
            <MenuItem key={opcion.id} value={opcion.value}>
              <DivisionOptionContent option={opcion} />
            </MenuItem>
          ))}
        </TextField>

        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          El Guía Mayor y su equipo forman el <strong>Equipo de Liderazgo de Grupo</strong>.
          {esDeOtroDestacamento ? ' Este destacamento no es el tuyo: solo se consulta.' : ''}
        </Typography>
      </Stack>

      <Box
        ref={containerRef}
        aria-label="Mover organigrama de líderes juveniles"
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
          '& .MuiCard-root button': { cursor: 'pointer' },
        }}
      >
        <Stack
          spacing={0.75}
          onPointerDown={(event) => event.stopPropagation()}
          sx={{ position: 'absolute', top: 16, right: 16, zIndex: 20 }}
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
                onClick={() => {
                  setPan(DEFAULT_PAN);
                  setZoom(DEFAULT_ZOOM);
                }}
                sx={botonSx}
              >
                <Iconify width={18} icon="solar:restart-bold" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Alejar">
              <IconButton
                size="small"
                aria-label="Alejar"
                onClick={() =>
                  setZoom((actual) => Math.max(MIN_ZOOM, Number((actual - ZOOM_STEP).toFixed(2))))
                }
                sx={botonSx}
              >
                <Iconify width={18} icon="eva:minus-fill" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Acercar">
              <IconButton
                size="small"
                aria-label="Acercar"
                onClick={() =>
                  setZoom((actual) => Math.min(MAX_ZOOM, Number((actual + ZOOM_STEP).toFixed(2))))
                }
                sx={botonSx}
              >
                <Iconify width={18} icon="eva:plus-fill" />
              </IconButton>
            </Tooltip>
          </Box>
        </Stack>

        <Box
          sx={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top center',
            transition: isDragging ? 'none' : 'transform 120ms ease-out',
          }}
        >
          <Typography variant="h6" sx={{ textAlign: 'center', mb: 2 }}>
            {structureTitle}
          </Typography>

          <OrganizationalChart
            lineHeight="24px"
            lineColor="var(--palette-grey-500)"
            data={arbol}
            nodeClassName={layoutEditor.getNodeTreeClassName}
            nodeItem={(props) => (
              <YouthLeadershipNode
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

        {canManageLayout && (
          <LeadershipLayoutEditor
            pan={pan}
            zoom={zoom}
            chartWidth={1360}
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
        nivel="destacamento"
        nombreEntidad={destNombreCompleto}
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
        open={Boolean(leadership.traspasoPendiente)}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') return;

          leadership.cancelarTraspaso();
        }}
        title="Ya tiene un cargo"
        content={
          <>
            <strong>
              {getMemberDisplayName(leadership.traspasoPendiente?.miembro) || 'Este miembro'}
            </strong>{' '}
            ya es {leadership.traspasoPendiente?.cargoQueOcupa}. ¿Quieres quitárselo y asignarle el
            cargo de {leadership.traspasoPendiente?.node?.role || 'esta directiva'}?
          </>
        }
        action={
          <Button variant="contained" onClick={leadership.confirmarTraspaso}>
            Sí, moverlo aquí
          </Button>
        }
      />

      <ConfirmEscribiendoDialog
        open={Boolean(leadership.nodoARemover)}
        onClose={leadership.cancelarRemover}
        title="Remover miembro"
        content={
          <>
            ¿Realmente quieres remover a
            <strong>
              {' '}
              {getMemberDisplayName(leadership.getAssignedMember(leadership.nodoARemover?.id)) ||
                'este miembro'}{' '}
            </strong>
            del cargo de {leadership.nodoARemover?.role || 'la directiva'}?
          </>
        }
        onConfirm={leadership.confirmarRemover}
        palabra="Remover"
        confirmLabel="Remover"
      />
    </>
  );
}
