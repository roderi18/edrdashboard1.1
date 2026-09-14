import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';

import { subirFotoEntidad, obtenerFotoPrincipal } from 'src/utils/firebase-photos';

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
// Firestore. No hizo falta coleccion nueva ni regla nueva: las reglas de Storage
// ya traen un comodin que deja al Administrador Global subir y reemplazar
// cualquier imagen.
//
// Vive aqui y no dentro de cada tarjeta porque lo usan dos —la bienvenida y la
// proxima actividad— y va a usarlo la siguiente.
// ----------------------------------------------------------------------

const TIPO_DE_ENTIDAD = 'principalTarjeta';

export function useImagenDeTarjeta(idTarjeta) {
  const [foto, setFoto] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    let cancelado = false;

    obtenerFotoPrincipal({
      tipoEntidad: TIPO_DE_ENTIDAD,
      idEntidad: idTarjeta,
      tipoFoto: 'portada',
    })
      .then((registro) => {
        if (!cancelado) setFoto(registro?.urlFoto || '');
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

      setSubiendo(true);

      try {
        const registro = await subirFotoEntidad({
          file: archivo,
          tipoEntidad: TIPO_DE_ENTIDAD,
          idEntidad: idTarjeta,
          tipoFoto: 'portada',
        });

        setFoto(registro?.urlFoto || '');
        toast.success('Imagen actualizada');
      } catch (error) {
        toast.error(error.message || 'No se pudo subir la imagen.');
      } finally {
        setSubiendo(false);
      }
    },
    [idTarjeta]
  );

  return { foto, subiendo, elegirFoto };
}

// ----------------------------------------------------------------------

/**
 * El lapiz.
 *
 * `component="label"` y no un `onClick` que pulse el input por codigo: pulsarlo
 * asi fallaba al elegir la misma foto dos veces seguidas, que es justo lo que se
 * hace al probar encuadres.
 */
export function LapizDeImagen({ tieneFoto, subiendo, onElegir, sx }) {
  return (
    <Tooltip title={tieneFoto ? 'Cambiar la imagen de fondo' : 'Agregar una imagen de fondo'}>
      <IconButton
        component="label"
        size="small"
        disabled={subiendo}
        aria-label={tieneFoto ? 'Cambiar la imagen de fondo' : 'Agregar una imagen de fondo'}
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

        <Box component="input" type="file" accept="image/*" hidden onChange={onElegir} />
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
export const fondoDeTarjeta = ({ foto, navy, varAlpha }) =>
  foto
    ? {
        backgroundSize: 'cover',
        backgroundPosition: 'center right',
        backgroundImage:
          `linear-gradient(90deg, ${varAlpha(navy.canal, 0.97)} 0%, ` +
          `${varAlpha(navy.canal, 0.92)} 34%, ${varAlpha(navy.canal, 0.55)} 62%, ` +
          `${varAlpha(navy.canal, 0.15)} 100%), url(${foto})`,
      }
    : {
        backgroundImage: `linear-gradient(160deg, ${navy.claro} 0%, ${navy.fondo} 100%)`,
      };
