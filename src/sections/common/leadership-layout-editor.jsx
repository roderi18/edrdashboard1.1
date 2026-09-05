'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
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

// Acepta la forma vieja —lista de listas— y la nueva. Asi un diseno guardado
// antes de que existiera la orientacion se sigue leyendo, como barra horizontal.
function normalizarGrupos(grupos) {
  return (Array.isArray(grupos) ? grupos : [])
    .map((grupo) => {
      const ids = Array.isArray(grupo) ? grupo : grupo?.ids;
      const limpios = (Array.isArray(ids) ? ids : []).map((id) => String(id || '')).filter(Boolean);

      return {
        ids: [...new Set(limpios)],
        orientacion: grupo?.orientacion === 'vertical' ? 'vertical' : 'horizontal',
      };
    })
    .filter((grupo) => grupo.ids.length > 1);
}

// Pares { from, to } limpios y sin repetir.
function normalizarVinculos(vinculos) {
  const vistos = new Set();

  return (Array.isArray(vinculos) ? vinculos : [])
    .map((vinculo) => ({
      from: String(vinculo?.from || ''),
      to: String(vinculo?.to || ''),
    }))
    .filter((vinculo) => {
      const clave = `${vinculo.from}-${vinculo.to}`;

      if (!vinculo.from || !vinculo.to || vinculo.from === vinculo.to || vistos.has(clave)) {
        return false;
      }

      vistos.add(clave);

      return true;
    });
}

export function useLeadershipLayoutEditor({
  initialNodeOffsets = {},
  initialContainerHeightOffset = 0,
  initialContainerWidthOffset = 0,
  initialConnectionGroups = [],
  initialHiddenConnections = [],
  initialExtraConnections = [],
} = {}) {
  const nodeDragRef = useRef(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeOffsets, setNodeOffsets] = useState(initialNodeOffsets);
  const [containerHeightOffset, setContainerHeightOffset] = useState(initialContainerHeightOffset);
  // Cuanto se ensancha el cuadro POR FUERA de la columna de la pagina. Un
  // organigrama ancho se salia por los lados y las cajas de los extremos
  // quedaban cortadas; esto le da sitio sin encoger la letra.
  const [containerWidthOffset, setContainerWidthOffset] = useState(initialContainerWidthOffset);
  // LINEAS UNIDAS. Cada grupo es un puñado de conexiones que comparten una barra
  // y se leen como un solo trazo. La barra puede ir en horizontal —codo comun,
  // del que bajan varias— o en VERTICAL, que es como el documento dibuja el
  // equipo del Guia Mayor: una barra a la izquierda y salidas laterales.
  //
  // Cada grupo es { ids, orientacion }. El ORDEN de `ids` manda: es el que decide
  // cual queda encima de cual cuando la barra es vertical.
  const [connectionGroups, setConnectionGroups] = useState(() =>
    normalizarGrupos(initialConnectionGroups)
  );
  // Seleccion MULTIPLE: se van marcando lineas y despues se pulsa "Unir".
  const [selectedConnections, setSelectedConnections] = useState([]);
  // LINEAS QUITADAS. El arbol dice de quien cuelga cada cargo, pero el cuadro no
  // siempre se dibuja asi: a veces una casilla se cuelga de otra distinta. Estas
  // dejan de pintarse.
  const [hiddenConnections, setHiddenConnections] = useState(() =>
    [...new Set((initialHiddenConnections || []).map((id) => String(id || '')).filter(Boolean))]
  );
  // LINEAS PUESTAS A MANO: las que se dibujan entre dos casillas que el arbol no
  // relaciona. Solo cambian el DIBUJO; los cargos y sus asignaciones no se tocan.
  const [extraConnections, setExtraConnections] = useState(() =>
    normalizarVinculos(initialExtraConnections)
  );
  // Primer nodo de un vinculo a mano, esperando al segundo.
  const [origenVinculo, setOrigenVinculo] = useState(null);

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

  // No baja de 0: en negativo el cuadro seria mas estrecho que su columna, que
  // es justo lo contrario de lo que se busca.
  const resizeContainerWidth = useCallback((delta) => {
    setContainerWidthOffset((currentValue) => Math.max(0, currentValue + delta));
  }, []);

  // Pulsar una linea la marca o la desmarca. Unir es un boton aparte: asi se
  // juntan tantas como haga falta de una vez, y pulsar por error no deshace nada.
  const selectConnection = useCallback((id) => {
    if (!id) {
      setSelectedConnections([]);
      return;
    }

    setSelectedConnections((actuales) =>
      actuales.includes(id) ? actuales.filter((clave) => clave !== id) : [...actuales, id]
    );
  }, []);

  const unirSeleccionadas = useCallback(
    (orientacion = 'horizontal') => {
      setConnectionGroups((grupos) => {
        if (selectedConnections.length < 2) return grupos;

        // Si alguna de las marcadas ya iba con otras, todo se junta: unir A con B
        // cuando B ya iba con C deja las tres en la misma barra.
        const tocados = grupos.filter((grupo) =>
          grupo.ids.some((id) => selectedConnections.includes(id))
        );
        const resto = grupos.filter((grupo) => !tocados.includes(grupo));
        // El orden de marcado manda: es el que decide cual va encima.
        const ids = [
          ...new Set([...tocados.flatMap((grupo) => grupo.ids), ...selectedConnections]),
        ];

        return [...resto, { ids, orientacion }];
      });

      setSelectedConnections([]);
    },
    [selectedConnections]
  );

  const separarConexion = useCallback((id) => {
    if (!id) return;

    setConnectionGroups((grupos) =>
      grupos
        .map((grupo) => ({ ...grupo, ids: grupo.ids.filter((clave) => clave !== id) }))
        // Un grupo de una sola linea ya no es una union.
        .filter((grupo) => grupo.ids.length > 1)
    );
    setSelectedConnections((actuales) => actuales.filter((clave) => clave !== id));
  }, []);

  const separarGrupoDe = useCallback((id) => {
    if (!id) return;

    setConnectionGroups((grupos) => grupos.filter((grupo) => !grupo.ids.includes(id)));
    setSelectedConnections([]);
  }, []);

  const grupoDeConexion = useCallback(
    (id) => connectionGroups.find((grupo) => grupo.ids.includes(id)) || null,
    [connectionGroups]
  );

  // Sube o baja una linea dentro de su barra. En vertical ese orden es el de
  // arriba abajo, asi que es lo que decide cual queda encima.
  const moverEnGrupo = useCallback((id, direccion) => {
    setConnectionGroups((grupos) =>
      grupos.map((grupo) => {
        const indice = grupo.ids.indexOf(id);
        const destino = indice + direccion;

        if (indice === -1 || destino < 0 || destino >= grupo.ids.length) return grupo;

        const ids = [...grupo.ids];

        [ids[indice], ids[destino]] = [ids[destino], ids[indice]];

        return { ...grupo, ids };
      })
    );
  }, []);

  // Quitar una linea del cuadro. Sale tambien de cualquier barra en la que
  // estuviera: una linea que no se dibuja no puede estar unida a otras.
  const desvincularConexion = useCallback((id) => {
    if (!id) return;

    setHiddenConnections((actuales) =>
      actuales.includes(id) ? actuales : [...actuales, id]
    );
    setConnectionGroups((grupos) =>
      grupos
        .map((grupo) => ({ ...grupo, ids: grupo.ids.filter((clave) => clave !== id) }))
        .filter((grupo) => grupo.ids.length > 1)
    );
    setSelectedConnections((actuales) => actuales.filter((clave) => clave !== id));
  }, []);

  const revincularConexion = useCallback((id) => {
    setHiddenConnections((actuales) => actuales.filter((clave) => clave !== id));
  }, []);

  const quitarVinculoAMano = useCallback((from, to) => {
    setExtraConnections((actuales) =>
      actuales.filter((vinculo) => !(vinculo.from === from && vinculo.to === to))
    );
  }, []);

  // Vincular dos casillas va en dos pasos: se marca el origen y despues el
  // destino. Marcar el mismo dos veces lo cancela.
  const marcarExtremoDeVinculo = useCallback((nodeId) => {
    if (!nodeId) {
      setOrigenVinculo(null);
      return;
    }

    setOrigenVinculo((origen) => {
      if (!origen) return nodeId;
      if (origen === nodeId) return null;

      setExtraConnections((actuales) =>
        normalizarVinculos([...actuales, { from: origen, to: nodeId }])
      );

      return null;
    });
  }, []);

  const cambiarOrientacionDe = useCallback((id, orientacion) => {
    setConnectionGroups((grupos) =>
      grupos.map((grupo) => (grupo.ids.includes(id) ? { ...grupo, orientacion } : grupo))
    );
  }, []);

  // Hidrata el diagrama con el diseno guardado en Firestore.
  const applyLayout = useCallback(
    ({
      nodeOffsets: offsets,
      containerHeightOffset: heightOffset,
      containerWidthOffset: widthOffset,
      connectionGroups: grupos,
      hiddenConnections: ocultas,
      extraConnections: extras,
    } = {}) => {
      if (offsets && typeof offsets === 'object') {
        setNodeOffsets(offsets);
      }

      if (Number.isFinite(Number(heightOffset))) {
        setContainerHeightOffset(Number(heightOffset));
      }

      if (Number.isFinite(Number(widthOffset))) {
        setContainerWidthOffset(Number(widthOffset));
      }

      if (Array.isArray(grupos)) {
        setConnectionGroups(normalizarGrupos(grupos));
      }

      if (Array.isArray(ocultas)) {
        setHiddenConnections([...new Set(ocultas.map((id) => String(id || '')).filter(Boolean))]);
      }

      if (Array.isArray(extras)) {
        setExtraConnections(normalizarVinculos(extras));
      }
    },
    []
  );

  return useMemo(
    () => ({
      editMode,
      selectedNode,
      nodeOffsets,
      containerHeightOffset,
      containerWidthOffset,
      connectionGroups,
      selectedConnections,
      hiddenConnections,
      extraConnections,
      origenVinculo,
      applyLayout,
      resizeContainer,
      resizeContainerWidth,
      selectConnection,
      unirSeleccionadas,
      separarConexion,
      separarGrupoDe,
      grupoDeConexion,
      moverEnGrupo,
      cambiarOrientacionDe,
      desvincularConexion,
      revincularConexion,
      quitarVinculoAMano,
      marcarExtremoDeVinculo,
      toggleEditMode,
      getNodeEditProps,
      getNodeTreeClassName,
    }),
    [
      editMode,
      selectedNode,
      nodeOffsets,
      applyLayout,
      resizeContainer,
      toggleEditMode,
      getNodeEditProps,
      getNodeTreeClassName,
      containerHeightOffset,
      containerWidthOffset,
      resizeContainerWidth,
      connectionGroups,
      selectedConnections,
      selectConnection,
      unirSeleccionadas,
      separarConexion,
      separarGrupoDe,
      grupoDeConexion,
      moverEnGrupo,
      cambiarOrientacionDe,
      hiddenConnections,
      extraConnections,
      origenVinculo,
      desvincularConexion,
      revincularConexion,
      quitarVinculoAMano,
      marcarExtremoDeVinculo,
    ]
  );
}

// El ensanche, listo para el `sx` del contenedor: crece hacia los dos lados por
// igual, saliendose de la columna de la pagina en vez de estrecharla.
export function getLeadershipContainerWidthSx(containerWidthOffset = 0) {
  const margen = Number(containerWidthOffset) || 0;

  if (margen <= 0) return {};

  return {
    width: `calc(100% + ${margen}px)`,
    mx: `${-margen / 2}px`,
    maxWidth: 'none',
  };
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

// Las lineas nativas del arbol solo se apagan cuando la capa SVG ya esta
// dibujada. Antes se apagaban en cuanto habia desplazamientos, asi que entre el
// primer render y el calculo de las rutas el diagrama se quedaba SIN lineas: solo
// aparecian al arrastrar el organigrama o hacer scroll, que es lo que forzaba el
// recalculo. Si el navegador no entiende :has(), el selector se ignora y se
// quedan las nativas — nunca ninguna.
export function getLeadershipConnectorOverrideSx(active) {
  if (!active) {
    return {};
  }

  const conCapaDibujada = '&:has([data-leadership-connectors])';

  return {
    [`${conCapaDibujada} ul::before, ${conCapaDibujada} li::before, ${conCapaDibujada} li::after`]:
      {
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

// `barraY` es la altura de la barra horizontal por la que pasa el codo. Si no se
// dice, cada linea usa su propio punto medio —que es lo que hace que dos lineas
// entre las mismas alturas se dibujen por separado—; pasandola, varias lineas
// comparten barra y se leen como un solo trazo.
function buildConnectorPath({ startX, startY, endX, endY, barraY }) {
  const middleY = Number.isFinite(barraY) ? barraY : startY + (endY - startY) / 2;
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

// BARRA VERTICAL: un tronco a la izquierda del que salen ramas hacia cada
// tarjeta, entrando por su costado. Es como el documento dibuja el equipo del
// Guia Mayor —Supervisor, Historiador y Capellan colgando de la misma barra— y
// no se consigue con el codo horizontal, que entra siempre por arriba.
//
// La PRIMERA rama ademas baja desde el padre hasta la barra; las demas salen ya
// de ella, para no repintar el mismo tronco una vez por rama.
function buildRailPath({ startX, startY, railX, entryX, entryY, esPrimera }) {
  const rama = `M ${railX} ${entryY} H ${entryX}`;

  if (!esPrimera) return rama;

  return `M ${startX} ${startY} V ${entryY} H ${entryX}`;
}

// LAS LINEAS QUE DE VERDAD SE DIBUJAN: las del arbol, menos las quitadas, mas
// las puestas a mano. El arbol sigue siendo la verdad de quien depende de quien;
// esto solo cambia el dibujo.
export function aplicarVinculosDelDiagrama(
  connections = [],
  { hiddenConnections = [], extraConnections = [] } = {}
) {
  const ocultas = new Set(hiddenConnections);
  const delArbol = connections.filter(
    (connection) => !ocultas.has(`${connection.from}-${connection.to}`)
  );

  return [...delArbol, ...extraConnections];
}

export function LeadershipLayoutConnectorLayer({
  active,
  watchKey,
  containerRef,
  connections = [],
  lineWidth = 2,
  // Lineas unidas: cada grupo comparte la barra del codo y se lee como un trazo.
  connectionGroups = [],
  // Con el lapiz abierto las lineas se pueden pulsar para unirlas.
  editMode = false,
  selectedConnections = [],
  onSelectConnection,
}) {
  const [paths, setPaths] = useState([]);

  useEffect(() => {
    const mismasRutas = (anteriores, siguientes) =>
      anteriores.length === siguientes.length &&
      anteriores.every((ruta, indice) => ruta.d === siguientes[indice].d);

    const updatePaths = () => {
      const container = containerRef.current;

      if (!active || !container || !connections.length) {
        setPaths((actuales) => (actuales.length ? [] : actuales));
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const nodeElements = new Map(
        Array.from(container.querySelectorAll('[data-leadership-node-id]')).map((element) => [
          String(element.dataset.leadershipNodeId),
          element,
        ])
      );

      const medidas = connections
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
            startX,
            startY,
            endX,
            endY,
            // Para la barra vertical hace falta el costado de la tarjeta, no su
            // borde de arriba.
            leftX: toRect.left - containerRect.left,
            rightX: toRect.right - containerRect.left,
            midY: toRect.top - containerRect.top + toRect.height / 2,
          };
        })
        .filter(Boolean);

      const medidaPorId = new Map(medidas.map((medida) => [medida.id, medida]));
      // Lo que cada linea unida tiene que dibujar, ya resuelto por su grupo.
      const trazoDeGrupo = new Map();

      connectionGroups.forEach((grupo) => {
        // En el orden del grupo, que es el que el usuario decide con las flechas.
        const delGrupo = grupo.ids.map((id) => medidaPorId.get(id)).filter(Boolean);

        if (delGrupo.length < 2) return;

        if (grupo.orientacion === 'vertical') {
          // La barra se planta un poco a la izquierda de la tarjeta mas a la
          // izquierda, y cada rama entra por el costado.
          const railX = Math.min(...delGrupo.map((medida) => medida.leftX)) - 28;

          delGrupo.forEach((medida, indice) => {
            trazoDeGrupo.set(medida.id, {
              d: buildRailPath({
                startX: medida.startX,
                startY: medida.startY,
                railX,
                entryX: medida.leftX,
                entryY: medida.midY,
                esPrimera: indice === 0,
              }),
              // El tronco de la primera va de su salida hasta la ultima rama.
              tronco:
                indice === 0
                  ? {
                      x: railX,
                      desde: delGrupo[0].midY,
                      hasta: delGrupo[delGrupo.length - 1].midY,
                    }
                  : null,
            });
          });

          return;
        }

        // Barra HORIZONTAL: el codo comun se pone donde la linea mas alta, asi
        // sale pegada al padre en vez de cruzar las tarjetas a media altura.
        const barraY = Math.min(
          ...delGrupo.map((medida) => medida.startY + (medida.endY - medida.startY) / 2)
        );

        delGrupo.forEach((medida) => {
          trazoDeGrupo.set(medida.id, {
            d: buildConnectorPath({ ...medida, barraY }),
            tronco: null,
          });
        });
      });

      const nextPaths = medidas.map((medida) => {
        const unida = trazoDeGrupo.get(medida.id);

        return {
          id: medida.id,
          unida: Boolean(unida),
          d: unida ? unida.d : buildConnectorPath(medida),
          tronco: unida?.tronco ?? null,
        };
      });

      setPaths((actuales) => (mismasRutas(actuales, nextPaths) ? actuales : nextPaths));
    };

    let frame = 0;
    let temporizador = 0;

    const ejecutar = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(temporizador);
      updatePaths();
    };

    const programarActualizacion = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(temporizador);
      // Dos fotogramas: en el primero el arbol todavia puede estar colocandose
      // (estilos de los desplazamientos, tipografia, tarjetas que crecen cuando
      // llega el nombre del ocupante) y las medidas saldrian de un layout a
      // medio hacer.
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(ejecutar);
      });
      // El navegador NO ejecuta requestAnimationFrame mientras la pestaña esta
      // en segundo plano. Sin este respaldo, un organigrama que se carga en una
      // pestaña de fondo se queda sin lineas hasta que el usuario interactua.
      temporizador = window.setTimeout(ejecutar, 120);
    };

    programarActualizacion();

    const container = containerRef.current;
    // El contenido del organigrama llega despues que el diagrama: los nombres de
    // los ocupantes se cargan de Firestore y cambian el ancho de las tarjetas. Sin
    // observar esos cambios, las lineas se quedaban con las medidas del primer
    // render.
    const resizeObserver = new ResizeObserver(programarActualizacion);
    // Las mutaciones de la propia capa SVG se ignoran: dibujar las rutas
    // provocaria otro recalculo y este se llamaria a si mismo sin parar.
    const esDeLaCapa = (nodo) => {
      const elemento = nodo?.nodeType === 1 ? nodo : nodo?.parentElement;

      return Boolean(elemento?.closest?.('[data-leadership-connectors]'));
    };
    const mutationObserver = new MutationObserver((mutaciones) => {
      if (mutaciones.some((mutacion) => !esDeLaCapa(mutacion.target))) {
        programarActualizacion();
      }
    });

    if (container) {
      resizeObserver.observe(container);
      container
        .querySelectorAll('[data-leadership-node-id]')
        .forEach((nodo) => resizeObserver.observe(nodo));
      mutationObserver.observe(container, { subtree: true, childList: true, characterData: true });
    }

    window.addEventListener('resize', programarActualizacion);
    window.addEventListener('scroll', programarActualizacion, true);
    // Las tipografias cambian las medidas al terminar de cargar.
    document.fonts?.ready?.then(programarActualizacion).catch(() => {});

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(temporizador);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', programarActualizacion);
      window.removeEventListener('scroll', programarActualizacion, true);
    };
  }, [active, connections, watchKey, containerRef, connectionGroups]);

  if (!active || !paths.length) {
    return null;
  }

  return (
    <Box
      component="svg"
      data-pdf-hidden="true"
      data-leadership-connectors="true"
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
      {paths.map((path) => {
        const seleccionada = selectedConnections.includes(path.id);

        return (
          <Box component="g" key={path.id}>
            {/* El tronco de la barra vertical: se dibuja una sola vez, con la
                primera rama del grupo. */}
            {path.tronco && (
              <Box
                component="line"
                x1={path.tronco.x}
                y1={path.tronco.desde}
                x2={path.tronco.x}
                y2={path.tronco.hasta}
                strokeLinecap="round"
                strokeWidth={seleccionada ? lineWidth + 1.5 : lineWidth}
                stroke={
                  seleccionada ? 'var(--palette-primary-main)' : 'var(--palette-grey-600)'
                }
              />
            )}

            <Box
              d={path.d}
              component="path"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={seleccionada ? lineWidth + 1.5 : lineWidth}
              stroke={
                seleccionada
                  ? 'var(--palette-primary-main)'
                  : path.unida
                    ? 'var(--palette-grey-600)'
                    : 'var(--palette-grey-500)'
              }
            />

            {/* Una copia gruesa e invisible: el trazo real mide dos pixeles y
                acertarle con el raton seria una loteria. Solo existe con el
                lapiz abierto, para no robarle el arrastre al organigrama. */}
            {editMode && (
              <Box
                d={path.d}
                component="path"
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                sx={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                onPointerDown={(event) => {
                  // Sin esto, pulsar la linea empieza a arrastrar el cuadro.
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectConnection?.(path.id);
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export function LeadershipLayoutEditor({
  editor,
  title,
  pan,
  zoom,
  chartWidth,
  containerMinHeight,
  onSaveLayout,
  savingLayout = false,
  // Solo lo pide el organigrama cuyo cuadro es mas ancho que su columna.
  mostrarMargenHorizontal = false,
}) {
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
              {mostrarMargenHorizontal ? ` / margen ${editor.containerWidthOffset}px` : ''}
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

            {/* Solo donde el cuadro es mas ancho que su columna. En los demas
                organigramas no hace falta y seria un boton sin efecto. */}
            {mostrarMargenHorizontal && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                  Margen horizontal
                </Typography>

                <IconButton
                  size="small"
                  aria-label="Reducir margen horizontal"
                  onClick={() => editor.resizeContainerWidth(-80)}
                  disabled={!editor.containerWidthOffset}
                  sx={{ width: 28, height: 28, border: '1px solid', borderColor: 'divider' }}
                >
                  <Iconify width={14} icon="solar:arrow-to-top-right-bold" />
                </IconButton>

                <IconButton
                  size="small"
                  aria-label="Aumentar margen horizontal"
                  onClick={() => editor.resizeContainerWidth(80)}
                  sx={{ width: 28, height: 28, border: '1px solid', borderColor: 'divider' }}
                >
                  <Iconify width={14} icon="solar:full-screen-square-bold" />
                </IconButton>
              </Stack>
            )}

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Vista: x {Math.round(pan.x)}px, y {Math.round(pan.y)}px, zoom{' '}
              {Math.round(zoom * 100)}%
            </Typography>

            {/* UNIR LINEAS. Se marcan las que se quieran y se pulsa el boton;
                el orden en que se marcan es el que decide cual queda encima
                cuando la barra es vertical. */}
            <Stack spacing={0.5}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                Lineas
                {editor.connectionGroups.length ? ` · ${editor.connectionGroups.length} unidas` : ''}
              </Typography>

              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {editor.selectedConnections.length
                  ? `${editor.selectedConnections.length} marcada(s). El orden de marcado manda.`
                  : 'Pulsa las lineas que quieras unir.'}
              </Typography>

              <Stack direction="row" spacing={0.5}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={editor.selectedConnections.length < 2}
                  onClick={() => editor.unirSeleccionadas('vertical')}
                >
                  Unir en barra
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  disabled={editor.selectedConnections.length < 2}
                  onClick={() => editor.unirSeleccionadas('horizontal')}
                >
                  En codo
                </Button>

                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  disabled={!editor.selectedConnections.length}
                  onClick={() => editor.selectConnection(null)}
                >
                  Quitar
                </Button>
              </Stack>

              {/* Con UNA sola marcada se puede ordenar y deshacer su union. */}
              {editor.selectedConnections.length === 1 &&
                editor.grupoDeConexion(editor.selectedConnections[0]) && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                      Orden en la barra
                    </Typography>

                    <IconButton
                      size="small"
                      aria-label="Subir esta linea"
                      onClick={() => editor.moverEnGrupo(editor.selectedConnections[0], -1)}
                      sx={{ width: 28, height: 28, border: '1px solid', borderColor: 'divider' }}
                    >
                      <Iconify width={14} icon="eva:arrow-ios-upward-fill" />
                    </IconButton>

                    <IconButton
                      size="small"
                      aria-label="Bajar esta linea"
                      onClick={() => editor.moverEnGrupo(editor.selectedConnections[0], 1)}
                      sx={{ width: 28, height: 28, border: '1px solid', borderColor: 'divider' }}
                    >
                      <Iconify width={14} icon="eva:arrow-ios-downward-fill" />
                    </IconButton>
                  </Stack>
                )}

              {editor.selectedConnections.length === 1 &&
                editor.grupoDeConexion(editor.selectedConnections[0]) && (
                  <Stack direction="row" spacing={0.5}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      onClick={() => editor.separarConexion(editor.selectedConnections[0])}
                    >
                      Separar esta
                    </Button>

                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => editor.separarGrupoDe(editor.selectedConnections[0])}
                    >
                      Deshacer union
                    </Button>
                  </Stack>
                )}

              {/* QUITAR UNA LINEA DEL CUADRO. El arbol sigue diciendo de quien
                  cuelga cada cargo; esto solo deja de dibujar la linea, para
                  poder colgar esa casilla de otra. */}
              {editor.selectedConnections.length === 1 && (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => editor.desvincularConexion(editor.selectedConnections[0])}
                >
                  Desvincular esta linea
                </Button>
              )}

              {!!editor.hiddenConnections.length && (
                <Stack spacing={0.25}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Quitadas: {editor.hiddenConnections.length}
                  </Typography>

                  <Button
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={() =>
                      editor.hiddenConnections.forEach((id) => editor.revincularConexion(id))
                    }
                  >
                    Devolver todas
                  </Button>
                </Stack>
              )}
            </Stack>

            {/* VINCULAR DOS CASILLAS A MANO: se pulsa una tarjeta, luego otra, y
                queda dibujada la linea entre ellas aunque el arbol no las
                relacione. */}
            <Stack spacing={0.5}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                Vincular casillas
                {editor.extraConnections.length ? ` · ${editor.extraConnections.length}` : ''}
              </Typography>

              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {editor.origenVinculo
                  ? `Desde ${editor.origenVinculo}. Pulsa la casilla de destino.`
                  : 'Pulsa una casilla para empezar la linea.'}
              </Typography>

              <Stack direction="row" spacing={0.5}>
                <Button
                  size="small"
                  variant={editor.origenVinculo ? 'contained' : 'outlined'}
                  color="inherit"
                  disabled={!editor.selectedNode}
                  onClick={() => editor.marcarExtremoDeVinculo(editor.selectedNode?.id)}
                >
                  {editor.origenVinculo ? 'Unir con la seleccionada' : 'Empezar desde la seleccionada'}
                </Button>

                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  disabled={!editor.origenVinculo}
                  onClick={() => editor.marcarExtremoDeVinculo(null)}
                >
                  Cancelar
                </Button>
              </Stack>

              {editor.extraConnections.map((vinculo) => (
                <Stack
                  key={`${vinculo.from}-${vinculo.to}`}
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                >
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{ color: 'text.secondary', flexGrow: 1, minWidth: 0 }}
                  >
                    {vinculo.from} - {vinculo.to}
                  </Typography>

                  <IconButton
                    size="small"
                    aria-label="Quitar este vinculo"
                    onClick={() => editor.quitarVinculoAMano(vinculo.from, vinculo.to)}
                    sx={{ width: 24, height: 24 }}
                  >
                    <Iconify width={13} icon="mingcute:close-line" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>

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

            {onSaveLayout && (
              <Button
                size="small"
                variant="contained"
                disabled={savingLayout}
                onClick={onSaveLayout}
                startIcon={<Iconify width={16} icon="solar:diskette-bold" />}
                sx={{ mt: 0.5 }}
              >
                {savingLayout ? 'Guardando…' : 'Guardar diseño'}
              </Button>
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
