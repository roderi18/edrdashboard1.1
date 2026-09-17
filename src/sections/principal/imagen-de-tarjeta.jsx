import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';

import { obtenerFotoPrincipal } from 'src/utils/firebase-photos';

// ----------------------------------------------------------------------
// LA IMAGEN DE FONDO DE UNA TARJETA DE LA PANTALLA PRINCIPAL.
//
// La ponia el Administrador Global con un lapiz sobre la tarjeta, y la ve toda la
// organizacion: no es una preferencia de cada quien, es la cara de la pantalla de
// inicio.
//
// DESDE LA FASE 6 DE EVEREST AQUI SOLO SE LEE. Aquel lapiz subia la foto y la
// cambiaba para todos en el acto, sin vista previa ni Historial. Ahora el lapiz
// de cada tarjeta lleva al Designer, donde un fondo nuevo es un borrador mas que
// se ve antes de publicarlo (y va a `everest/`). La foto o el video que ya estaban
// puestos se siguen leyendo de donde siempre —`fotos` → `principalTarjeta`,
// archivos en `principal-tarjetas/`— hasta que se publique otro fondo: la portada
// no cambia sola.
// ----------------------------------------------------------------------

const TIPO_DE_ENTIDAD = 'principalTarjeta';

// La marca de la capa del video, para que la tarjeta suba de piso todo lo demas.
const CLASE_FONDO_EN_VIDEO = 'fondo-en-video';

/**
 * La foto (o el video) de fondo que tiene hoy una tarjeta.
 *
 * `aceptaVideo` lo pide la tarjeta que sabe pintar un video de fondo. Sin el, un
 * video guardado no se pintaria bien como imagen, asi que no se toma por video.
 */
export function useImagenDeTarjeta(idTarjeta, { aceptaVideo = false } = {}) {
  const [foto, setFoto] = useState('');
  const [esVideo, setEsVideo] = useState(false);

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
        setEsVideo(aceptaVideo && registro?.tipoMedio === 'video');
      })
      .catch(() => {
        // Sin foto se pinta el degradado de siempre: no hay nada que avisar.
      });

    return () => {
      cancelado = true;
    };
  }, [idTarjeta, aceptaVideo]);

  return { foto, esVideo };
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
