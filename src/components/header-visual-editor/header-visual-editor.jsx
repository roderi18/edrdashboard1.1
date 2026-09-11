'use client';

import dayjs from 'dayjs';
import { varAlpha } from 'minimal-shared/utils';
import { usePopover } from 'minimal-shared/hooks';
import { useRef, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import {
  CAPAS,
  EFECTOS,
  LIMITES,
  efectoACss,
  elementoACss,
  crearElemento,
  sanearElemento,
  LOGO_POR_DEFECTO,
  FORMATOS_DE_CUENTA,
  ANCHO_DE_REFERENCIA,
} from 'src/utils/store-header-design.mjs';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { PaletaDeColores } from './paleta-de-colores';
import { HeaderVisualCanvas } from './header-visual-canvas';
import { useDisenoHistorial } from './use-diseno-historial';
import { TextoParpadeanteDialogo } from './texto-parpadeante-dialogo';

// ----------------------------------------------------------------------
// EL EDITOR VISUAL DEL ENCABEZADO.
//
// Se edita SOBRE EL PROPIO ENCABEZADO, no en una ventana aparte con una copia:
// el lienzo es el mismo componente que ve el cliente (`HeaderVisualCanvas`), y
// lo unico que se le añade es la cuadricula, el contorno de lo seleccionado y
// las asas. Lo que se ve mientras se coloca es, literalmente, lo que se guarda.
//
// TODO SE MUEVE EN PORCENTAJES. Arrastrar guarda "al 40% del ancho", no "a 480
// pixeles": el mismo diseño se sostiene en un telefono y en un monitor ancho.
//
// Y SE PUEDE COLOCAR SIN RATON: con un texto seleccionado, las flechas lo
// mueven. Un editor que solo entiende el arrastre deja fuera a quien no puede
// arrastrar.
// ----------------------------------------------------------------------

// A cuanto se pega el arrastre. Con la cuadricula puesta, dos textos colocados
// "a ojo" acaban alineados de verdad.
const PASO = 2;

const PASOS_DE_CUADRICULA = 100 / PASO;

const acotarPorcentaje = (valor) =>
  Math.min(LIMITES.posicion.max, Math.max(LIMITES.posicion.min, valor));

const alPaso = (valor) => Math.round(valor / PASO) * PASO;

// LA FRANJA DE ARRIBA ES LA PAPELERA. Aparece solo mientras se arrastra: sacar
// algo del encabezado es el gesto que ya se hacia por instinto —empujarlo fuera
// por arriba— y antes solo se conseguia soltarlo pegado al borde.
const ALTO_DE_PAPELERA = 64;

// Lo que hay que moverse para que un clic cuente como arrastre. Un dedo nunca
// pulsa completamente quieto, y un raton tampoco cuando se hace clic con prisa.
const UMBRAL_DE_ARRASTRE = 4;

// Los emojis que se usan en una tienda. No es un teclado completo a proposito:
// el campo acepta CUALQUIER emoji del sistema —se pega o se escribe con el
// teclado del movil—, y esto es solo el atajo para los cuatro de siempre.
// Como se llama en el panel lo que se acaba de seleccionar.
const ROTULOS_DE_PANEL = {
  texto: 'Texto seleccionado',
  imagen: 'Imagen seleccionada',
  linea: 'Línea seleccionada',
  forma: 'Forma seleccionada',
  cuenta: 'Cuenta regresiva',
};

// LOS TRES ANCHOS EN LOS QUE SE VA A VER. No son estilos distintos: es el MISMO
// diseño estrechado, que es justo lo que hace un telefono. Colocar solo en
// escritorio y descubrir en el movil que el lema tapa al titulo es el error mas
// caro de este editor.
const DISPOSITIVOS = [
  { id: 'movil', etiqueta: 'Móvil', ancho: 390, icono: 'solar:smartphone-bold' },
  { id: 'tableta', etiqueta: 'Tableta', ancho: 820, icono: 'solar:tablet-bold' },
  { id: 'escritorio', etiqueta: 'Escritorio', ancho: 0, icono: 'solar:monitor-bold' },
];

const EMOJIS = ['🎉', '🔥', '⭐', '✨', '🎁', '🛒', '💥', '❤️', '👏', '🚀', '🏕️', '🧭'];

/**
 * Lo que mide ese texto escrito en UNA linea, en pixeles.
 *
 * Se mide sobre una copia fuera de pantalla con la misma tipografia: preguntarle
 * al nodo real por su ancho devuelve el del bloque —que es justo lo que se
 * quiere cambiar—, no el del texto.
 */
const anchoNaturalDelTexto = (nodo) => {
  if (!nodo || typeof window === 'undefined') return 0;

  const estilos = window.getComputedStyle(nodo);
  const copia = document.createElement('span');

  copia.textContent = nodo.textContent;
  copia.style.position = 'absolute';
  copia.style.visibility = 'hidden';
  copia.style.whiteSpace = 'nowrap';
  copia.style.font = estilos.font;
  copia.style.letterSpacing = estilos.letterSpacing;

  document.body.appendChild(copia);
  const ancho = copia.getBoundingClientRect().width;
  document.body.removeChild(copia);

  return ancho;
};

// De ISO al calendario y de vuelta.
//
// EL MISMO CALENDARIO QUE EL RESTO DE LA APLICACION —el de la fecha de
// nacimiento de un miembro o el de una actividad—, no el que trae el navegador:
// el nativo cambia de aspecto y de orden de campos en cada sistema, y en la
// misma pantalla convivian dos formas distintas de escribir una fecha.
//
// El calendario habla `dayjs` y lo guardado es un instante en UTC. Quien
// programa la promocion escribe "viernes a las 8" en SU reloj y la promocion
// empieza a la vez para todo el mundo.
const aCalendario = (iso) => {
  if (!iso) return null;

  const fecha = dayjs(iso);

  return fecha.isValid() ? fecha : null;
};

const deCalendario = (valor) => {
  const fecha = valor ? dayjs(valor) : null;

  return fecha?.isValid() ? fecha.toDate().toISOString() : '';
};

export function HeaderVisualEditor({
  diseno: disenoInicial,
  fotoUrl = '',
  guardando = false,
  onGuardar,
  onCancelar,
  onSubirImagen,
  analiticas = {},
}) {
  const lienzoRef = useRef(null);
  const arrastre = useRef(null);
  const redimension = useRef(null);

  const {
    diseno,
    aplicar,
    cerrarGesto,
    deshacer,
    rehacer,
    restaurar,
    sePuedeDeshacer,
    sePuedeRehacer,
    hayCambios,
  } = useDisenoHistorial(disenoInicial);

  const [seleccionado, setSeleccionado] = useState(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [eligiendoEfecto, setEligiendoEfecto] = useState(false);
  const [dispositivo, setDispositivo] = useState('escritorio');
  const [sobrePapelera, setSobrePapelera] = useState(false);
  // ARRASTRAR NO ES PULSAR. La papelera aparecia con el simple clic de
  // seleccionar —un parpadeo rojo cada vez que se tocaba algo—; ahora espera a
  // que el puntero se haya movido de verdad.
  const [arrastrando, setArrastrando] = useState(false);
  const [pestana, setPestana] = useState('formato');
  const menuDeFormas = usePopover();
  const menuDeProgramacion = usePopover();
  const [cuadricula, setCuadricula] = useState(true);
  const [previsualizando, setPrevisualizando] = useState(false);

  const elemento = diseno.elementos.find((item) => item.id === seleccionado) || null;
  const anchoDelDispositivo = DISPOSITIVOS.find((item) => item.id === dispositivo)?.ancho || 0;

  // Sin elemento no hay ajustes que tocar: se vuelve a "Formato" —que entonces
  // es el fondo— sin perder la pestaña elegida para la proxima seleccion.
  const pestanaActiva = elemento ? pestana : 'formato';

  // ------------------------------------------------------------------
  // Cambios sobre el modelo
  // ------------------------------------------------------------------

  const cambiarElemento = useCallback(
    (id, cambios, etiqueta = null) => {
      aplicar(
        (actual) => ({
          ...actual,
          elementos: actual.elementos.map((item) =>
            item.id === id ? sanearElemento({ ...item, ...cambios }) : item
          ),
        }),
        etiqueta
      );
    },
    [aplicar]
  );

  const agregarTexto = useCallback(
    (parcial = {}) => {
      const nuevo = crearElemento({ y: 45, ...parcial });

      aplicar((actual) => ({ ...actual, elementos: [...actual.elementos, nuevo] }));
      setSeleccionado(nuevo.id);
    },
    [aplicar]
  );

  const duplicarTexto = useCallback(() => {
    if (!elemento) return;

    // Un poco mas abajo y a la derecha: encima del original no se veria que la
    // copia existe, y hay que poder arrastrarla.
    const copia = crearElemento({
      ...elemento,
      x: acotarPorcentaje(elemento.x + 3),
      y: acotarPorcentaje(elemento.y + 8),
    });

    aplicar((actual) => ({ ...actual, elementos: [...actual.elementos, copia] }));
    setSeleccionado(copia.id);
  }, [aplicar, elemento]);

  const eliminarTexto = useCallback(() => {
    if (!elemento) return;

    aplicar((actual) => ({
      ...actual,
      elementos: actual.elementos.filter((item) => item.id !== elemento.id),
    }));
    setSeleccionado(null);
  }, [aplicar, elemento]);

  const agregarImagen = useCallback(() => {
    const nuevo = crearElemento({ tipo: 'imagen', url: LOGO_POR_DEFECTO, x: 2, y: 22, ancho: 6 });

    aplicar((actual) => ({ ...actual, elementos: [...actual.elementos, nuevo] }));
    setSeleccionado(nuevo.id);
  }, [aplicar]);

  // CAMBIAR LA IMAGEN NO ES ASUNTO DEL EDITOR. El editor sabe colocar; donde se
  // guardan los archivos lo sabe quien lo usa, y lo pasa en `onSubirImagen`.
  // Asi este componente sirve igual para otro encabezado con otro almacen.
  const handleElegirImagen = useCallback(
    async (evento) => {
      const archivo = evento.target.files?.[0];

      if (!archivo || !elemento || !onSubirImagen) return;

      setSubiendoImagen(true);

      try {
        const url = await onSubirImagen(archivo);

        if (url) cambiarElemento(elemento.id, { url });
      } finally {
        setSubiendoImagen(false);
      }
    },
    [elemento, onSubirImagen, cambiarElemento]
  );

  const agregarFigura = useCallback(
    (tipo, forma = 'rectangulo') => {
      const nuevo = crearElemento(
        tipo === 'linea'
          ? { tipo, x: 10, y: 50, ancho: 30, grosor: 2, color: '#FFFFFF' }
          : { tipo, forma, x: 10, y: 30, ancho: 20, alto: 20, color: '#FFAB00' }
      );

      aplicar((actual) => ({ ...actual, elementos: [...actual.elementos, nuevo] }));
      setSeleccionado(nuevo.id);
    },
    [aplicar]
  );

  const agregarCuenta = useCallback(() => {
    // Una semana por delante: una cuenta que nace terminada no se entiende, y
    // la fecha real la pone quien la usa en dos clics.
    const enUnaSemana = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const nuevo = crearElemento({
      tipo: 'cuenta',
      texto: '¡Terminó!',
      hasta: enUnaSemana,
      x: 62,
      y: 46,
      ancho: 30,
      tamano: 24,
      negrita: true,
      color: '#FFAB00',
    });

    aplicar((actual) => ({ ...actual, elementos: [...actual.elementos, nuevo] }));
    setSeleccionado(nuevo.id);
  }, [aplicar]);

  // CAPAS. Se mueve de dos en dos para que un solo clic baste para pasar por
  // encima del vecino, que es lo que se quiere al pulsar "traer al frente".
  const cambiarCapa = useCallback(
    (item, direccion) => {
      cambiarElemento(item.id, {
        capa: Math.min(CAPAS.max, Math.max(CAPAS.min, item.capa + direccion * 2)),
      });
    },
    [cambiarElemento]
  );

  const cambiarFondo = useCallback(
    (cambios, etiqueta = null) => {
      aplicar((actual) => ({ ...actual, fondo: { ...actual.fondo, ...cambios } }), etiqueta);
    },
    [aplicar]
  );

  // ------------------------------------------------------------------
  // Arrastre
  // ------------------------------------------------------------------

  const handlePointerDown = useCallback(
    (event, item) => {
      if (previsualizando) return;

      // Bloqueado se puede SELECCIONAR —hace falta para desbloquearlo— pero no
      // arrastrar. Es justo el caso del escudo: se coloca una vez y luego
      // estorba cada vez que se mueve algo que tiene al lado.
      if (item.bloqueado) {
        setSeleccionado(item.id);

        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const marco = lienzoRef.current?.getBoundingClientRect();
      if (!marco) return;

      setSeleccionado(item.id);
      event.currentTarget.setPointerCapture?.(event.pointerId);

      // Se guarda la distancia entre el puntero y la esquina del texto: sin
      // esto el texto salta para ponerse bajo el dedo en cuanto se toca.
      arrastre.current = {
        id: item.id,
        marco,
        origenX: event.clientX,
        origenY: event.clientY,
        desfaseX: ((event.clientX - marco.left) / marco.width) * 100 - item.x,
        desfaseY: ((event.clientY - marco.top) / marco.height) * 100 - item.y,
      };
    },
    [previsualizando]
  );

  // ARRASTRAR EL BORDE DERECHO CAMBIA EL ANCHO. Antes el ancho solo se movia
  // con el control deslizante del panel, que obliga a mirar a otro lado
  // mientras se ajusta lo que se esta viendo.
  const handleRedimensionDown = useCallback((event, item) => {
    event.preventDefault();
    // Sin esto, el mismo gesto empezaria tambien a mover el elemento.
    event.stopPropagation();

    const marco = lienzoRef.current?.getBoundingClientRect();
    if (!marco) return;

    setSeleccionado(item.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);

    redimension.current = { id: item.id, marco, x: item.x };
  }, []);

  const handlePointerMove = useCallback(
    (event) => {
      const cambiandoAncho = redimension.current;

      if (cambiandoAncho) {
        const borde =
          ((event.clientX - cambiandoAncho.marco.left) / cambiandoAncho.marco.width) * 100;
        const ancho = borde - cambiandoAncho.x;

        cambiarElemento(
          cambiandoAncho.id,
          {
            ancho: Math.min(
              LIMITES.ancho.max,
              Math.max(LIMITES.ancho.min, event.altKey ? ancho : alPaso(ancho))
            ),
          },
          `ancho-${cambiandoAncho.id}`
        );

        return;
      }

      const activo = arrastre.current;
      if (!activo) return;

      const recorrido =
        Math.abs(event.clientX - activo.origenX) + Math.abs(event.clientY - activo.origenY);

      if (recorrido > UMBRAL_DE_ARRASTRE) setArrastrando(true);

      // Contra el marco del lienzo, no contra la ventana: el lienzo cambia de
      // ancho con la vista previa de movil o tableta.
      setSobrePapelera(event.clientY < activo.marco.top + ALTO_DE_PAPELERA);

      const x = ((event.clientX - activo.marco.left) / activo.marco.width) * 100 - activo.desfaseX;
      const y = ((event.clientY - activo.marco.top) / activo.marco.height) * 100 - activo.desfaseY;

      // Con Alt se suelta la cuadricula, para los ajustes finos.
      const ajustar = (valor) => acotarPorcentaje(event.altKey ? valor : alPaso(valor));

      cambiarElemento(activo.id, { x: ajustar(x), y: ajustar(y) }, `mover-${activo.id}`);
    },
    [cambiarElemento]
  );

  const handlePointerUp = useCallback(() => {
    if (!arrastre.current && !redimension.current) return;

    // Soltar sobre la papelera borra. Es deshacible como todo lo demas, asi que
    // no hace falta preguntar: preguntar en mitad de un arrastre es peor.
    if (arrastre.current && arrastrando && sobrePapelera) {
      const id = arrastre.current.id;

      aplicar((actual) => ({
        ...actual,
        elementos: actual.elementos.filter((item) => item.id !== id),
      }));
      setSeleccionado(null);
    }

    arrastre.current = null;
    redimension.current = null;
    setSobrePapelera(false);
    setArrastrando(false);
    cerrarGesto();
  }, [cerrarGesto, sobrePapelera, arrastrando, aplicar]);

  // AL TEXTO QUE TIENE, de una vez. Es lo que se quiere el 90% de las veces
  // —que el recuadro no sobre ni parta la palabra— y a mano se tarda un rato.
  const ajustarAlContenido = useCallback(
    (item) => {
      const nodo = lienzoRef.current?.querySelector(`[data-elemento="${item.id}"]`);

      if (!nodo) return;

      const natural = anchoNaturalDelTexto(nodo);
      if (!natural) return;

      // OJO: la medida sale en pixeles del LIENZO DE DISEnO, no de la pantalla
      // —`getComputedStyle` devuelve el tamaño antes de encoger el lienzo—, asi
      // que el porcentaje se calcula contra el ancho de diseño y no contra lo
      // que ocupa en pantalla. Con el ancho de pantalla, el recuadro salia mas
      // estrecho cuanto mas pequeña fuera la ventana.
      const ancho = ((natural + 4) / ANCHO_DE_REFERENCIA) * 100;

      cambiarElemento(item.id, {
        ancho: Math.min(LIMITES.ancho.max, Math.max(LIMITES.ancho.min, ancho)),
      });
    },
    [cambiarElemento]
  );

  const handleKeyDown = useCallback(
    (event, item) => {
      if (item.bloqueado) return;

      const salto = event.shiftKey ? PASO * 5 : PASO;

      // Con Ctrl (o Cmd) las flechas horizontales redimensionan en vez de
      // mover: quien no puede arrastrar tambien tiene que poder ensanchar.
      if ((event.ctrlKey || event.metaKey) && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        cambiarElemento(
          item.id,
          {
            ancho: Math.min(
              LIMITES.ancho.max,
              Math.max(
                LIMITES.ancho.min,
                item.ancho + (event.key === 'ArrowRight' ? salto : -salto)
              )
            ),
          },
          `ancho-teclado-${item.id}`
        );

        return;
      }

      const movimientos = {
        ArrowLeft: { x: item.x - salto },
        ArrowRight: { x: item.x + salto },
        ArrowUp: { y: item.y - salto },
        ArrowDown: { y: item.y + salto },
      };

      const movimiento = movimientos[event.key];

      if (movimiento) {
        event.preventDefault();
        cambiarElemento(
          item.id,
          {
            x: acotarPorcentaje(movimiento.x ?? item.x),
            y: acotarPorcentaje(movimiento.y ?? item.y),
          },
          `teclado-${item.id}`
        );
      }
    },
    [cambiarElemento]
  );

  // ------------------------------------------------------------------
  // Pintado
  // ------------------------------------------------------------------

  const renderElemento = (item, contenido) => {
    if (previsualizando) return contenido;

    const activo = item.id === seleccionado;
    const esFigura = item.tipo === 'linea' || item.tipo === 'forma';

    return (
      <Box
        key={item.id}
        role="button"
        tabIndex={0}
        aria-label={
          item.tipo === 'texto'
            ? `Mover el texto "${item.texto}"`
            : `Mover la ${ROTULOS_DE_PANEL[item.tipo] ?? 'pieza'}`
        }
        onPointerDown={(event) => handlePointerDown(event, item)}
        onClick={(event) => {
          // El clic del propio elemento no sube al lienzo: alli deseleccionaria.
          event.stopPropagation();
          setSeleccionado(item.id);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={(event) => handleKeyDown(event, item)}
        sx={{
          left: `${item.x}%`,
          top: `${item.y}%`,
          width: `${item.ancho}%`,
          // LA ENVOLTURA TIENE QUE MEDIR LO QUE MIDE LA PIEZA. Un texto crece
          // con su contenido, pero una forma mide un porcentaje del ALTO del
          // encabezado y una linea, unos pixeles: sin darselo aqui, el hijo
          // resolvia su altura contra una caja de altura cero y desaparecia.
          // Por eso las figuras y el escudo solo se veian al previsualizar.
          ...(esFigura && { height: item.tipo === 'linea' ? `${item.grosor}px` : `${item.alto}%` }),
          position: 'absolute',
          cursor: item.bloqueado ? 'default' : 'move',
          touchAction: 'none',
          borderRadius: 0.5,
          outline: (theme) =>
            activo
              ? `2px solid ${theme.vars.palette.primary.main}`
              : `1px dashed ${theme.vars.palette.common.white}`,
          outlineOffset: 2,
          '&:focus-visible': {
            outline: (theme) => `2px solid ${theme.vars.palette.warning.main}`,
          },
        }}
      >
        {/* EL ASA DEL BORDE DERECHO. Solo en lo seleccionado: una en cada
            elemento convertiria el lienzo en un campo de puntitos. Se arrastra
            para ensanchar; con doble clic, el recuadro se ajusta al texto que
            tiene. */}
        {activo && !item.bloqueado && (
          <Box
            role="separator"
            aria-label="Ajustar el ancho"
            onPointerDown={(event) => handleRedimensionDown(event, item)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={(event) => {
              event.stopPropagation();
              ajustarAlContenido(item);
            }}
            onClick={(event) => event.stopPropagation()}
            sx={{
              top: 0,
              width: 10,
              right: -5,
              bottom: 0,
              zIndex: 1,
              position: 'absolute',
              cursor: 'ew-resize',
              touchAction: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '&::after': {
                width: 4,
                height: 22,
                content: '""',
                borderRadius: 1,
                bgcolor: 'primary.main',
                border: (theme) => `1px solid ${theme.vars.palette.common.white}`,
              },
            }}
          />
        )}

        {/* El contenido se pinta con el MISMO componente que ve el cliente; aqui
            solo se le quita la posicion —que ya la pone la envoltura— y se le
            dice que ocupe la caja entera, porque sus medidas eran porcentajes
            del lienzo y ahora su referencia es esta envoltura. */}
        <Box
          sx={{
            width: 1,
            height: esFigura ? 1 : 'auto',
            position: 'relative',
            '& > *': {
              position: 'static !important',
              left: 'auto !important',
              top: 'auto !important',
              width: '100% !important',
              ...(esFigura && { height: '100% !important' }),
            },
          }}
        >
          {contenido}
        </Box>
      </Box>
    );
  };

  const renderBarra = () => (
    <Paper
      variant="outlined"
      sx={{ p: 1, mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}
    >
      <Button
        size="small"
        variant="contained"
        startIcon={<Iconify icon="mingcute:add-line" />}
        onClick={() => agregarTexto()}
        disabled={previsualizando || diseno.elementos.length >= LIMITES.elementos}
      >
        Texto
      </Button>

      <Button
        size="small"
        color="inherit"
        startIcon={<Iconify icon="solar:flash-bold" />}
        endIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={16} />}
        onClick={() => setEligiendoEfecto(true)}
        disabled={previsualizando || diseno.elementos.length >= LIMITES.elementos}
      >
        Texto parpadeante
      </Button>

      <Button
        size="small"
        color="inherit"
        startIcon={<Iconify icon="solar:gallery-add-bold" />}
        onClick={agregarImagen}
        disabled={previsualizando || diseno.elementos.length >= LIMITES.elementos}
      >
        Imagen
      </Button>

      <Button
        size="small"
        color="inherit"
        startIcon={<Iconify icon="solar:alarm-bold" />}
        onClick={agregarCuenta}
        disabled={previsualizando || diseno.elementos.length >= LIMITES.elementos}
      >
        Cuenta regresiva
      </Button>

      <Button
        size="small"
        color="inherit"
        startIcon={<Iconify icon="solar:widget-bold" />}
        endIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={16} />}
        onClick={menuDeFormas.onOpen}
        disabled={previsualizando || diseno.elementos.length >= LIMITES.elementos}
      >
        Formas
      </Button>

      <Divider orientation="vertical" flexItem />

      <Tooltip title="Deshacer">
        <Box component="span">
          <IconButton size="small" onClick={deshacer} disabled={!sePuedeDeshacer}>
            <Iconify icon="solar:undo-left-round-bold" />
          </IconButton>
        </Box>
      </Tooltip>

      <Tooltip title="Rehacer">
        <Box component="span">
          <IconButton size="small" onClick={rehacer} disabled={!sePuedeRehacer}>
            <Iconify icon="solar:undo-right-round-bold" />
          </IconButton>
        </Box>
      </Tooltip>

      <Tooltip title="Restaurar el diseño original">
        <Box component="span">
          <IconButton size="small" onClick={restaurar} disabled={!hayCambios}>
            <Iconify icon="solar:restart-bold" />
          </IconButton>
        </Box>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      <ToggleButton
        size="small"
        value="cuadricula"
        selected={cuadricula}
        onChange={() => setCuadricula((valor) => !valor)}
        sx={{ border: 'none' }}
      >
        <Iconify icon="solar:widget-4-bold" />
      </ToggleButton>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={dispositivo}
        onChange={(_, valor) => valor && setDispositivo(valor)}
      >
        {DISPOSITIVOS.map((item) => (
          <ToggleButton key={item.id} value={item.id} title={item.etiqueta} sx={{ border: 'none' }}>
            <Iconify icon={item.icono} />
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <ToggleButton
        size="small"
        value="previsualizar"
        // Sin el rotulo, un ojo al lado de tres pantallas parece otro tamaño mas.
        title={
          previsualizando ? 'Salir de la vista previa' : 'Vista previa: así lo verá el cliente'
        }
        aria-label="Vista previa"
        selected={previsualizando}
        onChange={() => {
          setPrevisualizando((valor) => !valor);
          setSeleccionado(null);
        }}
        sx={{ border: 'none' }}
      >
        <Iconify icon="solar:eye-bold" />
      </ToggleButton>

      {/* EL TAMANO, EN LA BARRA Y NO SOLO EN EL PANEL. Es lo que mas se toca
          —sobre todo en las promociones— y tenerlo aqui, al lado del ojo, deja
          probar "mas grande / ver como queda" sin cruzar la pantalla. */}
      {!!elemento && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 150, px: 1 }}>
          <Iconify
            icon={elemento.tipo === 'texto' ? 'solar:text-bold' : 'solar:scale-bold'}
            width={18}
            sx={{ color: 'text.disabled' }}
          />

          <Slider
            size="small"
            min={elemento.tipo === 'texto' ? LIMITES.tamano.min : LIMITES.ancho.min}
            max={elemento.tipo === 'texto' ? LIMITES.tamano.max : LIMITES.ancho.max}
            value={elemento.tipo === 'texto' ? elemento.tamano : elemento.ancho}
            valueLabelDisplay="auto"
            onChange={(_, valor) =>
              cambiarElemento(
                elemento.id,
                elemento.tipo === 'texto' ? { tamano: valor } : { ancho: valor },
                'tamano-barra'
              )
            }
            onChangeCommitted={cerrarGesto}
          />
        </Stack>
      )}

      <Box sx={{ flexGrow: 1 }} />

      <Button size="small" color="inherit" onClick={onCancelar} disabled={guardando}>
        Cancelar
      </Button>

      <Button
        size="small"
        variant="contained"
        loading={guardando}
        onClick={() => onGuardar?.(diseno)}
      >
        Guardar
      </Button>
    </Paper>
  );

  // LA PIEZA SELECCIONADA SE MANEJA DESDE ARRIBA. La capa, el candado y el
  // enlace no son formato —no se ajustan mirando como queda—, son decisiones de
  // un vistazo, y en la columna obligaban a bajar a buscarlas cada vez.
  //
  // La fila esta SIEMPRE, con los controles apagados cuando no hay nada
  // seleccionado: apareciendo y desapareciendo, la barra empujaba el encabezado
  // hacia abajo en cada clic.
  const renderFilaDePieza = () => (
    <Paper
      variant="outlined"
      sx={{ p: 1, mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}
    >
      <Typography variant="caption" sx={{ color: 'text.disabled', pl: 0.5 }}>
        {elemento ? ROTULOS_DE_PANEL[elemento.tipo] : 'Sin selección'}
      </Typography>

      <Divider orientation="vertical" flexItem />

      <Tooltip title="Traer al frente">
        <Box component="span">
          <IconButton size="small" disabled={!elemento} onClick={() => cambiarCapa(elemento, 1)}>
            <Iconify icon="solar:square-arrow-up-bold" />
          </IconButton>
        </Box>
      </Tooltip>

      <Tooltip title="Enviar atrás">
        <Box component="span">
          <IconButton size="small" disabled={!elemento} onClick={() => cambiarCapa(elemento, -1)}>
            <Iconify icon="solar:square-arrow-down-bold" />
          </IconButton>
        </Box>
      </Tooltip>

      <Tooltip title={elemento?.bloqueado ? 'Desbloquear' : 'Bloquear: deja de moverse'}>
        <Box component="span">
          <ToggleButton
            size="small"
            value="bloqueado"
            disabled={!elemento}
            selected={!!elemento?.bloqueado}
            onChange={() => cambiarElemento(elemento.id, { bloqueado: !elemento.bloqueado })}
            sx={{ border: 'none' }}
          >
            <Iconify icon={elemento?.bloqueado ? 'solar:lock-bold' : 'solar:lock-unlocked-bold'} />
          </ToggleButton>
        </Box>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      <TextField
        size="small"
        label="Enlace"
        disabled={!elemento}
        value={elemento?.enlace ?? ''}
        placeholder="/dashboard/product o https://…"
        onChange={(event) => cambiarElemento(elemento.id, { enlace: event.target.value }, 'enlace')}
        onBlur={cerrarGesto}
        sx={{ flexGrow: 1, minWidth: 220 }}
      />

      <Divider orientation="vertical" flexItem />

      {/* LA PROGRAMACION, EN UN FLOTANTE Y NO EN LA FILA. Son dos campos de
          fecha y hora: puestos en linea se comen la barra entera, y ademas no
          se tocan en cada cambio, solo cuando se monta la promocion. El boton
          se enciende cuando hay fechas, para que no se olvide que las tiene. */}
      <Button
        size="small"
        disabled={!elemento}
        onClick={menuDeProgramacion.onOpen}
        color={elemento?.desde || elemento?.hasta ? 'primary' : 'inherit'}
        startIcon={<Iconify icon="solar:calendar-date-bold" />}
        endIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={16} />}
      >
        Programación
      </Button>

      <Tooltip title="Mostrar como botón">
        <Box component="span">
          <ToggleButton
            size="small"
            value="comoBoton"
            disabled={!elemento?.enlace}
            selected={!!elemento?.comoBoton}
            onChange={() => cambiarElemento(elemento.id, { comoBoton: !elemento.comoBoton })}
            sx={{ border: 'none' }}
          >
            <Iconify icon="solar:cursor-square-bold" />
          </ToggleButton>
        </Box>
      </Tooltip>
    </Paper>
  );

  // La paleta se pinta en su propio componente: lleva un flotante dentro —la
  // rueda de color— y ese flotante tiene que vivir donde se usa, o el del
  // dialogo del texto parpadeante quedaria detras de su propia ventana.
  const renderPaleta = (valor, alElegir) => (
    <PaletaDeColores
      valor={valor}
      onElegir={(color, etiqueta) => {
        alElegir(color, etiqueta);

        // Sin etiqueta el gesto termino: lo siguiente que se toque abre su
        // propia entrada de historial.
        if (!etiqueta) cerrarGesto();
      }}
    />
  );

  // EL EFECTO SE ELIGE VIENDOLO, tambien desde el panel. Una lista de nombres
  // obliga a probar uno por uno; aqui cada opcion late con el texto y los
  // colores de verdad. Y es UNO: antes eran dos interruptores que se podian
  // encender a la vez y daban mezclas que nadie eligio.
  const renderEfecto = (item, { conColores = true } = {}) => (
    <Stack spacing={1.5}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Efecto
      </Typography>

      <Box sx={{ gap: 0.75, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {EFECTOS.filter((efecto) => conColores || !efecto.id.startsWith('colores')).map(
          (efecto) => {
            const muestra = sanearElemento({ ...item, efecto: efecto.id, tamano: 14 });
            const elegido = item.efecto === efecto.id;

            return (
              <Box
                key={efecto.id}
                component="button"
                type="button"
                aria-pressed={elegido}
                onClick={() => cambiarElemento(item.id, { efecto: efecto.id })}
                sx={{
                  p: 0.75,
                  minHeight: 46,
                  cursor: 'pointer',
                  borderRadius: 1,
                  bgcolor: 'common.black',
                  border: (theme) =>
                    elegido
                      ? `2px solid ${theme.vars.palette.primary.main}`
                      : `1px solid ${theme.vars.palette.divider}`,
                }}
              >
                <Box
                  sx={{
                    ...elementoACss(muestra),
                    left: 'auto',
                    top: 'auto',
                    width: 'auto',
                    display: 'block',
                    ...(item.tipo === 'texto' ? efectoACss(muestra) : null),
                  }}
                >
                  {item.tipo === 'texto' ? efecto.etiqueta : ''}
                </Box>

                {item.tipo !== 'texto' && (
                  <Typography variant="caption" sx={{ color: 'common.white' }}>
                    {efecto.etiqueta}
                  </Typography>
                )}
              </Box>
            );
          }
        )}
      </Box>

      {conColores && item.efecto.startsWith('colores') && (
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Segundo color
          </Typography>

          {renderPaleta(item.colorSecundario, (colorSecundario, etiqueta) =>
            cambiarElemento(item.id, { colorSecundario }, etiqueta)
          )}
        </Box>
      )}

      {item.efecto !== 'ninguno' && (
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Velocidad (segundos por ciclo)
          </Typography>

          <Slider
            size="small"
            step={0.1}
            min={LIMITES.velocidad.min}
            max={LIMITES.velocidad.max}
            value={item.velocidad}
            valueLabelDisplay="auto"
            onChange={(_, valor) => cambiarElemento(item.id, { velocidad: valor }, 'velocidad')}
            onChangeCommitted={cerrarGesto}
          />
        </Box>
      )}

      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        El movimiento se detiene para quien pidió menos animación en su sistema, y solo se ve al
        previsualizar.
      </Typography>
    </Stack>
  );

  // LO QUE VALE PARA CUALQUIER PIEZA: en que capa esta, si esta bloqueada, si
  // lleva enlace y cuando se ve. Antes vivia repartido por los tres paneles y se
  // desincronizaba en cuanto se tocaba uno.
  const renderComunes = (item) => {
    const cuenta = analiticas?.[item.id];

    return (
      <Stack spacing={2}>
        {!!cuenta && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Resultados
            </Typography>

            <Typography variant="body2">
              {cuenta.impresiones} vista(s) · {cuenta.clics} clic(s)
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={1}>
          <Button
            fullWidth
            size="small"
            color="inherit"
            startIcon={<Iconify icon="solar:copy-bold" />}
            onClick={duplicarTexto}
          >
            Duplicar
          </Button>

          <Button
            fullWidth
            size="small"
            color="error"
            startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
            onClick={eliminarTexto}
          >
            Eliminar
          </Button>
        </Stack>
      </Stack>
    );
  };

  const renderPanelDeImagen = () => (
    <Stack spacing={2}>
      <Box
        component="img"
        alt=""
        src={elemento.url}
        sx={{
          width: 1,
          maxHeight: 120,
          objectFit: 'contain',
          borderRadius: 1,
          bgcolor: 'background.neutral',
        }}
      />

      {/* EL BOTON *ES* LA ETIQUETA DEL CAMPO. Pedirle al navegador que pulse un
          `input` escondido funciona a veces y a veces no; con `label` lo abre el
          propio navegador, siempre. La `key` cambia con la imagen que ya hay,
          asi que volver a elegir el MISMO archivo tambien cuenta como cambio. */}
      <Button
        component="label"
        size="small"
        color="inherit"
        loading={subiendoImagen}
        disabled={!onSubirImagen}
        startIcon={<Iconify icon="solar:gallery-add-bold" />}
      >
        Cambiar imagen
        <input
          hidden
          type="file"
          accept="image/*"
          key={elemento.url || 'sin-imagen'}
          onChange={handleElegirImagen}
        />
      </Button>

      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Tamaño
        </Typography>

        <Slider
          size="small"
          min={LIMITES.ancho.min}
          max={LIMITES.ancho.max}
          value={elemento.ancho}
          valueLabelDisplay="auto"
          onChange={(_, valor) => cambiarElemento(elemento.id, { ancho: valor }, 'ancho')}
          onChangeCommitted={cerrarGesto}
        />
      </Box>
    </Stack>
  );

  // COMO SE ESCRIBE LA CUENTA. No es lo mismo una oferta de dos horas que una
  // campaña de tres semanas: la primera pide un reloj y la segunda, palabras.
  const renderFormatoDeCuenta = () => (
    <Stack spacing={2}>
      <TextField
        select
        fullWidth
        size="small"
        label="Formato"
        value={elemento.formatoCuenta}
        onChange={(event) => cambiarElemento(elemento.id, { formatoCuenta: event.target.value })}
      >
        {FORMATOS_DE_CUENTA.map((formato) => (
          <MenuItem key={formato.id} value={formato.id}>
            {formato.etiqueta}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        fullWidth
        size="small"
        label="Antes del reloj"
        placeholder="Termina en"
        value={elemento.prefijoCuenta}
        onChange={(event) =>
          cambiarElemento(elemento.id, { prefijoCuenta: event.target.value }, 'prefijo')
        }
        onBlur={cerrarGesto}
        helperText="En blanco, solo el reloj."
      />
    </Stack>
  );

  const renderPanelDeTexto = () => (
    <Stack spacing={2}>
      <TextField
        fullWidth
        size="small"
        label={elemento.tipo === 'cuenta' ? 'Texto al terminar' : 'Texto'}
        value={elemento.texto}
        onChange={(event) => cambiarElemento(elemento.id, { texto: event.target.value }, 'texto')}
        onBlur={cerrarGesto}
        slotProps={{ htmlInput: { maxLength: LIMITES.texto } }}
      />

      {/* EMOJIS A UN TOQUE. El campo acepta cualquiera —del teclado del movil o
          pegado—; esto solo evita ir a buscarlos fuera. Se anaden al final, que
          es donde se ponen en un rotulo. */}
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {EMOJIS.map((emoji) => (
          <Box
            key={emoji}
            component="button"
            type="button"
            aria-label={`Agregar ${emoji}`}
            onClick={() => cambiarElemento(elemento.id, { texto: `${elemento.texto} ${emoji}` })}
            sx={{
              px: 0.5,
              py: 0.25,
              fontSize: 16,
              lineHeight: 1,
              cursor: 'pointer',
              borderRadius: 0.75,
              bgcolor: 'transparent',
              border: (theme) => `1px solid ${theme.vars.palette.divider}`,
            }}
          >
            {emoji}
          </Box>
        ))}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <ToggleButtonGroup size="small">
          <ToggleButton
            value="negrita"
            selected={elemento.negrita}
            onChange={() => cambiarElemento(elemento.id, { negrita: !elemento.negrita })}
          >
            <Iconify icon="solar:text-bold-bold" />
          </ToggleButton>

          <ToggleButton
            value="cursiva"
            selected={elemento.cursiva}
            onChange={() => cambiarElemento(elemento.id, { cursiva: !elemento.cursiva })}
          >
            <Iconify icon="solar:text-italic-bold" />
          </ToggleButton>

          <ToggleButton
            value="subrayado"
            selected={elemento.subrayado}
            onChange={() => cambiarElemento(elemento.id, { subrayado: !elemento.subrayado })}
          >
            <Iconify icon="solar:text-underline-bold" />
          </ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup
          exclusive
          size="small"
          value={elemento.alineacion}
          onChange={(_, valor) => valor && cambiarElemento(elemento.id, { alineacion: valor })}
        >
          <ToggleButton value="left">
            <Iconify icon="solar:align-left-bold" />
          </ToggleButton>
          <ToggleButton value="center">
            <Iconify icon="solar:align-horizontal-center-bold" />
          </ToggleButton>
          <ToggleButton value="right">
            <Iconify icon="solar:align-right-bold" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Tamaño
        </Typography>

        <Slider
          size="small"
          min={LIMITES.tamano.min}
          max={LIMITES.tamano.max}
          value={elemento.tamano}
          valueLabelDisplay="auto"
          onChange={(_, valor) => cambiarElemento(elemento.id, { tamano: valor }, 'tamano')}
          onChangeCommitted={cerrarGesto}
        />
      </Box>

      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Ancho del bloque
          </Typography>

          <Button size="small" color="inherit" onClick={() => ajustarAlContenido(elemento)}>
            Ajustar al texto
          </Button>
        </Stack>

        <Slider
          size="small"
          min={LIMITES.ancho.min}
          max={LIMITES.ancho.max}
          value={elemento.ancho}
          valueLabelDisplay="auto"
          onChange={(_, valor) => cambiarElemento(elemento.id, { ancho: valor }, 'ancho')}
          onChangeCommitted={cerrarGesto}
        />

        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          También se arrastra el borde derecho del recuadro; con doble clic ahí, se ajusta al texto.
        </Typography>
      </Box>

      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Color del texto
        </Typography>

        {renderPaleta(elemento.color, (color, etiqueta) =>
          cambiarElemento(elemento.id, { color }, etiqueta)
        )}
      </Box>
    </Stack>
  );

  // LINEAS Y FORMAS. Un rotulo se arma separando y enmarcando, no solo
  // escribiendo: la raya que parte el titulo del lema, o el recuadro de color
  // detras de una promocion.
  const renderPanelDeFigura = () => (
    <Stack spacing={2}>
      {elemento.tipo === 'forma' && (
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={elemento.forma}
          onChange={(_, valor) => valor && cambiarElemento(elemento.id, { forma: valor })}
        >
          <ToggleButton value="rectangulo">
            <Iconify icon="solar:widget-bold" sx={{ mr: 0.5 }} />
            Rectángulo
          </ToggleButton>

          <ToggleButton value="circulo">
            <Iconify icon="solar:record-bold" sx={{ mr: 0.5 }} />
            Círculo
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Largo
        </Typography>

        <Slider
          size="small"
          min={LIMITES.ancho.min}
          max={LIMITES.ancho.max}
          value={elemento.ancho}
          valueLabelDisplay="auto"
          onChange={(_, valor) => cambiarElemento(elemento.id, { ancho: valor }, 'ancho')}
          onChangeCommitted={cerrarGesto}
        />
      </Box>

      {elemento.tipo === 'linea' ? (
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Grosor
          </Typography>

          <Slider
            size="small"
            min={LIMITES.grosor.min}
            max={LIMITES.grosor.max}
            value={elemento.grosor}
            valueLabelDisplay="auto"
            onChange={(_, valor) => cambiarElemento(elemento.id, { grosor: valor }, 'grosor')}
            onChangeCommitted={cerrarGesto}
          />
        </Box>
      ) : (
        <>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Alto
            </Typography>

            <Slider
              size="small"
              min={LIMITES.alto.min}
              max={LIMITES.alto.max}
              value={elemento.alto}
              valueLabelDisplay="auto"
              onChange={(_, valor) => cambiarElemento(elemento.id, { alto: valor }, 'alto')}
              onChangeCommitted={cerrarGesto}
            />
          </Box>

          {elemento.forma === 'rectangulo' && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Esquinas redondeadas
              </Typography>

              <Slider
                size="small"
                min={LIMITES.radio.min}
                max={LIMITES.radio.max}
                value={elemento.radio}
                valueLabelDisplay="auto"
                onChange={(_, valor) => cambiarElemento(elemento.id, { radio: valor }, 'radio')}
                onChangeCommitted={cerrarGesto}
              />
            </Box>
          )}
        </>
      )}

      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Color
        </Typography>

        {renderPaleta(elemento.color, (color, etiqueta) =>
          cambiarElemento(elemento.id, { color }, etiqueta)
        )}
      </Box>
    </Stack>
  );

  const renderPanelDeFondo = () => (
    <Stack spacing={2}>
      <TextField
        select
        fullWidth
        size="small"
        label="Fondo"
        value={diseno.fondo.tipo}
        onChange={(event) => cambiarFondo({ tipo: event.target.value })}
      >
        <MenuItem value="plano">Color plano</MenuItem>
        <MenuItem value="degradado">Degradado</MenuItem>
        <MenuItem value="sombra">Sombra</MenuItem>
      </TextField>

      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          {diseno.fondo.tipo === 'plano' ? 'Color' : 'Color inicial'}
        </Typography>

        {renderPaleta(diseno.fondo.color, (color, etiqueta) => cambiarFondo({ color }, etiqueta))}
      </Box>

      {diseno.fondo.tipo !== 'plano' && (
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Color final
          </Typography>

          {renderPaleta(diseno.fondo.colorSecundario, (colorSecundario, etiqueta) =>
            cambiarFondo({ colorSecundario }, etiqueta)
          )}
        </Box>
      )}

      {diseno.fondo.tipo === 'degradado' && (
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Ángulo
          </Typography>

          <Slider
            size="small"
            min={LIMITES.angulo.min}
            max={LIMITES.angulo.max}
            value={diseno.fondo.angulo}
            valueLabelDisplay="auto"
            onChange={(_, valor) => cambiarFondo({ angulo: valor }, 'angulo')}
            onChangeCommitted={cerrarGesto}
          />
        </Box>
      )}

      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Opacidad {fotoUrl ? '(deja ver la fotografía)' : ''}
        </Typography>

        <Slider
          size="small"
          min={0}
          max={1}
          step={0.05}
          value={diseno.fondo.opacidad}
          valueLabelDisplay="auto"
          onChange={(_, valor) => cambiarFondo({ opacidad: valor }, 'opacidad')}
          onChangeCommitted={cerrarGesto}
        />
      </Box>

      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Altura del encabezado
        </Typography>

        <Slider
          size="small"
          min={LIMITES.altura.min}
          max={LIMITES.altura.max}
          value={diseno.altura}
          valueLabelDisplay="auto"
          onChange={(_, valor) => aplicar((actual) => ({ ...actual, altura: valor }), 'altura')}
          onChangeCommitted={cerrarGesto}
        />
      </Box>
    </Stack>
  );

  return (
    <Box>
      {renderBarra()}

      {!previsualizando && renderFilaDePieza()}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: 'flex',
            justifyContent: 'center',
            // El ancho del dispositivo elegido. No es una simulacion: es el
            // mismo lienzo estrechado, con sus porcentajes y su `clamp`, que es
            // exactamente lo que hara el telefono de quien entre a la tienda.
            ...(anchoDelDispositivo && { py: 1, bgcolor: 'background.neutral', borderRadius: 2 }),
          }}
        >
          <HeaderVisualCanvas
            ref={lienzoRef}
            diseno={diseno}
            fotoUrl={fotoUrl}
            // El parpadeo y el multicolor solo se mueven al previsualizar: con el
            // texto latiendo no hay forma de arrastrarlo ni de leer lo que dice.
            animaciones={previsualizando}
            // Al colocar se ve TODO: una promocion que empieza el viernes hay que
            // poder ponerla hoy en su sitio.
            mostrarProgramados={!previsualizando}
            slotElemento={renderElemento}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            // SOLO EL FONDO DESELECCIONA. Antes deseleccionaba cualquier clic que
            // llegara hasta aqui —incluido el que acababa de elegir un texto—, asi
            // que el panel de formato solo se veia mientras se mantenia pulsado y
            // desaparecia al soltar. `stopPropagation` en el `pointerdown` no
            // detiene el `click`, que se dispara despues: hay que mirar de donde
            // salio.
            onClick={(event) => {
              if (event.target === event.currentTarget) setSeleccionado(null);
            }}
            sx={{
              borderRadius: 2,
              width: anchoDelDispositivo || 1,
              maxWidth: 1,
              flexShrink: 0,
              // LA CUADRICULA VA ENCIMA DEL FONDO, no dentro del modelo: es una
              // ayuda para colocar, no algo que se guarde ni que vea el cliente.
              ...(cuadricula &&
                !previsualizando && {
                  '&::after': {
                    inset: 0,
                    content: '""',
                    position: 'absolute',
                    pointerEvents: 'none',
                    backgroundSize: `${100 / PASOS_DE_CUADRICULA}% ${100 / PASOS_DE_CUADRICULA}%`,
                    backgroundImage:
                      'linear-gradient(to right, rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.14) 1px, transparent 1px)',
                  },
                }),
            }}
          >
            {/* Solo mientras se arrastra: el resto del tiempo es una franja que
              tapa lo que se esta colocando. */}
            {arrastrando && (
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  right: 0,
                  gap: 1,
                  zIndex: 200,
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  position: 'absolute',
                  justifyContent: 'center',
                  height: ALTO_DE_PAPELERA,
                  color: 'common.white',
                  transition: (theme) => theme.transitions.create(['background-color']),
                  bgcolor: (theme) =>
                    varAlpha(theme.vars.palette.error.mainChannel, sobrePapelera ? 0.88 : 0.35),
                }}
              >
                <Iconify icon="solar:trash-bin-trash-bold" width={24} />

                <Typography variant="subtitle2">
                  {sobrePapelera ? 'Suelta para eliminar' : 'Arrastra aquí para eliminar'}
                </Typography>
              </Box>
            )}
          </HeaderVisualCanvas>
        </Box>

        {/* TODO LO DEL ELEMENTO, EN LA MISMA COLUMNA Y EN DOS PESTAnAS. Repartirlo
            entre la columna y una tarjeta debajo obligaba a mirar a dos sitios
            para tocar la misma pieza. "Formato" es como se ve —lo que se ajusta
            a ojo, mirando el encabezado— y "Ajustes" lo que se decide: efecto,
            capa, enlace y fechas. */}
        <Card sx={{ width: { xs: 1, md: 320 }, flexShrink: 0, alignSelf: 'flex-start' }}>
          <Typography variant="subtitle2" sx={{ p: 2, pb: 1 }}>
            {ROTULOS_DE_PANEL[elemento?.tipo] ?? 'Fondo del encabezado'}
          </Typography>

          {/* LAS DOS PESTAnAS ESTAN SIEMPRE, y "Ajustes" se apaga cuando no hay
              nada seleccionado. Apareciendo y desapareciendo, el panel entero
              daba un salto cada vez que se pulsaba o se soltaba una pieza. */}
          <Tabs
            value={pestanaActiva}
            onChange={(_, valor) => setPestana(valor)}
            sx={{ px: 2, borderBottom: (theme) => `solid 1px ${theme.vars.palette.divider}` }}
          >
            <Tab value="formato" label="Formato" />
            <Tab value="ajustes" label="Ajustes" disabled={!elemento} />
          </Tabs>

          {/* LAS DOS PESTAnAS OCUPAN LA MISMA CELDA, y la que no toca se queda
              invisible en vez de irse. Asi el panel mide siempre lo que mide la
              mas larga y no cambia de alto al cambiar de pestaña: antes el
              encabezado de al lado daba un salto en cada cambio.

              Se usa `visibility` y no `display: none` a proposito: `none` la
              sacaria del flujo y volveria a encogerse el panel. Invisible sigue
              contando para el tamaño, pero no recibe el foco ni la lee un lector
              de pantalla. */}
          <Box sx={{ p: 2, display: 'grid' }}>
            {[
              {
                clave: 'formato',
                contenido: (
                  <>
                    {elemento?.tipo === 'imagen' && renderPanelDeImagen()}
                    {(elemento?.tipo === 'texto' || elemento?.tipo === 'cuenta') &&
                      renderPanelDeTexto()}
                    {(elemento?.tipo === 'linea' || elemento?.tipo === 'forma') &&
                      renderPanelDeFigura()}
                    {!elemento && renderPanelDeFondo()}

                    {!elemento && (
                      <Typography
                        variant="caption"
                        sx={{ mt: 2, display: 'block', color: 'text.disabled' }}
                      >
                        Pulsa un texto o el escudo para darle formato. Arrástralo para moverlo, o
                        muévelo con las flechas del teclado.
                      </Typography>
                    )}
                  </>
                ),
              },
              {
                clave: 'ajustes',
                contenido: !!elemento && (
                  <Stack spacing={3}>
                    {renderEfecto(elemento, { conColores: elemento.tipo !== 'imagen' })}

                    {elemento.tipo === 'cuenta' && renderFormatoDeCuenta()}

                    {renderComunes(elemento)}
                  </Stack>
                ),
              },
            ].map((panel) => (
              <Box
                key={panel.clave}
                sx={{
                  gridArea: '1 / 1',
                  minWidth: 0,
                  ...(pestanaActiva !== panel.clave && {
                    visibility: 'hidden',
                    pointerEvents: 'none',
                  }),
                }}
              >
                {panel.contenido}
              </Box>
            ))}
          </Box>
        </Card>
      </Stack>

      <CustomPopover
        open={menuDeProgramacion.open}
        anchorEl={menuDeProgramacion.anchorEl}
        onClose={menuDeProgramacion.onClose}
        slotProps={{ arrow: { placement: 'top-center' } }}
      >
        {!!elemento && (
          <Stack spacing={2} sx={{ p: 2, width: 300 }}>
            <DateTimePicker
              ampm
              label="Desde"
              format="DD/MM/YYYY hh:mm A"
              value={aCalendario(elemento.desde)}
              onChange={(valor) => cambiarElemento(elemento.id, { desde: deCalendario(valor) })}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />

            <DateTimePicker
              ampm
              label={elemento.tipo === 'cuenta' ? 'Termina (y hasta cuándo se ve)' : 'Hasta'}
              format="DD/MM/YYYY hh:mm A"
              value={aCalendario(elemento.hasta)}
              onChange={(valor) => cambiarElemento(elemento.id, { hasta: deCalendario(valor) })}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />

            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              En blanco, siempre visible. Fuera de esas fechas deja de verse, pero no se borra:
              sirve para el año que viene.
            </Typography>

            {(!!elemento.desde || !!elemento.hasta) && (
              <Button
                size="small"
                color="inherit"
                startIcon={<Iconify icon="solar:eraser-bold" />}
                onClick={() => cambiarElemento(elemento.id, { desde: '', hasta: '' })}
              >
                Quitar las fechas
              </Button>
            )}
          </Stack>
        )}
      </CustomPopover>

      <CustomPopover
        open={menuDeFormas.open}
        anchorEl={menuDeFormas.anchorEl}
        onClose={menuDeFormas.onClose}
      >
        <MenuList>
          {[
            { forma: 'rectangulo', etiqueta: 'Rectángulo', icono: 'solar:widget-bold' },
            { forma: 'circulo', etiqueta: 'Círculo', icono: 'solar:record-bold' },
            { forma: 'linea', etiqueta: 'Línea', icono: 'solar:minus-square-bold' },
          ].map((opcion) => (
            <MenuItem
              key={opcion.forma}
              onClick={() => {
                menuDeFormas.onClose();
                agregarFigura(opcion.forma === 'linea' ? 'linea' : 'forma', opcion.forma);
              }}
            >
              <Iconify icon={opcion.icono} />
              {opcion.etiqueta}
            </MenuItem>
          ))}
        </MenuList>
      </CustomPopover>

      <TextoParpadeanteDialogo
        abierto={eligiendoEfecto}
        paleta={renderPaleta}
        onCancelar={() => setEligiendoEfecto(false)}
        onAgregar={(propuesta) => {
          setEligiendoEfecto(false);
          agregarTexto(propuesta);
        }}
      />
    </Box>
  );
}
