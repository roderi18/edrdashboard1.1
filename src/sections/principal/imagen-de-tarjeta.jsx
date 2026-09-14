import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';

import {
  subirFotoEntidad,
  subirVideoEntidad,
  obtenerFotoPrincipal,
  TIPOS_DE_VIDEO_ADMITIDOS,
} from 'src/utils/firebase-photos';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LA IMAGEN DE FONDO DE UNA TARJETA DE LA PANTALLA PRINCIPAL.
//
// La ponen el Administrador Global y nadie mas, y la ve toda la organizacion: no
// es una preferencia de cada quien, es la cara de la pantalla de inicio.
//
// Se apoya en la infraestructura de fotos que ya existe (`firebase-photos`), que
// se encarga de optimizar a webp, subir a Storage y dejar constancia en
// Firestore. No hizo falta coleccion nueva. Para las imagenes tampoco regla nueva
// —el comodin de Storage deja al Administrador Global subir cualquier imagen—,
// pero el VIDEO de la proxima actividad si la pidio: `principal-tarjetas` tiene
// su bloque en `storage.rules`.
//
// Vive aqui y no dentro de cada tarjeta porque lo usan dos —la bienvenida y la
// proxima actividad— y va a usarlo la siguiente.
// ----------------------------------------------------------------------

const TIPO_DE_ENTIDAD = 'principalTarjeta';

// La marca de la capa del video, para que la tarjeta suba de piso todo lo demas.
const CLASE_FONDO_EN_VIDEO = 'fondo-en-video';

// EL TIPO DEL ARCHIVO, Y SI NO LO TRAE, POR SU EXTENSION.
//
// Windows no siempre le pone tipo a un .mp4 —depende de lo que haya instalado—,
// y el navegador lo entrega con `type` vacio. Asi el video se tomaba por imagen,
// se subia a `portada.webp` sin tipo y Storage lo rechazaba.
const TIPO_POR_EXTENSION = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

const tipoDeArchivo = (archivo) => {
  if (archivo?.type) return archivo.type;

  const extension = String(archivo?.name || '')
    .split('.')
    .pop()
    .toLowerCase();

  return TIPO_POR_EXTENSION[extension] || '';
};

/**
 * `aceptaVideo` lo pide la tarjeta que sabe pintar un video de fondo. Sin el, un
 * video subido se leeria como imagen y el fondo saldria vacio.
 */
export function useImagenDeTarjeta(idTarjeta, { aceptaVideo = false } = {}) {
  const [foto, setFoto] = useState('');
  const [esVideo, setEsVideo] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    let cancelado = false;

    obtenerFotoPrincipal({
      tipoEntidad: TIPO_DE_ENTIDAD,
      idEntidad: idTarjeta,
      tipoFoto: 'portada',
    })
      .then((registro) => {
        if (cancelado) return;
        setFoto(registro?.urlFoto || '');
        setEsVideo(registro?.tipoMedio === 'video');
      })
      .catch(() => {
        // Sin foto se pinta el degradado de siempre: no hay nada que avisar.
      });

    return () => {
      cancelado = true;
    };
  }, [idTarjeta]);

  const elegirFoto = useCallback(
    async (evento) => {
      const archivo = evento.target.files?.[0];

      // El input se limpia SIEMPRE, tambien al cancelar: sin esto, elegir dos
      // veces seguidas la misma foto no disparaba el `change` y parecia que el
      // lapiz se habia roto.
      evento.target.value = '';

      if (!archivo) return;

      const tipo = tipoDeArchivo(archivo);
      const subeVideo = tipo.startsWith('video/');

      if (subeVideo && !aceptaVideo) {
        toast.error('Esta tarjeta solo admite imágenes.');
        return;
      }

      // NI IMAGEN NI VIDEO: SE DICE AQUI. Antes todo lo que no era video iba por
      // la rama de imagen, el optimizador lo dejaba pasar tal cual y Storage lo
      // rechazaba con un "no tienes permiso" que no explicaba nada.
      if (!subeVideo && !tipo.startsWith('image/')) {
        toast.error(
          aceptaVideo
            ? 'Elige una imagen o un video MP4 o WebM.'
            : 'Elige una imagen (JPG, PNG o WebP).'
        );
        return;
      }

      setSubiendo(true);

      try {
        const registro = subeVideo
          ? await subirVideoEntidad({
              file: archivo,
              tipoMime: tipo,
              tipoEntidad: TIPO_DE_ENTIDAD,
              idEntidad: idTarjeta,
              tipoFoto: 'portada',
            })
          : await subirFotoEntidad({
              file: archivo,
              tipoEntidad: TIPO_DE_ENTIDAD,
              idEntidad: idTarjeta,
              tipoFoto: 'portada',
              // Sin esto se optimizaba como foto de perfil (900px de ancho) y la
              // tarjeta, que mide casi el ancho de la pantalla, la estiraba pixelada.
              preset: 'portada',
            });

        setFoto(registro?.urlFoto || '');
        setEsVideo(subeVideo);
        toast.success(subeVideo ? 'Video actualizado' : 'Imagen actualizada');
      } catch (error) {
        toast.error(error.message || 'No se pudo subir la imagen.');
      } finally {
        setSubiendo(false);
      }
    },
    [idTarjeta, aceptaVideo]
  );

  return { foto, esVideo, subiendo, elegirFoto };
}

// ----------------------------------------------------------------------

/**
 * El lapiz.
 *
 * `component="label"` y no un `onClick` que pulse el input por codigo: pulsarlo
 * asi fallaba al elegir la misma foto dos veces seguidas, que es justo lo que se
 * hace al probar encuadres.
 */
export function LapizDeImagen({ tieneFoto, subiendo, onElegir, aceptaVideo = false, sx }) {
  const medio = aceptaVideo ? 'la imagen o el video de fondo' : 'la imagen de fondo';
  const titulo = tieneFoto
    ? `Cambiar ${medio}`
    : `Agregar ${aceptaVideo ? 'una imagen o un video de fondo' : 'una imagen de fondo'}`;

  return (
    <Tooltip title={titulo}>
      <IconButton
        component="label"
        size="small"
        disabled={subiendo}
        aria-label={titulo}
        sx={[
          {
            color: '#FFFFFF',
            bgcolor: 'rgba(255, 255, 255, 0.12)',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.22)' },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {subiendo ? (
          <CircularProgress size={16} sx={{ color: 'inherit' }} />
        ) : (
          <Iconify icon="solar:pen-bold" width={16} />
        )}

        <Box
          component="input"
          type="file"
          accept={aceptaVideo ? `image/*,${TIPOS_DE_VIDEO_ADMITIDOS.join(',')}` : 'image/*'}
          hidden
          onChange={onElegir}
        />
      </IconButton>
    </Tooltip>
  );
}

// ----------------------------------------------------------------------

/**
 * El fondo de una tarjeta: la foto con su velo, o el degradado de siempre.
 *
 * EL VELO SE ABRE DE IZQUIERDA A DERECHA. Un velo parejo encima de toda la foto
 * deja el texto legible pero apaga la imagen de punta a punta, y entonces da
 * igual cual pongas. Asi el navy es solido donde vive el texto y se abre hacia la
 * derecha hasta dejar la foto limpia.
 *
 * Las cuatro paradas no son decoracion: con dos, el corte se nota como una linea
 * recta cruzando la tarjeta.
 */
const veloDeTarjeta = ({ navy, varAlpha }) =>
  `linear-gradient(90deg, ${varAlpha(navy.canal, 0.97)} 0%, ` +
  `${varAlpha(navy.canal, 0.92)} 34%, ${varAlpha(navy.canal, 0.55)} 62%, ` +
  `${varAlpha(navy.canal, 0.15)} 100%)`;

export const fondoDeTarjeta = ({ foto, esVideo = false, navy, varAlpha }) =>
  // CON VIDEO, EL FONDO LO PINTA `FondoEnVideo`. Aqui solo queda el navy de
  // debajo —lo que se ve mientras el video carga— y el recorte, para que el
  // video no se salga por las esquinas redondeadas.
  //
  // `isolation` y los hijos subidos un piso: el video va en posicion absoluta, y
  // lo posicionado se pinta ENCIMA de lo que no lo esta. Sin esto el video
  // tapaba el titulo, la fecha y el boton.
  foto && esVideo
    ? {
        overflow: 'hidden',
        isolation: 'isolate',
        bgcolor: navy.fondo,
        [`& > :not(.${CLASE_FONDO_EN_VIDEO})`]: { position: 'relative', zIndex: 1 },
      }
    : foto
      ? {
          backgroundSize: 'cover',
          backgroundPosition: 'center right',
          backgroundImage: `${veloDeTarjeta({ navy, varAlpha })}, url(${foto})`,
        }
      : {
          backgroundImage: `linear-gradient(160deg, ${navy.claro} 0%, ${navy.fondo} 100%)`,
        };

// ----------------------------------------------------------------------

/**
 * El video de fondo de una tarjeta, que se comporta como un GIF.
 *
 * Sin sonido, en bucle, sin controles y arrancando solo: nadie tiene que darle a
 * reproducir. `muted` y `playsInline` no son adorno —sin ellos Chrome y Safari
 * bloquean el arranque automatico y el iPhone lo abre a pantalla completa—.
 *
 * NO SE CONVIERTE A GIF DE VERDAD. Un GIF de unos segundos pesa diez veces lo
 * que el mismo video en MP4 y se ve con 256 colores. El video en bucle se ve
 * igual que un GIF y mejor.
 *
 * SOLO CORRE MIENTRAS SE VE. Un video en marcha fuera de la pantalla gasta
 * bateria y datos para nadie: al salir la tarjeta de la vista se pausa, y al
 * volver sigue.
 *
 * Encima lleva el mismo velo que la imagen, para que el texto se lea igual.
 */
export function FondoEnVideo({ src, navy, varAlpha }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === 'undefined') return undefined;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          // `play()` devuelve una promesa que falla si el navegador no deja
          // arrancar (ahorro de datos, por ejemplo). Se queda en el primer
          // fotograma, que ya es un fondo; no hay nada que avisar.
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.1 }
    );

    observador.observe(video);

    return () => observador.disconnect();
  }, [src]);

  return (
    <Box className={CLASE_FONDO_EN_VIDEO} sx={{ inset: 0, zIndex: 0, position: 'absolute' }}>
      <Box
        ref={videoRef}
        component="video"
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        sx={{
          width: 1,
          height: 1,
          display: 'block',
          objectFit: 'cover',
          objectPosition: 'center right',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{ inset: 0, position: 'absolute', backgroundImage: veloDeTarjeta({ navy, varAlpha }) }}
      />
    </Box>
  );
}
