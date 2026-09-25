import { memo, useRef } from 'react';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { imagenDeInsignia } from 'src/utils/insignias-de-premios.mjs';

import { Iconify } from 'src/components/iconify';
import { FileThumbnail } from 'src/components/file-thumbnail';

import { getCustomFileIcon } from './utils/get-file-icon';
import { FileItem, FileItemActions, FileItemActionOverlay } from './awards-manager-file-item-slots';

// ----------------------------------------------------------------------
// TARJETA DE INSIGNIA DE UN PREMIO (vista de cuadrícula).
//
// La forma que van a tener todas las carpetas de premios: vertical, del mismo
// alto siempre, con la insignia arriba y el nombre entero debajo (hasta dos
// líneas, partido por palabras), sin el estado. Hoy solo la usan las carpetas de
// `src/utils/insignias-de-premios.mjs`; para llevarla a otra basta con darle
// allí su ruta de imágenes. Sin imagen se queda el icono del PDF en el mismo
// hueco, así que una carpeta a medias no se descuadra.
//
// Toda la tarjeta abre el panel de detalles del premio, INSIGNIA INCLUIDA: antes
// la imagen quedaba por encima de la capa que recoge el clic y pulsarla no hacía
// nada. Solo la estrella y el menú (⋮) hacen otra cosa.
// ----------------------------------------------------------------------

export const TARJETA_INSIGNIA = {
  alto: 152,
  insignia: 72,
  anchoMinimo: 118,
  // Premio sin completar: la insignia un 15 % transparente (1 = opaca).
  opacidadSinCompletar: 0.60,
  // Premio completado: check verde en la esquina superior izquierda; amarillo
  // si está completado pero todavía sin certificado.
  iconoCompletado: 'solar:check-circle-bold',
  colorCompletado: 'success.main',
  colorCompletadoSinCertificado: 'warning.main',
  // Aviso al pasar por encima del check (o al dejarlo pulsado en el móvil).
  textoConCertificado: 'Certificado cargado',
  textoSinCertificado: 'Falta agregar certificado',
  // Tarjeta de un premio completado: su borde, en vez del gris de siempre.
  colorBordeCompletado: 'success.main',
  // Tarjeta seleccionada (Ctrl/Cmd + clic): borde de este color.
  colorSeleccionada: 'primary.main',
  // En el móvil, dejar pulsada la tarjeta este tiempo (ms) empieza a seleccionar.
  pulsacionLargaMs: 450,
  // Veces ganado ("x2") debajo del nombre: tamaño y color del texto.
  tamanoVeces: 10,
  colorVeces: 'text.disabled',
  tamanoCompletado: 20,
};

/** Columnas de la cuadrícula de insignias: 3 en el móvil, y luego las que quepan. */
export const COLUMNAS_DE_INSIGNIAS = {
  xs: 'repeat(3, 1fr)',
  sm: `repeat(auto-fill, minmax(${TARJETA_INSIGNIA.anchoMinimo}px, 1fr))`,
};

/** El hueco entre tarjetas: menor en el móvil para que quepan las tres. */
export const HUECO_DE_INSIGNIAS = { xs: 1.5, sm: 2.5 };

/**
 * La imagen de un premio: su insignia de `public/sistemaAscenso` o, si no tiene,
 * el icono propio del premio (los de Academia Ministerial), o `null` (sale el
 * icono del PDF en el mismo hueco).
 */
export const imagenDelPremio = (premio) =>
  imagenDeInsignia(premio?.parentId, premio?.name) ||
  getCustomFileIcon({ id: premio?.type === 'folder' ? null : premio?.id })?.src ||
  null;

/** El color del check: verde con certificado, amarillo sin él. */
export const colorDelCheck = (tieneCertificado) =>
  tieneCertificado
    ? TARJETA_INSIGNIA.colorCompletado
    : TARJETA_INSIGNIA.colorCompletadoSinCertificado;

/**
 * El check de "completado" con su aviso: verde "Certificado cargado", amarillo
 * "Falta agregar certificado". Sin el aviso, el color no se entendía.
 */
export function CheckDeCompletado({ tieneCertificado = false, width, onClick, sx }) {
  const texto = tieneCertificado
    ? TARJETA_INSIGNIA.textoConCertificado
    : TARJETA_INSIGNIA.textoSinCertificado;

  return (
    <Tooltip title={texto} arrow placement="top" enterTouchDelay={300}>
      <Box
        component="span"
        aria-label={`Completado. ${texto}`}
        onClick={onClick}
        sx={[
          {
            zIndex: 2,
            display: 'inline-flex',
            position: 'absolute',
            cursor: onClick ? 'pointer' : 'help',
            color: colorDelCheck(tieneCertificado),
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <Iconify icon={TARJETA_INSIGNIA.iconoCompletado} width={width} />
      </Box>
    </Tooltip>
  );
}

function TarjetaDeInsignia({
  file,
  selected,
  onSelect,
  favorited,
  onToggleFavorite,
  onOpen,
  openMenu,
  onOpenMenu,
  // Hay algo seleccionado: en el móvil, un toque marca o desmarca.
  modoSeleccion = false,
  sx,
  ...other
}) {
  const completado = file.status === 'completado';
  const veces = completado ? Number(file.vecesGanado) || 0 : 0;

  // SELECCIÓN EN EL MÓVIL. Allí no hay Ctrl: dejar la tarjeta pulsada un
  // momento (menos de un segundo) la selecciona y abre el modo selección; en él,
  // un toque marca o desmarca. El ratón sigue con Ctrl/Cmd + clic.
  const temporizador = useRef(null);
  const pulsadaLarga = useRef(false);
  const tactil = useRef(false);
  const inicio = useRef({ x: 0, y: 0 });

  const cancelarPulsacion = () => {
    clearTimeout(temporizador.current);
    temporizador.current = null;
  };

  const alPulsar = (event) => {
    tactil.current = event.pointerType !== 'mouse';
    pulsadaLarga.current = false;
    if (!tactil.current || !onSelect) return;
    inicio.current = { x: event.clientX, y: event.clientY };
    temporizador.current = setTimeout(() => {
      pulsadaLarga.current = true;
      temporizador.current = null;
      onSelect();
      navigator.vibrate?.(15);
    }, TARJETA_INSIGNIA.pulsacionLargaMs);
  };

  // Si el dedo se desplaza (está haciendo scroll), no es una pulsación larga.
  const alMover = (event) => {
    if (!temporizador.current) return;
    const dx = Math.abs(event.clientX - inicio.current.x);
    const dy = Math.abs(event.clientY - inicio.current.y);
    if (dx > 8 || dy > 8) cancelarPulsacion();
  };

  const alTocar = (event) => {
    // El "clic" que llega al soltar una pulsación larga ya seleccionó.
    if (pulsadaLarga.current) {
      pulsadaLarga.current = false;
      return;
    }
    if (onSelect && ((event.ctrlKey || event.metaKey) || (tactil.current && modoSeleccion))) {
      onSelect();
      return;
    }
    onOpen?.();
  };

  const abrirConTeclado = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen?.();
    }
  };

  return (
    <FileItem
      variant="outlined"
      selected={selected}
      sx={[
        {
          height: TARJETA_INSIGNIA.alto,
          ...(completado && { borderColor: TARJETA_INSIGNIA.colorBordeCompletado }),
          ...(selected && {
            outline: '2px solid',
            outlineOffset: -2,
            outlineColor: TARJETA_INSIGNIA.colorSeleccionada,
          }),
          pt: 4,
          pb: 1.5,
          // Al dejarla pulsada en el móvil no se selecciona texto ni sale el
          // menú de la imagen.
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          px: 1,
          gap: 0.75,
          alignItems: 'center',
          textAlign: 'center',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <FileItemActionOverlay
        role="button"
        tabIndex={0}
        aria-label={`Ver ${file.name}`}
        // Ctrl (o Cmd en Mac) + clic, o pulsación larga en el móvil, selecciona
        // la tarjeta para completar varias de una vez; el clic normal abre el panel.
        onClick={alTocar}
        onPointerDown={alPulsar}
        onPointerMove={alMover}
        onPointerUp={cancelarPulsacion}
        onPointerLeave={cancelarPulsacion}
        onPointerCancel={cancelarPulsacion}
        onContextMenu={(event) => {
          if (tactil.current) event.preventDefault();
        }}
        onKeyDown={abrirConTeclado}
      />

      {completado && (
        // Pulsarlo hace lo mismo que pulsar la tarjeta (abrir o seleccionar).
        <CheckDeCompletado
          tieneCertificado={file.tieneCertificado}
          width={TARJETA_INSIGNIA.tamanoCompletado}
          onClick={alTocar}
          sx={{ top: 8, left: 8 }}
        />
      )}

      {/* Sin eventos propios: el clic cae en la capa de debajo y abre el panel. */}
      <Box
        sx={{
          width: TARJETA_INSIGNIA.insignia,
          height: TARJETA_INSIGNIA.insignia,
          flexShrink: 0,
          display: 'inline-flex',
          pointerEvents: 'none',
          opacity: completado ? 1 : TARJETA_INSIGNIA.opacidadSinCompletar,
          transition: 'opacity 200ms ease',
        }}
      >
        {file.imagenInsignia ? (
          <Box
            component="img"
            alt=""
            loading="lazy"
            decoding="async"
            src={file.imagenInsignia}
            sx={{ width: 1, height: 1, objectFit: 'contain' }}
          />
        ) : (
          <FileThumbnail file={file.type} sx={{ width: 1, height: 1 }} />
        )}
      </Box>

      <Typography
        variant="subtitle2"
        sx={(theme) => ({
          width: 1,
          fontSize: 12,
          lineHeight: 1.25,
          pointerEvents: 'none',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          ...theme.mixins.maxLine({ line: 2 }),
          // Siempre el alto de dos líneas: con una sola, las tarjetas no bailan.
          height: '2.5em',
        })}
      >
        {file.name}
      </Typography>

      {/* Veces ganado, debajo del nombre y sin mover nada: va en el margen de
          abajo de la tarjeta. */}
      {veces > 0 && (
        <Typography
          component="span"
          sx={{
            left: 0,
            right: 0,
            bottom: 2,
            lineHeight: 1,
            position: 'absolute',
            pointerEvents: 'none',
            fontWeight: 600,
            fontSize: TARJETA_INSIGNIA.tamanoVeces,
            color: TARJETA_INSIGNIA.colorVeces,
          }}
        >
          x{veces}
        </Typography>
      )}

      {/* Más pequeñas y pegadas a la esquina para no pisar la insignia. */}
      <FileItemActions
        sx={{ top: 2, right: 2, '& .MuiButtonBase-root': { p: 0.5 } }}
        id={file.id}
        checked={favorited}
        onChange={onToggleFavorite}
        openMenu={openMenu}
        onOpenMenu={onOpenMenu}
      />
    </FileItem>
  );
}

// Memorizada: al seleccionar con Ctrl o completar, solo se repinta la tarjeta
// que cambió, no las 59. Se compara lo que se VE; las funciones se ignoran
// porque hacen siempre lo mismo para el mismo premio (la de seleccionar ya no
// depende de la lista, ver `useTable`), y la del favorito cambia con `favorited`.
const mismaTarjeta = (antes, despues) =>
  antes.selected === despues.selected &&
  antes.favorited === despues.favorited &&
  antes.openMenu === despues.openMenu &&
  antes.modoSeleccion === despues.modoSeleccion &&
  antes.file.vecesGanado === despues.file.vecesGanado &&
  antes.sx === despues.sx &&
  antes.file.id === despues.file.id &&
  antes.file.name === despues.file.name &&
  antes.file.type === despues.file.type &&
  antes.file.status === despues.file.status &&
  antes.file.tieneCertificado === despues.file.tieneCertificado &&
  antes.file.imagenInsignia === despues.file.imagenInsignia;

export const AwardsInsigniaItem = memo(TarjetaDeInsignia, mismaTarjeta);

// ----------------------------------------------------------------------

/**
 * La insignia de un premio fuera de la tarjeta (fila de la lista, panel lateral): la misma imagen, transparencia
 * y check verde que la tarjeta de la cuadrícula, a tamaño de fila. `null` si
 * no hay imagen, el icono del PDF en su lugar.
 */
export function InsigniaDePremio({
  src,
  completado = false,
  tieneCertificado = false,
  // En la lista va sin transparencia (la fila ya dice el estado al lado).
  conTransparencia = true,
  tamano = 40,
  tamanoCheck = 14,
  sx,
}) {
  return (
    <Box
      sx={[
        { position: 'relative', width: tamano, height: tamano, flexShrink: 0 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {/* Sin imagen, el icono del PDF en el mismo hueco (y el check igual). */}
      <Box
        sx={{
          width: 1,
          height: 1,
          display: 'flex',
          opacity: completado || !conTransparencia ? 1 : TARJETA_INSIGNIA.opacidadSinCompletar,
          transition: 'opacity 200ms ease',
        }}
      >
        {src ? (
          <Box
            component="img"
            alt=""
            loading="lazy"
            decoding="async"
            src={src}
            sx={{ width: 1, height: 1, objectFit: 'contain' }}
          />
        ) : (
          <FileThumbnail file="pdf" sx={{ width: 1, height: 1 }} />
        )}
      </Box>
      {completado && (
        <CheckDeCompletado
          tieneCertificado={tieneCertificado}
          width={tamanoCheck}
          sx={{ top: -4, left: -4, borderRadius: '50%', bgcolor: 'background.paper' }}
        />
      )}
    </Box>
  );
}
