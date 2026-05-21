'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import GlobalStyles from '@mui/material/GlobalStyles';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const EMPTY_OFFSET = { x: 0, y: 0 };

const getSafeId = (id) => String(id || 'node').replace(/[^a-zA-Z0-9_-]/g, '-');
const hasOffsetValue = (offset) => Boolean(offset?.x || offset?.y);

export const getLeadershipNodeKey = (node) =>
  node?.id ||
  [
    node?.asignacionOrganigrama?.cargo,
    node?.asignacionOrganigrama?.division || 'general',
    node?.asignacionOrganigrama?.orden || 1,
  ]
    .filter(Boolean)
    .join('|') ||
  node?.role ||
  node?.name;

export function useLeadershipLayoutEditor({
  initialNodeOffsets = {},
  initialContainerHeightOffset = 0,
} = {}) {
  const nodeDragRef = useRef(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeOffsets, setNodeOffsets] = useState(initialNodeOffsets);
  const [containerHeightOffset, setContainerHeightOffset] = useState(initialContainerHeightOffset);

  const toggleEditMode = useCallback(() => {
    setEditMode((currentValue) => !currentValue);
  }, []);

  const handleNodePointerDown = useCallback(
    (event, node) => {
      const interactiveElement = event.target.closest?.(
        'button, a, input, textarea, select, [role="button"]'
      );

      if (!editMode || event.button !== 0 || interactiveElement) {
        return;
      }

      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);

      const currentOffset = nodeOffsets[node.id] ?? EMPTY_OFFSET;

      nodeDragRef.current = {
        id: node.id,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: currentOffset.x,
        offsetY: currentOffset.y,
      };

      setSelectedNode({
        id: node.id,
        name: node.name,
        role: node.role,
      });
    },
    [editMode, nodeOffsets]
  );

  const handleNodePointerMove = useCallback((event) => {
    const dragState = nodeDragRef.current;

    if (!dragState) {
      return;
    }

    event.stopPropagation();

    const nextOffset = {
      x: Math.round(dragState.offsetX + event.clientX - dragState.startX),
      y: Math.round(dragState.offsetY + event.clientY - dragState.startY),
    };

    setNodeOffsets((currentOffsets) => ({
      ...currentOffsets,
      [dragState.id]: nextOffset,
    }));
  }, []);

  const handleNodePointerUp = useCallback((event) => {
    if (nodeDragRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    nodeDragRef.current = null;
  }, []);

  const getNodeEditProps = useCallback(
    (node) => {
      const offset = nodeOffsets[node.id] ?? EMPTY_OFFSET;

      return {
        offset,
        editMode,
        selected: selectedNode?.id === node.id,
        onPointerUp: handleNodePointerUp,
        onPointerMove: handleNodePointerMove,
        onPointerCancel: handleNodePointerUp,
        onPointerDown: (event) => handleNodePointerDown(event, node),
      };
    },
    [
      editMode,
      nodeOffsets,
      selectedNode?.id,
      handleNodePointerUp,
      handleNodePointerMove,
      handleNodePointerDown,
    ]
  );

  const getNodeTreeClassName = useCallback(
    (node) => `leadership-edit-node-${getSafeId(node.id)}`,
    []
  );

  const resizeContainer = useCallback((delta) => {
    setContainerHeightOffset((currentValue) => Math.max(-520, currentValue + delta));
  }, []);

  return useMemo(
    () => ({
      editMode,
      selectedNode,
      nodeOffsets,
      containerHeightOffset,
      resizeContainer,
      toggleEditMode,
      getNodeEditProps,
      getNodeTreeClassName,
    }),
    [
      editMode,
      selectedNode,
      nodeOffsets,
      resizeContainer,
      toggleEditMode,
      getNodeEditProps,
      getNodeTreeClassName,
      containerHeightOffset,
    ]
  );
}

export function getLeadershipEditGridSx(editMode) {
  if (!editMode) {
    return {};
  }

  return {
    '&::before, &::after': {
      content: '""',
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: 1,
      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.35),
    },
    '&::before': {
      top: 0,
      bottom: 0,
      left: '50%',
      width: 2,
    },
    '&::after': {
      left: 0,
      right: 0,
      top: '50%',
      height: 2,
    },
    backgroundImage: (theme) =>
      [
        `linear-gradient(${alpha(theme.palette.text.primary, 0.08)} 1px, transparent 1px)`,
        `linear-gradient(90deg, ${alpha(theme.palette.text.primary, 0.08)} 1px, transparent 1px)`,
      ].join(', '),
    backgroundSize: '24px 24px',
  };
}

export function getLeadershipEditableNodeSx(
  { editMode, selected, offset },
  { applyTransform = true } = {}
) {
  const translate = offset ? `translate(${offset.x}px, ${offset.y}px)` : 'translate(0, 0)';

  return {
    zIndex: selected ? 3 : 1,
    transform: applyTransform ? translate : undefined,
    cursor: editMode ? 'move' : 'default',
    outline: selected ? '2px dashed' : 'none',
    outlineColor: 'primary.main',
    transition: editMode ? 'none' : 'box-shadow 120ms ease, outline-color 120ms ease',
  };
}

export function getLeadershipConnections(data) {
  const roots = Array.isArray(data) ? data : [data];
  const connections = [];

  const walkNode = (node) => {
    const children = Array.isArray(node?.children) ? node.children : [];

    children.forEach((child) => {
      connections.push({ from: getLeadershipNodeKey(node), to: getLeadershipNodeKey(child) });
      walkNode(child);
    });
  };

  roots.forEach(walkNode);

  return connections;
}

export function hasLeadershipLayoutOffsets(editor) {
  return Object.values(editor.nodeOffsets).some(hasOffsetValue);
}

export function getLeadershipConnectorOverrideSx(active) {
  if (!active) {
    return {};
  }

  return {
    '& ul::before, & li::before, & li::after': {
      borderColor: 'transparent !important',
    },
  };
}

export function LeadershipLayoutOffsetStyles({ editor, lineStyles }) {
  const styles = useMemo(() => {
    const offsetStyles = {};

    Object.entries(editor.nodeOffsets).forEach(([id, offset]) => {
      offsetStyles[`.${editor.getNodeTreeClassName({ id })}`] = {
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        zIndex: editor.selectedNode?.id === id ? 3 : 1,
      };
    });

    return {
      ...offsetStyles,
      ...lineStyles,
    };
  }, [editor, lineStyles]);

  return <GlobalStyles styles={styles} />;
}

function buildConnectorPath({ startX, startY, endX, endY }) {
  const middleY = startY + (endY - startY) / 2;
  const direction = endX >= startX ? 1 : -1;
  const radius = Math.max(
    0,
    Math.min(16, Math.abs(endX - startX) / 2, Math.abs(endY - startY) / 2)
  );

  if (!radius) {
    return `M ${startX} ${startY} V ${middleY} H ${endX} V ${endY}`;
  }

  return [
    `M ${startX} ${startY}`,
    `V ${middleY - radius}`,
    `Q ${startX} ${middleY} ${startX + direction * radius} ${middleY}`,
    `H ${endX - direction * radius}`,
    `Q ${endX} ${middleY} ${endX} ${middleY + radius}`,
    `V ${endY}`,
  ].join(' ');
}

export function LeadershipLayoutConnectorLayer({
  active,
  watchKey,
  containerRef,
  connections = [],
  lineWidth = 2,
}) {
  const [paths, setPaths] = useState([]);

  useEffect(() => {
    const updatePaths = () => {
      const container = containerRef.current;

      if (!active || !container || !connections.length) {
        setPaths([]);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const nodeElements = new Map(
        Array.from(container.querySelectorAll('[data-leadership-node-id]')).map((element) => [
          String(element.dataset.leadershipNodeId),
          element,
        ])
      );

      const nextPaths = connections
        .map((connection) => {
          const fromElement = nodeElements.get(String(connection.from));
          const toElement = nodeElements.get(String(connection.to));

          if (!fromElement || !toElement) {
            return null;
          }

          const fromRect = fromElement.getBoundingClientRect();
          const toRect = toElement.getBoundingClientRect();
          const startX = fromRect.left - containerRect.left + fromRect.width / 2;
          const startY = fromRect.bottom - containerRect.top;
          const endX = toRect.left - containerRect.left + toRect.width / 2;
          const endY = toRect.top - containerRect.top;

          return {
            id: `${connection.from}-${connection.to}`,
            d: buildConnectorPath({ startX, startY, endX, endY }),
          };
        })
        .filter(Boolean);

      setPaths(nextPaths);
    };

    const frame = window.requestAnimationFrame(updatePaths);

    window.addEventListener('resize', updatePaths);
    window.addEventListener('scroll', updatePaths, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePaths);
      window.removeEventListener('scroll', updatePaths, true);
    };
  }, [active, connections, watchKey, containerRef]);

  if (!active || !paths.length) {
    return null;
  }

  return (
    <Box
      component="svg"
      data-pdf-hidden="true"
      sx={{
        inset: 0,
        zIndex: 1,
        width: 1,
        height: 1,
        position: 'absolute',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {paths.map((path) => (
        <Box
          key={path.id}
          d={path.d}
          component="path"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={lineWidth}
          stroke="var(--palette-grey-500)"
        />
      ))}
    </Box>
  );
}

export function LeadershipLayoutEditor({ editor, title, pan, zoom, chartWidth, containerMinHeight }) {
  const selectedOffset = editor.selectedNode
    ? (editor.nodeOffsets[editor.selectedNode.id] ?? EMPTY_OFFSET)
    : EMPTY_OFFSET;

  return (
    <Box
      data-pdf-hidden="true"
      onPointerDown={(event) => event.stopPropagation()}
      sx={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        zIndex: 4,
      }}
    >
      {editor.editMode && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            mb: 1,
            width: 300,
            maxWidth: 'calc(100vw - 48px)',
            bgcolor: 'background.paper',
            boxShadow: 6,
          }}
        >
          <Stack spacing={0.75}>
            <Typography variant="subtitle2">Edicion visual</Typography>

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Titulo: {title}
            </Typography>

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Contenedor: alto {containerMinHeight}px / ancho grafico {chartWidth}px
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                Tamano del contenedor
              </Typography>

              <IconButton
                size="small"
                aria-label="Reducir alto del contenedor"
                onClick={() => editor.resizeContainer(-40)}
                sx={{ width: 28, height: 28, border: '1px solid', borderColor: 'divider' }}
              >
                <Iconify width={14} icon="solar:minimize-square-3-bold" />
              </IconButton>

              <IconButton
                size="small"
                aria-label="Aumentar alto del contenedor"
                onClick={() => editor.resizeContainer(40)}
                sx={{ width: 28, height: 28, border: '1px solid', borderColor: 'divider' }}
              >
                <Iconify width={14} icon="solar:add-square-bold" />
              </IconButton>
            </Stack>

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Vista: x {Math.round(pan.x)}px, y {Math.round(pan.y)}px, zoom{' '}
              {Math.round(zoom * 100)}%
            </Typography>

            {editor.selectedNode ? (
              <Stack spacing={0.25}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Nodo: {editor.selectedNode.id}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Nombre: {editor.selectedNode.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Posicion: {editor.selectedNode.role}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Movimiento: x {selectedOffset.x}px, y {selectedOffset.y}px
                </Typography>
              </Stack>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Selecciona y arrastra un nodo para ver su movimiento.
              </Typography>
            )}
          </Stack>
        </Paper>
      )}

      <Tooltip title={editor.editMode ? 'Cerrar edicion visual' : 'Editar layout visual'}>
        <IconButton
          size="small"
          aria-label="Editar layout visual"
          onClick={editor.toggleEditMode}
          sx={{
            ml: 'auto',
            width: 42,
            height: 42,
            display: 'flex',
            bgcolor: editor.editMode ? 'primary.main' : 'background.paper',
            color: editor.editMode ? 'primary.contrastText' : 'text.primary',
            border: '1px solid',
            borderColor: editor.editMode ? 'primary.main' : 'divider',
            boxShadow: 3,
            '&:hover': {
              bgcolor: editor.editMode ? 'primary.dark' : 'background.paper',
            },
          }}
        >
          <Iconify width={20} icon="solar:pen-bold" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
