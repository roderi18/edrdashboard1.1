'use client';

import { usePopover } from 'minimal-shared/hooks';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { normalizeText } from 'src/utils/normalize-text';
import { canManageDirectiva } from 'src/utils/admin-role-label';
import {
  isAdminGlobal,
  isOficinaNacional,
  canManageNationalLeadership,
} from 'src/utils/org-level-access';

import { obtenerDiagramaNacionalConOficiales } from 'src/catalogs/directiva-diagrams';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { OrganizationalChart } from 'src/components/organizational-chart';
import { ConfirmDialog, ConfirmEscribiendoDialog } from 'src/components/custom-dialog';

import { OrganigramaCargando } from 'src/sections/common/organigrama-cargando';
import { useCentrarOrganigrama } from 'src/sections/common/use-centrar-organigrama';
import { LeadershipAssignDialog } from 'src/sections/common/leadership-assign-dialog';
import { useLeadershipAssignments } from 'src/sections/common/use-leadership-assignments';
import { GLOW_JERARQUIA_SX, useResaltarMiembro } from 'src/sections/common/use-resaltar-miembro';
import { OficialesEspecialesGrupo } from 'src/sections/national/leadership/oficiales-especiales-grupo';
import {
  entidadesDeDisenoDe,
  useLeadershipLayoutStorage,
} from 'src/sections/common/use-leadership-layout-storage';
import {
  LeadershipNodeAvatar,
  getMemberDisplayName,
  LEADERSHIP_NODE_SIZE_SX,
  LeadershipStructureNode,
  LeadershipMemberNameLink,
  getLeadershipNodeIdentity,
} from 'src/sections/common/leadership-node-identity';
import {
  LeadershipNodeAnchors,
  LeadershipLayoutEditor,
  getLeadershipEditGridSx,
  getLeadershipConnections,
  useLeadershipLayoutEditor,
  aplicarVinculosDelDiagrama,
  hasLeadershipLayoutOffsets,
  getLeadershipEditableNodeSx,
  LeadershipLayoutOffsetStyles,
  getLeadershipContainerWidthSx,
  LeadershipLayoutConnectorLayer,
  getLeadershipConnectorOverrideSx,
} from 'src/sections/common/leadership-layout-editor';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 1;
// x: 0 porque el centrado lo mide `useCentrarOrganigrama`; antes era un ajuste a ojo.
const DEFAULT_PAN = { x: 0, y: -6 };
const DEFAULT_CONTAINER_HEIGHT_OFFSET = -480;
const DEFAULT_NODE_OFFSETS = {
  'asambleas-de-dios': { x: 0, y: 11 },
  'capellan-nacional': { x: -440, y: 1 },
  'titulo-directiva-nacional': { x: -26, y: 0 },
};
const CONTROL_BUTTON_SIZE = 36;
const CONTROL_BUTTON_GAP = 6;
const ZOOM_PERCENT_WIDTH = CONTROL_BUTTON_SIZE * 2 + CONTROL_BUTTON_GAP;

// El arbol vive en `src/catalogs/directiva-diagrams`: es la misma fuente con la
// que el catalogo decide que cargos se pueden asignar desde la ficha del miembro.

// ----------------------------------------------------------------------

function NationalDivisionNode({ id, name, depth, avatarUrl, role, layoutEditor }) {
  const editProps = layoutEditor.getNodeEditProps({ id, name, role });
  const isRootNode = depth === undefined;

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
    >
      <LeadershipNodeAnchors editor={layoutEditor} nodeId={id} />
    </LeadershipStructureNode>
  );
}

function NationalLeadershipNode({
  id,
  name,
  depth,
  avatarUrl,
  role,
  isDivision,
  layoutEditor,
  canManage = false,
  miembroAsignado = null,
  onAsignarMiembro,
  onRemoverMiembro,
  agregarOficialEspecial,
  puedeAgregarOficialEspecial = false,
  guardandoDiseno = false,
  puedeEliminarOficialEspecial = false,
  onEliminarOficialEspecial,
  oficialesDelGrupo = [],
}) {
  const menuActions = usePopover();
  const isRootNode = depth === undefined;
  const identity = getLeadershipNodeIdentity(miembroAsignado);

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

  const editProps = layoutEditor.getNodeEditProps({ id, name: identity.displayName, role });
  const esNodoOficialEspecial = /^oficial-especial-(?:[1-9]|1\d|20)$/.test(String(id || ''));
  const esNodoComitesEspeciales = id === 'comites-especiales';

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'left-center' } }}
    >
      <MenuList onPointerDown={(event) => event.stopPropagation()}>
        {puedeAgregarOficialEspecial && (esNodoComitesEspeciales || esNodoOficialEspecial) && (
          <MenuItem
            disabled={guardandoDiseno}
            onClick={() => {
              menuActions.onClose();
              agregarOficialEspecial?.();
            }}
          >
            <Iconify icon="solar:add-circle-bold" />
            Agregar Oficial Especial
          </MenuItem>
        )}

        {canManage && !esNodoComitesEspeciales && (
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

        {canManage && !esNodoComitesEspeciales && miembroAsignado && (
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

        {role === 'Oficial Especial' &&
          puedeEliminarOficialEspecial &&
          onEliminarOficialEspecial && (
          <MenuItem
            disabled={guardandoDiseno}
            onClick={() => {
              menuActions.onClose();
              onEliminarOficialEspecial({ id, role });
            }}
            sx={{ color: 'error.main' }}
          >
            <Iconify icon="solar:trash-bin-trash-bold" />
            Eliminar Oficial Especial
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
          overflow: 'visible',
          display: 'inline-flex',
          flexDirection: 'column',
          ...getLeadershipEditableNodeSx(editProps, { applyTransform: isRootNode }),
        }}
      >
        <LeadershipNodeAnchors editor={layoutEditor} nodeId={id} />
        <IconButton
          color={menuActions.open ? 'inherit' : 'default'}
          onClick={menuActions.onOpen}
          sx={{ position: 'absolute', top: 8, right: 8 }}
        >
          <Iconify icon="eva:more-horizontal-fill" />
        </IconButton>

        {esNodoComitesEspeciales ? (
          // Un grupo, no un cargo: caras, cuántos son y "Ver más" (ver el componente).
          <OficialesEspecialesGrupo personas={oficialesDelGrupo} />
        ) : (
          <>
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
          </>
        )}

        {(esNodoOficialEspecial || esNodoComitesEspeciales) &&
          puedeAgregarOficialEspecial && (
          <Tooltip
            title={
              guardandoDiseno
                ? 'Guardando diseño…'
                : esNodoComitesEspeciales
                  ? 'Crear el primer Oficial Especial debajo de este'
                  : 'Agregar otro Oficial Especial debajo de este'
            }
          >
            <span>
              <IconButton
                aria-label="Agregar otro Oficial Especial"
                size="small"
                disabled={guardandoDiseno}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  agregarOficialEspecial?.();
                }}
                sx={{
                  mt: 1,
                  alignSelf: 'flex-start',
                  width: 28,
                  height: 28,
                  border: '1px solid',
                  borderColor: 'divider',
                  // En la tarjeta de grupo va en la esquina: debajo la hacia mas
                  // alta que sus vecinas de fila.
                  ...(esNodoComitesEspeciales && {
                    mt: 0,
                    right: 12,
                    bottom: 12,
                    position: 'absolute',
                  }),
                }}
              >
                <Iconify icon="solar:add-circle-bold" width={18} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Card>

      {renderMenuActions()}
    </>
  );
}

// ----------------------------------------------------------------------

/**
 * `historico`: la Directiva Nacional de un cuatrienio guardado, de solo lectura.
 * Ver `SectionalLeadershipView`.
 *
 * `gestionarOficialesEspeciales`: apagado cuando el organigrama se pinta embebido
 * en la pestaña Jerarquía de la lista nacional. Alli se consulta la estructura,
 * pero los Oficiales Especiales NO se tocan: ni se asignan, ni se agregan, ni se
 * eliminan. Eso se hace en la ficha del cargo, no dentro de la tarjeta de la
 * lista. El resto de cargos se siguen asignando con normalidad.
 */
export function NationalLeadershipView({
  historico = null,
  gestionarOficialesEspeciales = true,
  // Alto máximo del contenedor cuando el organigrama va embebido en la pestaña
  // Jerarquía: sin esto ocupaba toda la pantalla vertical. El ancho no se toca; se
  // navega en vertical con el arrastre de siempre.
  alturaMaxima = null,
  // Dentro de la tarjeta de la pestaña Jerarquía: el ancho extra del diseño
  // (`containerWidthOffset`) sacaba los bordes laterales fuera de la tarjeta.
  embebido = false,
  // Miembro a resaltar tras una búsqueda por nombre: su casilla brilla unos
  // segundos y se trae al centro. `resaltarToken` fuerza el efecto aunque se
  // repita el mismo nombre.
  resaltarMiembroId = null,
  resaltarToken = null,
} = {}) {
  const { user } = useAuthContext();
  // Los cargos del Consejo Ejecutivo proponen; Oficina Nacional o Administrador
  // Global resuelven. Solo el Administrador Global modifica el diseño visual.
  const canManageLeadership =
    !historico && (canManageNationalLeadership(user) || isOficinaNacional(user));
  // El diseño (el lápiz) también en una directiva anterior: solo recoloca
  // casillas y se guarda aparte (`entidadesDeDisenoDe`); los ocupantes de un
  // cuatrienio guardado siguen sin tocarse desde aquí.
  const canManageLayout = canManageDirectiva(user);
  const esAdministradorGlobal =
    isAdminGlobal(user) ||
    canManageDirectiva(user) ||
    [user?.rolNombre, user?.roleName, user?.rolLabel, user?.roleLabel]
      .map((nombre) => normalizeText(nombre))
      .includes('administrador global');
  const canManageOfficialStructure =
    !historico &&
    gestionarOficialesEspeciales &&
    (esAdministradorGlobal || isOficinaNacional(user));
  const containerRef = useRef(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const skipNextDragRef = useRef(false);
  const layoutEditor = useLeadershipLayoutEditor({
    initialNodeOffsets: DEFAULT_NODE_OFFSETS,
    initialContainerHeightOffset: DEFAULT_CONTAINER_HEIGHT_OFFSET,
    initialCustomNodeCounts: { oficialesEspeciales: 1 },
  });
  const [isDragging, setIsDragging] = useState(false);
  // La directiva nacional es unica, pero su entidad NO es la cadena vacia:
  // sus asignaciones estan guardadas bajo "nacional". Con '' se consultaba la
  // directiva "nacional_general" y el organigrama no encontraba a sus ocupantes.
  const leadership = useLeadershipAssignments({
    nivel: 'nacional',
    idEntidad: 'nacional',
    nombreEntidad: 'Directiva Nacional',
    canManage: canManageLeadership || canManageOfficialStructure,
    conDatosDeHoy: !historico,
  });
  const obtenerOcupante = historico?.obtenerOcupante ?? leadership.getAssignedMember;
  const layoutStorage = useLeadershipLayoutStorage({
    editor: layoutEditor,
    nivel: 'nacional',
    ...entidadesDeDisenoDe({ idEntidad: '', historico }),
    nombreEntidad: 'Directiva Nacional',
    canManage: canManageOfficialStructure || canManageLayout,
    defaultNodeOffsets: DEFAULT_NODE_OFFSETS,
    defaultContainerHeightOffset: DEFAULT_CONTAINER_HEIGHT_OFFSET,
    defaultCustomNodeCounts: { oficialesEspeciales: 1 },
  });
  const [pan, setPan] = useState(DEFAULT_PAN);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const idsOficialesEspeciales = useMemo(() => {
    const idsGuardados = layoutEditor.customNodeLists?.oficialesEspeciales;

    return Array.isArray(idsGuardados)
      ? idsGuardados.slice(0, 20)
      : Array.from(
          {
            length: Math.min(
              20,
              Math.max(1, Number(layoutEditor.customNodeCounts?.oficialesEspeciales) || 1)
            ),
          },
          (_, indice) => `oficial-especial-${indice + 1}`
        );
  }, [
    layoutEditor.customNodeLists?.oficialesEspeciales,
    layoutEditor.customNodeCounts?.oficialesEspeciales,
  ]);
  const cantidadOficialesEspeciales = idsOficialesEspeciales.length;
  const [oficialEspecialPendienteEliminar, setOficialEspecialPendienteEliminar] = useState(null);
  const [eliminandoOficialEspecial, setEliminandoOficialEspecial] = useState(false);
  const diagramaNacional = useMemo(
    () => obtenerDiagramaNacionalConOficiales(historico ? [] : idsOficialesEspeciales),
    [historico, idsOficialesEspeciales]
  );
  // Quienes van en la tarjeta "Oficiales Especiales": en una directiva anterior,
  // su grupo de Oficiales de la Nacional (que no tiene casillas; por eso el
  // diagrama historico va sin la cadena de Oficial Especial); hoy, los que ocupan
  // esas casillas. Sin repetir a nadie.
  const oficialesDelGrupo = useMemo(() => {
    const vistos = new Set();

    return [
      ...(historico?.oficiales || []),
      ...idsOficialesEspeciales.map((id) => obtenerOcupante(id)).filter(Boolean),
    ].filter((persona) => {
      const clave = String(persona.id || persona.idMiembros || persona.name || '');

      if (!clave || vistos.has(clave)) return false;
      vistos.add(clave);

      return true;
    });
  }, [historico, idsOficialesEspeciales, obtenerOcupante]);
  const zoomPercentage = useMemo(() => Math.round(zoom * 100), [zoom]);
  const containerMinHeight = 680 + layoutEditor.containerHeightOffset;
  // Embebido en la pestaña Jerarquía: el contenedor deja de crecer con el diagrama
  // y se queda en una ventana fija que se recorre en vertical con el arrastre.
  const sxAlturaContenedor = alturaMaxima
    ? { minHeight: alturaMaxima, maxHeight: alturaMaxima }
    : { minHeight: containerMinHeight };

  useResaltarMiembro({
    containerRef,
    diagrama: diagramaNacional,
    obtenerOcupante,
    miembroId: resaltarMiembroId,
    token: resaltarToken,
  });
  const connections = useMemo(
    () =>
      aplicarVinculosDelDiagrama(getLeadershipConnections(diagramaNacional), {
        hiddenConnections: layoutEditor.hiddenConnections,
        extraConnections: layoutEditor.extraConnections,
      }),
    [diagramaNacional, layoutEditor.hiddenConnections, layoutEditor.extraConnections]
  );
  const agregarOficialEspecial = useCallback(async () => {
    if (!canManageOfficialStructure || cantidadOficialesEspeciales >= 20 || layoutStorage.guardando) {
      return;
    }

    const siguienteId = Array.from({ length: 20 }, (_, indice) => `oficial-especial-${indice + 1}`)
      .find((id) => !idsOficialesEspeciales.includes(id));

    if (!siguienteId) return;

    const siguientesIds = [...idsOficialesEspeciales, siguienteId];
    const siguienteCantidad = siguientesIds.length;
    const siguientesConteos = {
      ...(layoutEditor.customNodeCounts || {}),
      oficialesEspeciales: siguienteCantidad,
    };
    const siguientesListas = {
      ...(layoutEditor.customNodeLists || {}),
      oficialesEspeciales: siguientesIds,
    };

    const guardado = await layoutStorage.guardar({
      customNodeCounts: siguientesConteos,
      customNodeLists: siguientesListas,
    });

    if (guardado) {
      layoutEditor.applyLayout({
        customNodeCounts: siguientesConteos,
        customNodeLists: siguientesListas,
      });
    }
  }, [
    canManageOfficialStructure,
    cantidadOficialesEspeciales,
    idsOficialesEspeciales,
    layoutEditor,
    layoutStorage,
  ]);
  const guardarEliminacionDeOficialEspecial = useCallback(
    async (id) => {
      if (layoutStorage.guardando) return false;

      const siguientesIds = idsOficialesEspeciales.filter((oficialId) => oficialId !== id);
      const conexionesDelNodo = new Set(
        getLeadershipConnections(diagramaNacional)
          .filter((conexion) => conexion.from === id || conexion.to === id)
          .map((conexion) => `${conexion.from}-${conexion.to}`)
      );
      const siguientesConteos = {
        ...(layoutEditor.customNodeCounts || {}),
        oficialesEspeciales: siguientesIds.length,
      };
      const siguientesListas = {
        ...(layoutEditor.customNodeLists || {}),
        oficialesEspeciales: siguientesIds,
      };
      const siguientesOffsets = { ...layoutEditor.nodeOffsets };
      delete siguientesOffsets[id];
      const siguientesGrupos = layoutEditor.connectionGroups
        .map((grupo) => ({
          ...grupo,
          ids: grupo.ids.filter((conexionId) => !conexionesDelNodo.has(conexionId)),
        }))
        .filter((grupo) => grupo.ids.length > 1);
      const siguientesConexionesEscondidas = layoutEditor.hiddenConnections.filter(
        (conexionId) => !conexionesDelNodo.has(conexionId)
      );
      const siguientesConexionesExtra = layoutEditor.extraConnections.filter(
        (conexion) => conexion.from !== id && conexion.to !== id
      );
      const guardado = await layoutStorage.guardar({
        customNodeCounts: siguientesConteos,
        customNodeLists: siguientesListas,
        nodeOffsets: siguientesOffsets,
        connectionGroups: siguientesGrupos,
        hiddenConnections: siguientesConexionesEscondidas,
        extraConnections: siguientesConexionesExtra,
      });

      if (guardado) {
        layoutEditor.applyLayout({
          customNodeCounts: siguientesConteos,
          customNodeLists: siguientesListas,
          nodeOffsets: siguientesOffsets,
          connectionGroups: siguientesGrupos,
          hiddenConnections: siguientesConexionesEscondidas,
          extraConnections: siguientesConexionesExtra,
        });
        layoutEditor.selectConnection(null);
        layoutEditor.limpiarSeleccionDeNodos();
      }

      return guardado;
    }, [idsOficialesEspeciales, diagramaNacional, layoutEditor, layoutStorage]
  );
  const solicitarEliminarOficialEspecial = useCallback(
    ({ id, role }) => {
      const asignado = leadership.getAssignedMember(id);

      if (asignado) {
        setOficialEspecialPendienteEliminar({ node: { id, role }, miembro: asignado });
        return;
      }

      guardarEliminacionDeOficialEspecial(id);
    },
    [guardarEliminacionDeOficialEspecial, leadership]
  );
  const confirmarEliminarOficialEspecial = useCallback(async () => {
    const pendiente = oficialEspecialPendienteEliminar;
    const idMiembro = pendiente?.miembro?.id ?? pendiente?.miembro?.idMiembros;

    if (!pendiente?.node?.id || !idMiembro || eliminandoOficialEspecial) return;

    setEliminandoOficialEspecial(true);

    try {
      const removido = await leadership.guardar({
        node: pendiente.node,
        idMiembro,
        miembro: pendiente.miembro,
        activo: false,
      });

      if (removido === true) {
        const guardado = await guardarEliminacionDeOficialEspecial(pendiente.node.id);

        if (guardado) setOficialEspecialPendienteEliminar(null);
      }
    } finally {
      setEliminandoOficialEspecial(false);
    }
  }, [
    oficialEspecialPendienteEliminar,
    eliminandoOficialEspecial,
    leadership,
    guardarEliminacionDeOficialEspecial,
  ]);
  const connectorLayerActive =
    layoutEditor.editMode ||
    Boolean(layoutEditor.arrastreDeVinculo) ||
    hasLeadershipLayoutOffsets(layoutEditor) ||
    layoutEditor.connectionGroups.length > 0 ||
    layoutEditor.hiddenConnections.length > 0 ||
    layoutEditor.extraConnections.length > 0;
  // Sin diseño o sin ocupantes todavía, el árbol no se pinta: salía con las
  // posiciones de partida y todo en "Vacante", y se recolocaba y llenaba después.
  const cargandoArbol = layoutStorage.cargando || leadership.cargando;
  // Todo el arbol centrado como un grupo (ver el hook): se suma al arrastre.
  const desplazamientoX = useCentrarOrganigrama({
    containerRef,
    pan,
    pausado: layoutEditor.editMode,
    claves: [zoom, JSON.stringify(layoutEditor.nodeOffsets), cargandoArbol, containerMinHeight, cantidadOficialesEspeciales],
  });
  const connectorWatchKey = `${layoutEditor.editMode}:${JSON.stringify(layoutEditor.connectionGroups)}:${JSON.stringify(layoutEditor.hiddenConnections)}:${JSON.stringify(layoutEditor.extraConnections)}:${pan.x + desplazamientoX}:${pan.y}:${zoom}:${containerMinHeight}:${JSON.stringify(layoutEditor.nodeOffsets)}:${cargandoArbol}`;

  useEffect(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

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
    name: 'Directiva Nacional',
    role: 'Titulo del diagrama',
  });

  return (
    <>
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
          ...sxAlturaContenedor,
          ...GLOW_JERARQUIA_SX,
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
          ...(embebido ? {} : getLeadershipContainerWidthSx(layoutEditor.containerWidthOffset)),
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
            display: cargandoArbol ? 'none' : 'flex',
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

        {cargandoArbol && <OrganigramaCargando />}

        <Box
          sx={{
            // Ni pintado ni ocupando sitio hasta tener diseño y ocupantes.
            display: cargandoArbol ? 'none' : undefined,
            '--chart-pan-x': `${pan.x + desplazamientoX}px`,
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
            {historico?.cuatrienio
              ? `Directiva Nacional · ${historico.cuatrienio}`
              : 'Directiva Nacional'}
          </Typography>

          <OrganizationalChart
            lineWidth="2px"
            lineHeight="34px"
            lineColor="var(--palette-grey-500)"
            data={diagramaNacional}
            nodeClassName={layoutEditor.getNodeTreeClassName}
            nodeItem={(props) => (
              <NationalLeadershipNode
                {...props}
                layoutEditor={layoutEditor}
                // En la pestaña Jerarquía los Oficiales Especiales no se asignan:
                // el nodo pierde su menú de gestión, pero el resto de cargos no.
                canManage={
                  canManageLeadership &&
                  !(
                    !gestionarOficialesEspeciales &&
                    /^oficial-especial-(?:[1-9]|1\d|20)$/.test(String(props.id || ''))
                  )
                }
                miembroAsignado={obtenerOcupante(props.id)}
                onAsignarMiembro={leadership.openAssign}
                onRemoverMiembro={leadership.pedirRemoverMiembro}
                agregarOficialEspecial={agregarOficialEspecial}
                puedeAgregarOficialEspecial={
                  canManageOfficialStructure &&
                  (props.id === 'comites-especiales' ||
                    props.id === `oficial-especial-${cantidadOficialesEspeciales}`) &&
                  cantidadOficialesEspeciales < 20
                }
                guardandoDiseno={layoutStorage.guardando}
                oficialesDelGrupo={oficialesDelGrupo}
                puedeEliminarOficialEspecial={canManageOfficialStructure}
                onEliminarOficialEspecial={
                  canManageOfficialStructure ? solicitarEliminarOficialEspecial : undefined
                }
              />
            )}
          />
        </Box>

        <LeadershipLayoutConnectorLayer
          active={connectorLayerActive && !cargandoArbol}
          watchKey={connectorWatchKey}
          connections={connections}
          containerRef={containerRef}
          lineWidth={2}
          connectionGroups={layoutEditor.connectionGroups}
          editMode={layoutEditor.editMode}
          selectedConnections={layoutEditor.selectedConnections}
          onSelectConnection={layoutEditor.selectConnection}
          lineasRectas
          arrastreDeVinculo={layoutEditor.arrastreDeVinculo}
        />

        <LeadershipLayoutOffsetStyles editor={layoutEditor} />

        {canManageLayout && (
          <LeadershipLayoutEditor
            pan={{ ...pan, x: pan.x + desplazamientoX }}
            zoom={zoom}
            chartWidth={1440}
            title="Directiva Nacional"
            editor={layoutEditor}
            containerMinHeight={containerMinHeight}
            onSaveLayout={layoutStorage.guardar}
            savingLayout={layoutStorage.guardando}
            mostrarMargenHorizontal
          />
        )}
      </Box>

      <LeadershipAssignDialog
        open={Boolean(leadership.selectedNode)}
        node={leadership.selectedNode}
        nivel="nacional"
        nombreEntidad="Directiva Nacional"
        options={leadership.memberOptions}
        loading={!leadership.members.length}
        value={leadership.selectedMember}
        saving={leadership.isSaving}
        yaAsignado={Boolean(leadership.getAssignedMember(leadership.selectedNode?.id))}
        onChange={leadership.setSelectedMember}
        onClose={leadership.closeAssign}
        onSubmit={leadership.asignarMiembro}
      />

      {/* Sirve en otro consejo. Se puede asignar igual, pero primero se dice de
          donde se le saca: nadie ocupa dos consejos a la vez, asi que aceptar
          aqui es retirarle el cargo anterior. */}
      <ConfirmDialog
        open={Boolean(leadership.traspasoPendiente)}
        // Un clic en el fondo NO cuenta como respuesta: este dialogo aparece
        // justo bajo el cursor que acaba de pulsar "Asignar", y el remate de ese
        // mismo clic caia en su fondo y lo cerraba sin que diera tiempo a leerlo.
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

      <ConfirmDialog
        open={Boolean(oficialEspecialPendienteEliminar)}
        onClose={() => {
          if (!eliminandoOficialEspecial) setOficialEspecialPendienteEliminar(null);
        }}
        title="Eliminar Oficial Especial"
        content={
          <>
            ¿Quieres retirar a{' '}
            <strong>
              {getMemberDisplayName(oficialEspecialPendienteEliminar?.miembro) || 'esta persona'}
            </strong>{' '}
            del cargo y eliminar este cuadro de la Directiva Nacional?
          </>
        }
        action={
          <Button
            variant="contained"
            color="error"
            disabled={eliminandoOficialEspecial || layoutStorage.guardando}
            onClick={confirmarEliminarOficialEspecial}
          >
            Eliminar
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
