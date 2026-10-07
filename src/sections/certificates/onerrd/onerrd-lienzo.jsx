import { memo, useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import {
  acotarPosicion,
  pesoDeCampoOnerrd,
  claveDeValorOnerrd,
  INTERLINEADO_ONERRD,
  acotarRotacionOnerrd,
  cssDeDegradadoOnerrd,
  seEscribeEnElLienzoOnerrd,
  desplazamientosDeContorno,
} from 'src/utils/certificado-onerrd.mjs';

import { Iconify } from 'src/components/iconify';

import { cssDeFuenteOnerrd } from './imagenes-onerrd';

// ----------------------------------------------------------------------
// LIENZO DEL CERTIFICADO ONERRD: el fondo y, encima, los elementos que se
// arrastran (centro) y se estiran (asas). Todo en % de la página; el texto se
// mide en `cqw` (ancho del contenedor), así la vista previa escala igual que
// el PDF a cualquier tamaño de pantalla.
//
// Atajos con un elemento elegido: flechas = mover 0,2 % (Mayús = 1 %).
// Arrastrar no pega a nada, salvo a la cuadrícula si está a la vista (con Alt,
// tampoco). Antes se pegaba al centro de la hoja: un texto alineado a la
// izquierda cerca del medio saltaba solo a la línea roja y no se podía dejar
// donde se quería. Para centrar está el botón "Centrar en la hoja".
//
// Los textos del registro se escriben DENTRO de su caja (doble clic o Intro):
// antes se cambiaban en un campo debajo del lienzo que solo era de ejemplo, y
// lo escrito ahí no llegaba al PDF.
// ----------------------------------------------------------------------

const PROPORCION_DE_RESERVA = 0.4; // ranura de firma sin firma elegida

// Dos decimales: más precisión no se nota y llenaba los campos de números largos.
const ancho2 = (valor) => Math.round(Math.min(100, Math.max(2, valor)) * 100) / 100;

// Cuadrícula: una línea cada cuarto de pulgada (18 pt) y una más marcada cada
// pulgada. En puntos, para que las celdas sean cuadradas en una hoja apaisada.
const CELDA_PT = 18;
const CELDAS_POR_PULGADA = 4;

// Con la cuadrícula a la vista, el centro se pega a la línea más cercana.
const pegarACuadricula = (valor, pasoPct) => Math.round(valor / pasoPct) * pasoPct;

function Asa({ cursor, sx, onPointerDown }) {
  return (
    <Box
      onPointerDown={onPointerDown}
      sx={{
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 0.5,
        bgcolor: 'common.white',
        border: (theme) => `2px solid ${theme.vars.palette.primary.main}`,
        cursor,
        zIndex: 3,
        touchAction: 'none',
        ...sx,
      }}
    />
  );
}

function LienzoOnerrdBase({
  pagina,
  fondo,
  imagen,
  diseno,
  firmasPorId,
  qr,
  iconoRegion,
  nombreRegion,
  textos,
  valores,
  seleccion,
  modoVista,
  cuadricula,
  onSeleccionar,
  onCambiarElemento,
  onCambiarValor,
  onSubirFondo,
  // La factura: hoja en blanco (sin plantilla) y sus propios elementos (tabla,
  // sello, raya), que pinta quien la usa con las mismas herramientas.
  paginaEnBlanco = false,
  renderExtras,
}) {
  const lienzoRef = useRef(null);
  const [editando, setEditando] = useState(null); // id del texto que se escribe
  const unidad = 100 / pagina.ancho; // cqw por punto
  const verCuadricula = cuadricula && !modoVista;
  const pasoX = (CELDA_PT / pagina.ancho) * 100;
  const pasoY = (CELDA_PT / pagina.alto) * 100;

  // Elegir otra cosa (o pasar a "Ver resultado") cierra la escritura.
  useEffect(() => {
    if (modoVista || seleccion?.tipo !== 'campo' || seleccion?.id !== editando) setEditando(null);
  }, [seleccion, modoVista, editando]);

  const terminarDeEscribir = () => {
    setEditando(null);
    lienzoRef.current?.focus({ preventScroll: true });
  };

  const esElegido = (tipo, id) => seleccion?.tipo === tipo && seleccion?.id === id;

  // Arrastre genérico: `alMover(dxPct, dyPct, evento)` con el desplazamiento
  // en % del lienzo desde que se pulsó. Un movimiento de menos de 3 px es un
  // clic, no un arrastre (no mueve nada al solo elegir).
  const arrastrar = useCallback((evento, alMover) => {
    const rect = lienzoRef.current?.getBoundingClientRect();
    if (!rect || evento.button > 0) return;
    evento.preventDefault();
    evento.stopPropagation();
    // `preventDefault` impide que el clic enfoque el lienzo, y sin foco las
    // flechas no mueven el elemento elegido.
    lienzoRef.current?.focus({ preventScroll: true });

    const inicioX = evento.clientX;
    const inicioY = evento.clientY;
    let movido = false;
    let cuadro = 0;
    let pendiente = null;

    const aplicar = (ev) =>
      alMover(
        ((ev.clientX - inicioX) / rect.width) * 100,
        ((ev.clientY - inicioY) / rect.height) * 100,
        ev,
        rect
      );

    // Un cambio por fotograma: el ratón manda más eventos de los que se pintan.
    const mover = (ev) => {
      if (!movido && Math.hypot(ev.clientX - inicioX, ev.clientY - inicioY) < 3) return;
      movido = true;
      pendiente = ev;
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        pendiente = null;
        aplicar(ev);
      });
    };
    const soltar = (ev) => {
      cancelAnimationFrame(cuadro);
      // Si se suelta antes del siguiente fotograma, el último movimiento aún
      // no se había aplicado: cancelarlo dejaba el elemento donde no se soltó
      // (un arrastre rápido "no hacía nada").
      // Un `pointercancel` no trae coordenadas fiables: solo se aplica lo pendiente.
      if (movido && (pendiente || ev.type === 'pointerup')) aplicar(pendiente || ev);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
    };

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
  }, []);

  const empezarMover = (tipo, id, elemento) => (evento) => {
    onSeleccionar({ tipo, id });
    const { x: x0, y: y0 } = elemento;
    arrastrar(evento, (dx, dy, ev) => {
      const pegado = verCuadricula && !ev.altKey;
      const x = pegado ? pegarACuadricula(x0 + dx, pasoX) : x0 + dx;
      const y = pegado ? pegarACuadricula(y0 + dy, pasoY) : y0 + dy;
      onCambiarElemento(tipo, id, { x: acotarPosicion(x), y: acotarPosicion(y) });
    });
  };

  // Imagen y firma: el asa cambia el ancho (y el alto con él, por proporción).
  // Crece hacia los dos lados porque el punto guardado es el centro.
  const empezarEstirarImagen = (tipo, id, elemento) => (evento) => {
    const a0 = elemento.ancho;
    arrastrar(evento, (dx) => {
      onCambiarElemento(tipo, id, { ancho: ancho2(a0 + dx * 2) });
    });
  };

  // Texto: la esquina escala letra y caja juntas; el lateral, solo la caja.
  const empezarEscalarTexto = (campo) => (evento) => {
    const { ancho: a0, tamano: t0 } = campo;
    arrastrar(evento, (dx) => {
      const factor = Math.max(0.1, (a0 + dx * 2) / a0);
      onCambiarElemento('campo', campo.id, {
        ancho: ancho2(a0 * factor),
        tamano: Math.min(160, Math.max(4, Math.round(t0 * factor * 10) / 10)),
      });
    });
  };

  const empezarEnsancharTexto = (campo) => (evento) => {
    const a0 = campo.ancho;
    arrastrar(evento, (dx) => {
      onCambiarElemento('campo', campo.id, { ancho: ancho2(a0 + dx * 2) });
    });
  };

  const alTeclear = (evento) => {
    if (!seleccion) return;
    if (evento.key === 'Enter' && seleccion.tipo === 'campo') {
      const campo = diseno.campos.find((item) => item.id === seleccion.id);
      if (campo && seEscribeEnElLienzoOnerrd(campo)) {
        evento.preventDefault();
        setEditando(campo.id);
      }
      return;
    }
    if (!evento.key.startsWith('Arrow')) return;
    evento.preventDefault();
    const paso = evento.shiftKey ? 1 : 0.2;
    // Campos y firmas por su id; lo demás (imagen, QR, icono, y la tabla, el
    // sello y las imágenes de la factura) es una clave del diseño: un elemento,
    // o una lista donde se busca por id.
    const lista =
      seleccion.tipo === 'campo'
        ? diseno.campos
        : seleccion.tipo === 'firma'
          ? diseno.firmas
          : diseno[seleccion.tipo];
    const elemento = Array.isArray(lista) ? lista.find((item) => item.id === seleccion.id) : lista;
    if (!elemento) return;
    const dx = { ArrowLeft: -paso, ArrowRight: paso }[evento.key] || 0;
    const dy = { ArrowUp: -paso, ArrowDown: paso }[evento.key] || 0;
    onCambiarElemento(seleccion.tipo, seleccion.id, {
      x: acotarPosicion(elemento.x + dx),
      y: acotarPosicion(elemento.y + dy),
    });
  };

  const contorno = (elegido) =>
    modoVista
      ? {}
      : {
          outline: (theme) =>
            `1px dashed ${elegido ? theme.vars.palette.primary.main : 'rgba(15,23,42,0.35)'}`,
          outlineOffset: 2,
          '&:hover': { outlineColor: (theme) => theme.vars.palette.primary.main },
        };

  const renderImagen = (tipo, id, elemento, src, proporcion, etiqueta) => {
    const elegido = esElegido(tipo, id);
    if (!src && modoVista) return null;
    return (
      <Box
        key={`${tipo}-${id}`}
        onPointerDown={modoVista ? undefined : empezarMover(tipo, id, elemento)}
        sx={{
          position: 'absolute',
          left: `${elemento.x}%`,
          top: `${elemento.y}%`,
          width: `${elemento.ancho}%`,
          aspectRatio: `1 / ${proporcion || PROPORCION_DE_RESERVA}`,
          // Gira sobre su centro, como el PDF (react-pdf rota sobre el 50 % 50 %).
          transform: `translate(-50%, -50%)${elemento.rotacion ? ` rotate(${elemento.rotacion}deg)` : ''}`,
          cursor: modoVista ? 'default' : 'grab',
          touchAction: 'none',
          zIndex: elegido ? 2 : 1,
          ...contorno(elegido),
        }}
      >
        {src ? (
          <Box
            component="img"
            src={src}
            alt={etiqueta}
            draggable={false}
            sx={{ width: 1, height: 1, display: 'block', pointerEvents: 'none' }}
          />
        ) : (
          <Box
            sx={{
              width: 1,
              height: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(31,79,166,0.08)',
              color: 'rgba(15,23,42,0.6)',
              // Proporcional a la caja: en una pequeña (el icono, la imagen)
              // el texto de 12 px se salía por los lados.
              fontSize: `min(12px, ${elemento.ancho * 0.2}cqw)`,
              lineHeight: 1.15,
              fontWeight: 600,
              textAlign: 'center',
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            {etiqueta}
          </Box>
        )}
        {elegido && !modoVista && (
          <Asa
            cursor="nwse-resize"
            sx={{ right: -7, bottom: -7 }}
            onPointerDown={empezarEstirarImagen(tipo, id, elemento)}
          />
        )}
        {elegido &&
          !modoVista &&
          tipo === 'firma' &&
          // Asa de giro, redonda y por encima: se arrastra alrededor del centro.
          asaDeGiro(empezarRotar('firma', id, elemento))}
      </Box>
    );
  };

  // Girar (firmas, textos, el sello de la factura): el ángulo del puntero
  // alrededor del centro del elemento, que le dice quien llama en % del lienzo.
  // Cerca de 0°, ±90° y 180° se pega (a menos de 4°); con Alt, libre.
  const empezarRotar = (tipo, id, centro) => (evento) => {
    const rect = lienzoRef.current?.getBoundingClientRect();
    if (!rect || !centro) return;
    const cx = rect.left + (centro.x / 100) * rect.width;
    const cy = rect.top + (centro.y / 100) * rect.height;
    arrastrar(evento, (dx, dy, ev) => {
      // El asa está arriba: apuntar hacia arriba es 0°.
      let grados = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
      if (!ev.altKey) {
        const recto = Math.round(grados / 90) * 90;
        if (Math.abs(grados - recto) < 4) grados = recto;
      }
      onCambiarElemento(tipo, id, { rotacion: acotarRotacionOnerrd(grados) });
    });
  };

  // El asa redonda de girar, encima del elemento.
  const asaDeGiro = (onPointerDown) => (
    <Tooltip title="Arrastra para girar (se pega a 0°, 90°…; con Alt, libre)" placement="top">
      <Box
        onPointerDown={onPointerDown}
        sx={{
          position: 'absolute',
          left: '50%',
          top: -30,
          width: 16,
          height: 16,
          ml: '-8px',
          borderRadius: '50%',
          bgcolor: 'common.white',
          border: (theme) => `2px solid ${theme.vars.palette.primary.main}`,
          cursor: 'grab',
          zIndex: 3,
          touchAction: 'none',
          '&::after': {
            content: '""',
            position: 'absolute',
            left: '50%',
            top: 14,
            width: '1px',
            height: 14,
            bgcolor: 'primary.main',
          },
        }}
      />
    </Tooltip>
  );

  const renderTexto = ({ campo, texto, tamano }) => {
    const elegido = esElegido('campo', campo.id);
    const escribiendo = editando === campo.id;
    if (!texto && modoVista) return null;
    return (
      <Box
        key={campo.id}
        onPointerDown={
          modoVista || escribiendo ? undefined : empezarMover('campo', campo.id, campo)
        }
        onDoubleClick={
          !modoVista && seEscribeEnElLienzoOnerrd(campo) ? () => setEditando(campo.id) : undefined
        }
        sx={{
          position: 'absolute',
          left: `${campo.x}%`,
          // El punto guardado es el centro de la PRIMERA línea, como en el PDF.
          top: `calc(${campo.y}% - ${(tamano * unidad * INTERLINEADO_ONERRD) / 2}cqw)`,
          width: `${campo.ancho}%`,
          // Gira sobre el centro de su caja, como el PDF.
          transform: `translateX(-50%)${campo.rotacion ? ` rotate(${campo.rotacion}deg)` : ''}`,
          fontFamily: cssDeFuenteOnerrd(campo.fuente),
          fontWeight: pesoDeCampoOnerrd(campo),
          fontStyle: campo.cursiva ? 'italic' : 'normal',
          fontSize: `${tamano * unidad}cqw`,
          letterSpacing: `${campo.espaciado * unidad}cqw`,
          lineHeight: INTERLINEADO_ONERRD,
          color: campo.color,
          // El contorno con los mismos desplazamientos que el PDF.
          textShadow: campo.contorno
            ? desplazamientosDeContorno(campo.grosorContorno)
                .map(([dx, dy]) => `${dx * unidad}cqw ${dy * unidad}cqw 0 ${campo.contorno}`)
                .join(', ') || 'none'
            : 'none',
          textAlign: campo.alineacion,
          // El degradado es de una línea (así lo dibuja también el PDF).
          whiteSpace: campo.ajustarAlAncho || campo.degradado ? 'nowrap' : 'normal',
          overflowWrap: 'break-word',
          userSelect: 'none',
          cursor: modoVista ? 'default' : escribiendo ? 'text' : 'grab',
          touchAction: 'none',
          zIndex: elegido ? 2 : 1,
          minHeight: `${tamano * unidad * INTERLINEADO_ONERRD}cqw`,
          ...contorno(elegido),
        }}
      >
        {escribiendo ? (
          // El texto fijo (ASAMBLEA DE DIOS “ … ”) se ve alrededor y solo se
          // escribe lo de dentro, que crece con lo escrito.
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              whiteSpace: 'nowrap',
              justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[
                campo.alineacion
              ],
              textTransform: campo.mayusculas ? 'uppercase' : 'none',
            }}
          >
            {campo.prefijo && <span>{campo.prefijo}</span>}
            <Box
              component="input"
              autoFocus
              value={
                campo.tipo === 'fijo'
                  ? (campo.contenido ?? '')
                  : (valores?.[claveDeValorOnerrd(campo)] ?? '')
              }
              placeholder={campo.etiqueta}
              maxLength={200}
              // Un texto fijo escribe en el diseño (se guarda con él); los demás,
              // en los datos del registro.
              onChange={(evento) =>
                campo.tipo === 'fijo'
                  ? onCambiarElemento('campo', campo.id, { contenido: evento.target.value })
                  : onCambiarValor(claveDeValorOnerrd(campo), evento.target.value)
              }
              onPointerDown={(evento) => evento.stopPropagation()}
              onKeyDown={(evento) => {
                // Las flechas mueven el cursor del texto, no la caja.
                evento.stopPropagation();
                if (evento.key === 'Enter' || evento.key === 'Escape') terminarDeEscribir();
              }}
              onBlur={() => setEditando(null)}
              sx={{
                display: 'block',
                ...(campo.prefijo || campo.sufijo
                  ? { fieldSizing: 'content', minWidth: '1ch', maxWidth: 1 }
                  : { width: 1 }),
                p: 0,
                m: 0,
                border: 0,
                outline: 0,
                bgcolor: 'transparent',
                font: 'inherit',
                color: 'inherit',
                letterSpacing: 'inherit',
                lineHeight: 'inherit',
                textAlign: 'inherit',
                // Igual que el PDF, que lo pinta en mayúsculas.
                textTransform: campo.mayusculas ? 'uppercase' : 'none',
                userSelect: 'text',
                '&::placeholder': { color: 'inherit', opacity: 0.4 },
              }}
            />
            {campo.sufijo && <span>{campo.sufijo}</span>}
          </Box>
        ) : (
          (texto && campo.degradado ? (
            // El texto (con su contorno) y, encima, el mismo texto relleno
            // con el degradado. La caja es del ancho de lo escrito: el
            // degradado va de punta a punta del texto, no de la caja entera.
            <Box component="span" sx={{ position: 'relative', display: 'inline-block' }}>
              {texto}
              <Box
                component="span"
                aria-hidden
                sx={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: cssDeDegradadoOnerrd(campo),
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                  textShadow: 'none',
                }}
              >
                {texto}
              </Box>
            </Box>
          ) : (
            texto
          )) ||
          (!modoVista && (
            // Sin dato: su rótulo apagado, que el PDF no lleva. Sin contorno
            // y encogido a la caja: con la letra del número (40 pt y borde),
            // "[Número de destacamento]" tapaba media hoja.
            <Box
              component="span"
              sx={{
                display: 'block',
                opacity: 0.4,
                textShadow: 'none',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                fontSize: `min(1em, ${campo.ancho / ((campo.etiqueta.length + 2) * 0.6)}cqw)`,
              }}
            >
              [{campo.etiqueta}]
            </Box>
          ))
        )}
        {elegido && !modoVista && !escribiendo && (
          <>
            <Asa
              cursor="ew-resize"
              sx={{ right: -7, top: '50%', mt: '-6px' }}
              onPointerDown={empezarEnsancharTexto(campo)}
            />
            <Asa
              cursor="nwse-resize"
              sx={{ right: -7, bottom: -7 }}
              onPointerDown={empezarEscalarTexto(campo)}
            />
            {asaDeGiro(empezarRotar('campo', campo.id, campo))}
          </>
        )}
      </Box>
    );
  };

  if (!fondo && !paginaEnBlanco) {
    return (
      <Box
        onClick={onSubirFondo}
        sx={{
          aspectRatio: `${pagina.ancho} / ${pagina.alto}`,
          borderRadius: 2,
          border: (theme) => `2px dashed ${theme.vars.palette.divider}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          cursor: 'pointer',
          color: 'text.secondary',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Iconify icon="eva:cloud-upload-fill" width={48} />
        <Typography variant="subtitle1">Sube la plantilla .svg del certificado</Typography>
        <Typography variant="body2">
          Será el fondo fijo; encima se colocan los textos, la imagen y las firmas.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={lienzoRef}
      tabIndex={0}
      onKeyDown={alTeclear}
      onPointerDown={() => onSeleccionar(null)}
      sx={{
        position: 'relative',
        containerType: 'inline-size',
        aspectRatio: `${pagina.ancho} / ${pagina.alto}`,
        overflow: 'hidden',
        borderRadius: 1,
        boxShadow: (theme) => theme.vars.customShadows?.z8,
        bgcolor: 'common.white',
        outline: 'none',
        userSelect: 'none',
      }}
    >
      {fondo && (
        <Box
          component="img"
          src={fondo}
          alt="Plantilla del certificado"
          draggable={false}
          sx={{ position: 'absolute', inset: 0, width: 1, height: 1, pointerEvents: 'none' }}
        />
      )}

      {verCuadricula && (
        // Encima del fondo y debajo de los elementos (que van en zIndex 1).
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: [
              'linear-gradient(to right, rgba(31,79,166,0.45) 1px, transparent 1px)',
              'linear-gradient(to bottom, rgba(31,79,166,0.45) 1px, transparent 1px)',
              'linear-gradient(to right, rgba(31,79,166,0.18) 1px, transparent 1px)',
              'linear-gradient(to bottom, rgba(31,79,166,0.18) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: [
              `${pasoX * CELDAS_POR_PULGADA}% ${pasoY * CELDAS_POR_PULGADA}%`,
              `${pasoX * CELDAS_POR_PULGADA}% ${pasoY * CELDAS_POR_PULGADA}%`,
              `${pasoX}% ${pasoY}%`,
              `${pasoX}% ${pasoY}%`,
            ].join(', '),
          }}
        />
      )}

      {diseno.imagen.visible &&
        renderImagen(
          'imagen',
          'imagen',
          diseno.imagen,
          imagen?.dataUrl,
          imagen?.proporcion,
          'Imagen'
        )}

      {diseno.iconoRegion?.visible &&
        renderImagen(
          'iconoRegion',
          'iconoRegion',
          diseno.iconoRegion,
          iconoRegion?.dataUrl,
          iconoRegion?.proporcion,
          // Sin icono: dice qué falta (elegir la región o subir su icono).
          nombreRegion ? `Icono ${nombreRegion}` : 'Icono de la región'
        )}

      {diseno.firmas.map((ranura) => {
        const firma = firmasPorId[ranura.idFirma];
        return renderImagen(
          'firma',
          ranura.id,
          ranura,
          firma?.dataUrl,
          firma?.proporcion,
          ranura.etiqueta
        );
      })}

      {diseno.qr?.visible && renderImagen('qr', 'qr', diseno.qr, qr, 1, 'Código QR')}

      {renderExtras?.({
        unidad,
        modoVista,
        esElegido,
        contorno,
        empezarMover,
        empezarEstirar: empezarEstirarImagen,
        empezarRotar,
        asaDeGiro,
        Asa,
      })}

      {textos.map(renderTexto)}
    </Box>
  );
}

export const LienzoOnerrd = memo(LienzoOnerrdBase);
