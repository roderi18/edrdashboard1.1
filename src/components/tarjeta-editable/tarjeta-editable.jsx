'use client';

import { useRef } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

import { cssDeFuente } from 'src/utils/tarjeta-editable.mjs';
import { conTextos } from 'src/utils/galeria-directores.mjs';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LA TARJETA EDITABLE, PINTADA. Una sola pieza para la vista previa de EXPLORA
// Designer (pestaña Tarjeta) y para la Galería de Directores Nacionales: el
// diseño que se cambia en el Designer es el que sale en la galería.
// ----------------------------------------------------------------------

// El mismo recuadro que `CarouselItem` de `overview/course/course-featured.jsx`,
// con el tamaño y los textos de la tarjeta editable.
// `textos` ({ nombre, anio }) lo pasa la Galería de Directores Nacionales: el
// título y el subtítulo son los del director, y en el texto de las imágenes
// flotantes {nombre} y {año} se cambian por los suyos (la placa dorada). Sin
// `textos`, la tarjeta se pinta tal cual (la vista previa del Designer).
// `anchoCompleto` la estira a su celda en vez de usar el ancho del diseño.
export function TarjetaEditable({
  tarjeta,
  onMoverCapa,
  textos,
  anchoCompleto = false,
  sx,
  ...other
}) {
  const imagen = tarjeta.imagenLocal || tarjeta.imagenUrl;
  // Las imágenes que van DEBAJO de la foto, centradas y a su tamaño (% del ancho
  // de esa zona): la barra dorada con el nombre y el año.
  const capasDebajo = tarjeta.capas.filter((capa) => capa.zona === 'textos');
  const marco = useRef(null);

  // Arrastrar una capa: su centro sigue al puntero, en % del marco de la foto.
  const empezarArrastre = (capa) => (event) => {
    if (!onMoverCapa) return;
    event.preventDefault();
    const caja = marco.current?.getBoundingClientRect();
    if (!caja) return;
    const destino = event.currentTarget;
    destino.setPointerCapture?.(event.pointerId);

    const mover = (e) => {
      const x = Math.min(100, Math.max(0, ((e.clientX - caja.left) / caja.width) * 100));
      const y = Math.min(100, Math.max(0, ((e.clientY - caja.top) / caja.height) * 100));
      onMoverCapa?.(capa.id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    };
    const soltar = () => {
      destino.removeEventListener('pointermove', mover);
      destino.removeEventListener('pointerup', soltar);
      destino.removeEventListener('pointercancel', soltar);
    };
    destino.addEventListener('pointermove', mover);
    destino.addEventListener('pointerup', soltar);
    destino.addEventListener('pointercancel', soltar);
  };

  return (
    <Card
      sx={[
        {
          width: anchoCompleto ? 1 : tarjeta.ancho,
          maxWidth: 1,
          flexShrink: 0,
          borderRadius: `${tarjeta.radio}px`,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box sx={{ px: 1, pt: 1 }}>
        <Box
          ref={marco}
          sx={{
            position: 'relative',
            height: tarjeta.altoImagen,
            borderRadius: `${Math.max(0, tarjeta.radio - 4)}px`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.neutral',
            color: 'text.disabled',
          }}
        >
          {imagen ? (
            <Box
              component="img"
              alt={textos?.nombre || tarjeta.titulo}
              src={imagen}
              sx={{ width: 1, height: 1, objectFit: 'cover' }}
            />
          ) : (
            <Iconify width={48} icon="solar:gallery-add-bold" />
          )}
          {tarjeta.capas
            .filter((capa) => capa.zona !== 'textos')
            .map((capa) => (
              <Box
                key={capa.id}
                onPointerDown={empezarArrastre(capa)}
                sx={{
                  position: 'absolute',
                  left: `${capa.x}%`,
                  top: `${capa.y}%`,
                  width: `${capa.ancho}%`,
                  transform: 'translate(-50%, -50%)',
                  userSelect: 'none',
                  ...(onMoverCapa && {
                    cursor: 'grab',
                    touchAction: 'none',
                    '&:active': { cursor: 'grabbing' },
                  }),
                }}
              >
                <CapaFlotante capa={capa} textos={textos} />
              </Box>
            ))}
        </Box>
      </Box>

      {/* CON LA BARRA DEBAJO, SOLO LA BARRA. Ya dice nombre y año: el título y
          el subtítulo repetían lo mismo, así que se ocultan solos. Y va pegada
          a la foto: poco margen arriba y abajo (antes heredaba el de los
          textos, 20 px a cada lado). */}
      <Box
        sx={{
          px: 2,
          // El hueco lo decide el Designer (Margen de la barra, arriba y abajo).
          ...(capasDebajo.length
            ? { pt: 0, pb: `${Math.max(0, tarjeta.margenBarraAbajo ?? 4)}px` }
            : { py: 2.5 }),
          fontFamily: cssDeFuente(tarjeta.fuente),
        }}
      >
        {capasDebajo.map((capa, indice) => (
          <Box
            key={capa.id}
            sx={{
              width: `${capa.ancho}%`,
              mx: 'auto',
              position: 'relative',
              // Negativo, sube sobre el hueco: compensa el borde transparente.
              mt: indice ? 0.5 : `${tarjeta.margenBarraArriba ?? 2}px`,
              ...(indice === capasDebajo.length - 1 &&
                (tarjeta.margenBarraAbajo ?? 4) < 0 && { mb: `${tarjeta.margenBarraAbajo}px` }),
            }}
          >
            <CapaFlotante capa={capa} textos={textos} />
          </Box>
        ))}

        {!capasDebajo.length && tarjeta.mostrarTextos !== false && (
          <>
            <Typography
              variant="subtitle2"
              sx={(theme) => ({
                ...theme.mixins.maxLine({ line: 2 }),
                fontFamily: 'inherit',
                fontSize: tarjeta.tamanoTitulo,
              })}
            >
              {textos ? textos.nombre : tarjeta.titulo}
            </Typography>

            {!!(textos ? textos.anio : tarjeta.subtitulo) && (
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  color: 'text.secondary',
                  fontFamily: 'inherit',
                  fontSize: tarjeta.tamanoSubtitulo,
                }}
              >
                {textos ? textos.anio : tarjeta.subtitulo}
              </Typography>
            )}
          </>
        )}
      </Box>
    </Card>
  );
}

// ----------------------------------------------------------------------

// Una imagen flotante con su texto encima (nombre arriba, años abajo, como en
// las placas). La misma sobre la foto y debajo de ella.
function CapaFlotante({ capa, textos }) {
  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        component="img"
        alt=""
        draggable={false}
        src={capa.urlLocal || capa.url}
        sx={{ width: 1, display: 'block' }}
      />
      {!!(capa.textoArriba || capa.textoAbajo) && (
        <Box
          sx={{
            inset: 0,
            px: '6%',
            display: 'flex',
            position: 'absolute',
            textAlign: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            justifyContent: 'center',
            pointerEvents: 'none',
            color: capa.colorTexto,
            fontSize: capa.tamanoTexto,
            fontFamily: cssDeFuente(capa.fuenteTexto),
            fontWeight: 700,
            lineHeight: 1.15,
          }}
        >
          {/* En la galería manda la placa de cada director (`textos.placa`); en el
              Designer, el texto de muestra. Solo las líneas que el diseño tiene. */}
          {!!capa.textoArriba && (
            <span>{textos?.placa ? textos.placa.arriba : conTextos(capa.textoArriba, textos)}</span>
          )}
          {!!capa.textoAbajo && (
            <span>{textos?.placa ? textos.placa.abajo : conTextos(capa.textoAbajo, textos)}</span>
          )}
        </Box>
      )}
    </Box>
  );
}
