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

// Los cuatro lados de una tarjeta, cada uno por su centro. En las esquinas la
// linea salia en diagonal desde el vertice y se leia torcida; desde el centro
// del lado sale perpendicular, que es como estan trazados los organigramas.
export const LADOS_VINCULO = ['arriba', 'abajo', 'izquierda', 'derecha'];

// Los primeros vinculos se guardaron por esquinas. Se leen igual, quedandose con
// el lado al que pertenecia cada una.
const LADO_DE_ESQUINA_ANTIGUA = {
  'arriba-izq': 'arriba',
  'arriba-der': 'arriba',
  'abajo-izq': 'abajo',
  'abajo-der': 'abajo',
};

const normalizarLado = (valor) => {
  const lado = String(valor || '');

  if (LADOS_VINCULO.includes(lado)) return lado;

  return LADO_DE_ESQUINA_ANTIGUA[lado] || null;
};

// Pares { from, to } limpios y sin repetir.
function normalizarVinculos(vinculos) {
  const vistos = new Set();

  return (Array.isArray(vinculos) ? vinculos : [])
    .map((vinculo) => ({
      from: String(vinculo?.from || ''),
      to: String(vinculo?.to || ''),
      // Por que lado sale y por cual entra. Sin esto la linea va del borde de
      // abajo del padre al de arriba del hijo, que es lo que hace el arbol.
      fromLado: normalizarLado(vinculo?.fromLado ?? vinculo?.fromEsquina),
      toLado: normalizarLado(vinculo?.toLado ?? vinculo?.toEsquina),
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
  // VARIOS A LA VEZ. Con Ctrl (o Cmd) se van sumando casillas y todas se mueven
  // juntas: colocar una fila entera de siete de una en una era el trabajo lento
  // de verdad. `selectedNode` sigue siendo la ultima marcada, que es de la que
  // el panel ensena las coordenadas.
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
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
  // El tirador del que se esta arrastrando ahora mismo: { nodeId, esquina }.
  const [arrastreDeVinculo, setArrastreDeVinculo] = useState(null);

  const toggleEditMode = useCallback(() => {
    setEditMode((currentValue) => !currentValue);
    // Al cerrar el lapiz no queda nada marcado: al volver a abrirlo, arrastrar
    // una casilla habria movido tambien las de la sesion anterior.
    setSelectedNodeIds([]);
    setSelectedNode(null);
  }, []);

  const limpiarSeleccionDeNodos = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedNode(null);
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

      const conCtrl = event.ctrlKey || event.metaKey;
      const yaMarcado = selectedNodeIds.includes(node.id);

      // Con Ctrl se suma o se quita de la seleccion; sin Ctrl, si se agarra una
      // que ya estaba marcada se mantiene el grupo —asi se arrastran todas—, y
      // si se agarra otra se empieza de cero con esa.
      const marcados = (() => {
        if (conCtrl) {
          return yaMarcado
            ? selectedNodeIds.filter((id) => id !== node.id)
            : [...selectedNodeIds, node.id];
        }

        return yaMarcado ? selectedNodeIds : [node.id];
      })();

      setSelectedNodeIds(marcados);

      // Quitar una del grupo con Ctrl no arrastra nada.
      if (conCtrl && yaMarcado) {
        nodeDragRef.current = null;
        setSelectedNode(null);

        return;
      }

      nodeDragRef.current = {
        id: node.id,
        startX: event.clientX,
        startY: event.clientY,
        // El punto de partida de CADA una de las marcadas: se mueven todas la
        // misma distancia, cada una desde donde estaba.
        inicioPorNodo: marcados.reduce(
          (acc, id) => ({ ...acc, [id]: nodeOffsets[id] ?? EMPTY_OFFSET }),
          {}
        ),
      };

      setSelectedNode({
        id: node.id,
        name: node.name,
        role: node.role,
      });
    },
    [editMode, nodeOffsets, selectedNodeIds]
  );

  const handleNodePointerMove = useCallback((event) => {
    const dragState = nodeDragRef.current;

    if (!dragState) {
      return;
    }

    event.stopPropagation();

    const avanceX = event.clientX - dragState.startX;
    const avanceY = event.clientY - dragState.startY;

    setNodeOffsets((currentOffsets) => {
      const siguientes = { ...currentOffsets };

      Object.entries(dragState.inicioPorNodo).forEach(([id, inicio]) => {
        siguientes[id] = {
          x: Math.round(inicio.x + avanceX),
          y: Math.round(inicio.y + avanceY),
        };
      });

      return siguientes;
    });
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
        selected: selectedNodeIds.includes(node.id) || selectedNode?.id === node.id,
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
      selectedNodeIds,
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

  // ARRASTRAR DE UNA ESQUINA A OTRA. Se agarra el circulito de una tarjeta y se
  // suelta en el de otra: ahi queda la linea, saliendo y entrando justo por esas
  // esquinas. Es la forma directa de hacer lo que los botones hacen en dos
  // pasos.
  const empezarArrastreDeVinculo = useCallback((nodeId, lado) => {
    if (!nodeId) return;

    setArrastreDeVinculo({ nodeId, lado });
  }, []);

  // Soltar en el aire cancela. Sin esto, un arrastre fallido dejaba el origen
  // colgado y el siguiente circulito que se pulsara creaba una linea que nadie
  // habia pedido.
  useEffect(() => {
    if (!arrastreDeVinculo) return undefined;

    // En el siguiente tic: primero tiene que correr el `onPointerUp` del
    // circulito de destino, que es quien crea la linea de verdad.
    const cancelar = () => window.setTimeout(() => setArrastreDeVinculo(null), 0);

    window.addEventListener('pointerup', cancelar);

    return () => window.removeEventListener('pointerup', cancelar);
  }, [arrastreDeVinculo]);

  const soltarArrastreDeVinculo = useCallback((nodeId, lado) => {
    setArrastreDeVinculo((origen) => {
      // Soltar en el aire, o en la misma tarjeta, no crea nada.
      if (!origen || !nodeId || origen.nodeId === nodeId) return null;

      setExtraConnections((actuales) =>
        normalizarVinculos([
          ...actuales,
          { from: origen.nodeId, fromLado: origen.lado, to: nodeId, toLado: lado },
        ])
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
      selectedNodeIds,
      limpiarSeleccionDeNodos,
      nodeOffsets,
      containerHeightOffset,
      containerWidthOffset,
      connectionGroups,
      selectedConnections,
      hiddenConnections,
      extraConnections,
      origenVinculo,
      arrastreDeVinculo,
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
      empezarArrastreDeVinculo,
      soltarArrastreDeVinculo,
      toggleEditMode,
      getNodeEditProps,
      getNodeTreeClassName,
    }),
    [
      editMode,
      selectedNode,
      selectedNodeIds,
      limpiarSeleccionDeNodos,
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
      arrastreDeVinculo,
      empezarArrastreDeVinculo,
      soltarArrastreDeVinculo,
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
// Codo en angulo recto, sin redondear. `lineasRectas` lo pide el organigrama que
// sigue el trazado del documento oficial, donde las esquinas son vivas.
function buildConnectorPath({
  startX,
  startY,
  endX,
  endY,
  barraY,
  lineasRectas = false,
  saleDeCostado = false,
}) {
  const middleY = Number.isFinite(barraY) ? barraY : startY + (endY - startY) / 2;

  if (lineasRectas) {
    // Por un costado se sale en horizontal y por arriba o abajo en vertical: si
    // no, la linea nace hacia dentro de la tarjeta y se ve salir de su cara.
    if (saleDeCostado) {
      const middleX = startX + (endX - startX) / 2;

      return `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`;
    }

    return `M ${startX} ${startY} V ${middleY} H ${endX} V ${endY}`;
  }

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
// LOS CUATRO PUNTOS DE UNA TARJETA, uno por lado y en su centro.
//
// Solo existen con el lapiz abierto. Se agarra uno y se suelta en el de otra
// tarjeta: ahi queda la linea. Van por encima de todo para que se puedan agarrar
// aunque la tarjeta de al lado los solape.
export function LeadershipNodeAnchors({ editor, nodeId }) {
  if (!editor?.editMode || !nodeId) return null;

  const arrastrando = editor.arrastreDeVinculo?.nodeId === nodeId;

  // Centrados en su lado: la mitad del punto sobresale hacia fuera.
  const posiciones = {
    arriba: { top: -6, left: '50%', ml: '-6px' },
    abajo: { bottom: -6, left: '50%', ml: '-6px' },
    izquierda: { left: -6, top: '50%', mt: '-6px' },
    derecha: { right: -6, top: '50%', mt: '-6px' },
  };

  return LADOS_VINCULO.map((lado) => (
    <Box
      key={lado}
      data-leadership-anchor={`${nodeId}|${lado}`}
      aria-label={`Conectar por ${lado}`}
      onPointerDown={(event) => {
        // Sin esto empieza a arrastrarse la tarjeta, no la linea.
        event.stopPropagation();
        event.preventDefault();
        editor.empezarArrastreDeVinculo(nodeId, lado);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        editor.soltarArrastreDeVinculo(nodeId, lado);
      }}
      sx={{
        ...posiciones[lado],
        width: 12,
        height: 12,
        zIndex: 5,
        position: 'absolute',
        borderRadius: '50%',
        cursor: 'crosshair',
        bgcolor: 'background.paper',
        border: '2px solid',
        borderColor: arrastrando ? 'primary.main' : 'text.disabled',
        '&:hover': { borderColor: 'primary.main', transform: 'scale(1.25)' },
      }}
    />
  ));
}

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
  // Esquinas vivas en vez de redondeadas.
  lineasRectas = false,
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

          // Un vinculo hecho a mano sale y entra por la ESQUINA que se agarro;
          // los del arbol, del borde de abajo del padre al de arriba del hijo.
          const punto = (rect, lado, porDefecto) => {
            const izquierda = rect.left - containerRect.left;
            const derecha = rect.right - containerRect.left;
            const arriba = rect.top - containerRect.top;
            const abajo = rect.bottom - containerRect.top;
            const centroX = izquierda + rect.width / 2;
            const centroY = arriba + rect.height / 2;

            switch (lado) {
              case 'arriba':
                return { x: centroX, y: arriba };
              case 'abajo':
                return { x: centroX, y: abajo };
              case 'izquierda':
                return { x: izquierda, y: centroY };
              case 'derecha':
                return { x: derecha, y: centroY };
              default:
                return porDefecto;
            }
          };

          const salida = punto(fromRect, connection.fromLado, {
            x: fromRect.left - containerRect.left + fromRect.width / 2,
            y: fromRect.bottom - containerRect.top,
          });
          const entrada = punto(toRect, connection.toLado, {
            x: toRect.left - containerRect.left + toRect.width / 2,
            y: toRect.top - containerRect.top,
          });

          const startX = salida.x;
          const startY = salida.y;
          const endX = entrada.x;
          const endY = entrada.y;

          return {
            id: `${connection.from}-${connection.to}`,
            startX,
            startY,
            endX,
            endY,
            // Un vinculo hecho a mano manda sobre el trazado: sale y entra por
            // donde se dijo, y en recto.
            aMano: Boolean(connection.fromLado || connection.toLado),
            saleDeCostado:
              connection.fromLado === 'izquierda' || connection.fromLado === 'derecha',
            fromLado: connection.fromLado,
            toLado: connection.toLado,
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
            d: buildConnectorPath({ ...medida, barraY, lineasRectas }),
            tronco: null,
          });
        });
      });

      const nextPaths = medidas.map((medida) => {
        const unida = trazoDeGrupo.get(medida.id);

        return {
          id: medida.id,
          unida: Boolean(unida),
          d: unida
            ? unida.d
            : buildConnectorPath({ ...medida, lineasRectas: lineasRectas || medida.aMano }),
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
  }, [active, connections, watchKey, containerRef, connectionGroups, lineasRectas]);

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
        // POR DEBAJO DE LAS TARJETAS. Iba al mismo nivel que ellas y, al pasar
        // una linea bajo una casilla, se le dibujaba encima y la cruzaba por la
        // cara. Las tarjetas se pintan a partir del 1.
        zIndex: 0,
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
              <>
                <Box
                  component="line"
                  x1={path.tronco.x}
                  y1={path.tronco.desde}
                  x2={path.tronco.x}
                  y2={path.tronco.hasta}
                  strokeLinecap="round"
                  strokeWidth={seleccionada ? lineWidth + 1.5 : lineWidth}
                  stroke={seleccionada ? 'var(--palette-primary-main)' : 'var(--palette-grey-600)'}
                />

                {/* El tronco es lo mas visible de una barra vertical: sin zona
                    de pulsacion propia, pulsarlo no seleccionaba nada y la
                    linea ya no se podia separar ni desvincular. */}
                {editMode && (
                  <Box
                    component="line"
                    x1={path.tronco.x}
                    y1={path.tronco.desde}
                    x2={path.tronco.x}
                    y2={path.tronco.hasta}
                    stroke="transparent"
                    strokeWidth={14}
                    sx={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectConnection?.(path.id);
                    }}
                  />
                )}
              </>
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

  // DONDE ESTA EL PANEL. `null` es su sitio de siempre —al costado en pantalla
  // grande, sobre el cuadro en pequeña—; en cuanto se arrastra pasa a guardar
  // sus coordenadas en la ventana. Se queda en memoria mientras dure la visita:
  // es una comodidad de quien esta colocando, no parte del diseño.
  const [posicionPanel, setPosicionPanel] = useState(null);
  const panelRef = useRef(null);
  const arrastreDelPanel = useRef(null);

  const iniciarArrastreDelPanel = (event) => {
    const panel = panelRef.current;

    if (!panel || event.button !== 0) return;

    const rect = panel.getBoundingClientRect();

    arrastreDelPanel.current = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      ancho: rect.width,
      alto: rect.height,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  };

  const moverElPanel = (event) => {
    const arrastre = arrastreDelPanel.current;

    if (!arrastre) return;

    // Sin salirse de la ventana: si se suelta fuera, el panel ya no se alcanza
    // para volver a traerlo.
    const x = Math.min(
      Math.max(0, event.clientX - arrastre.dx),
      Math.max(0, window.innerWidth - arrastre.ancho)
    );
    const y = Math.min(
      Math.max(0, event.clientY - arrastre.dy),
      Math.max(0, window.innerHeight - arrastre.alto)
    );

    setPosicionPanel({ x, y });
  };

  const soltarElPanel = (event) => {
    arrastreDelPanel.current = null;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

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
          ref={panelRef}
          variant="outlined"
          sx={(theme) => ({
            p: 1.5,
            mb: 1,
            width: 300,
            maxWidth: 'calc(100vw - 48px)',
            bgcolor: 'background.paper',
            boxShadow: 6,
            // EN PANTALLA GRANDE, FUERA DEL CUADRO.
            //
            // El panel se dibujaba dentro del contenedor del organigrama y le
            // tapaba una esquina justo mientras se colocan las cajas, que es
            // cuando hace falta verlas todas. Con `fixed` se sale del recuadro
            // —y de su `overflow: hidden`, que si no lo recortaria— y se queda
            // pegado al costado de la ventana.
            //
            // En pantallas pequeñas se queda donde estaba: al lado no cabe.
            [theme.breakpoints.up('lg')]: {
              position: 'fixed',
              top: '50%',
              right: 24,
              mb: 0,
              transform: 'translateY(-50%)',
              maxHeight: 'calc(100vh - 48px)',
              overflowY: 'auto',
            },
            // Arrastrado: manda lo que diga el usuario, en cualquier tamaño de
            // pantalla. Va al final para pisar al bloque de arriba.
            ...(posicionPanel && {
              position: 'fixed',
              top: posicionPanel.y,
              left: posicionPanel.x,
              right: 'auto',
              bottom: 'auto',
              mb: 0,
              transform: 'none',
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
            }),
          })}
        >
          <Stack spacing={0.75}>
            {/* El titulo es el asa: se agarra aqui y el panel se lleva donde
                estorbe menos. Doble clic lo devuelve a su sitio. */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              onPointerDown={iniciarArrastreDelPanel}
              onPointerMove={moverElPanel}
              onPointerUp={soltarElPanel}
              onPointerCancel={soltarElPanel}
              onDoubleClick={() => setPosicionPanel(null)}
              sx={{
                cursor: 'grab',
                touchAction: 'none',
                userSelect: 'none',
                '&:active': { cursor: 'grabbing' },
              }}
            >
              <Iconify width={16} icon="solar:hamburger-menu-linear" sx={{ color: 'text.disabled' }} />

              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                Edicion visual
              </Typography>

              {posicionPanel && (
                <Tooltip title="Devolver a su sitio">
                  <IconButton
                    size="small"
                    aria-label="Devolver el panel a su sitio"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setPosicionPanel(null)}
                    sx={{ width: 22, height: 22 }}
                  >
                    <Iconify width={13} icon="solar:restart-bold" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

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

            {editor.selectedNodeIds.length > 1 && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                  {editor.selectedNodeIds.length} casillas marcadas
                </Typography>

                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  onClick={editor.limpiarSeleccionDeNodos}
                >
                  Soltar
                </Button>
              </Stack>
            )}

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
