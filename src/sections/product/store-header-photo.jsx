'use client';

import Cropper from 'react-easy-crop';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LA FOTO DE LA PORTADA DE LA TIENDA, ENCUADRADA EN SU PROPIO SITIO.
//
// El encuadre NO abre otro dialogo. La foto se mueve y se acerca dentro del
// MISMO recuadro donde luego se va a ver, que es la unica forma de saber que
// parte queda dentro: con un dialogo aparte se elegia sobre un cuadrado y
// despues la portada la recortaba a lo ancho por su cuenta.
//
// Cancelar y Guardar aparecen SOLO mientras hay una foto por encuadrar, debajo
// del recuadro y a la derecha. En cuanto se resuelve —de una forma o de otra—
// desaparecen: si no hay nada que decidir, no hay nada que pulsar.
// ----------------------------------------------------------------------

// La portada es una franja, no un cuadrado. Se encuadra con la misma proporcion
// con la que se va a pintar.
const PROPORCION = 16 / 5;
const ANCHO = 1600;
const ALTO = Math.round(ANCHO / PROPORCION);

/** La porcion elegida, dibujada a tamaño util y en WebP. */
const recortar = async (origen, area) => {
  const imagen = await new Promise((resolve, reject) => {
    const elemento = new Image();
    elemento.addEventListener('load', () => resolve(elemento));
    elemento.addEventListener('error', reject);
    elemento.src = origen;
  });

  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;

  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('No se pudo preparar el recorte.');

  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(imagen, area.x, area.y, area.width, area.height, 0, 0, ANCHO, ALTO);

  const blob = await new Promise((resolve) => lienzo.toBlob(resolve, 'image/webp', 0.9));
  if (!blob) throw new Error('No se pudo preparar el recorte.');

  return blob;
};

export function StoreHeaderPhoto({ vistaPrevia, onCambiar, deshabilitado = false }) {
  const entradaRef = useRef(null);

  const [porEncuadrar, setPorEncuadrar] = useState(null);
  const [origen, setOrigen] = useState(null);
  const [posicion, setPosicion] = useState({ x: 0, y: 0 });
  const [acercamiento, setAcercamiento] = useState(1);
  const [area, setArea] = useState(null);
  const [error, setError] = useState(null);

  // El archivo llega como objeto: se convierte en algo que se pueda pintar, y se
  // suelta al terminar para no dejar la memoria ocupada.
  useEffect(() => {
    if (!porEncuadrar) return undefined;

    const url = URL.createObjectURL(porEncuadrar);
    setOrigen(url);

    return () => URL.revokeObjectURL(url);
  }, [porEncuadrar]);

  const limpiarEncuadre = useCallback(() => {
    setPorEncuadrar(null);
    setOrigen(null);
    setPosicion({ x: 0, y: 0 });
    setAcercamiento(1);
    setArea(null);
    setError(null);
  }, []);

  const handleElegirArchivo = useCallback((evento) => {
    const archivo = evento.target.files?.[0];

    // Se vacia la entrada para que elegir DOS VECES la misma foto vuelva a
    // avisar: si no, el navegador considera que no ha cambiado nada.
    evento.target.value = '';

    if (archivo) {
      setError(null);
      setPorEncuadrar(archivo);
    }
  }, []);

  const handleGuardarEncuadre = useCallback(async () => {
    if (!origen || !area) return;

    try {
      const blob = await recortar(origen, area);
      const nombre = String(porEncuadrar?.name || 'portada').replace(/\.[^.]+$/, '');
      const recortada = new File([blob], `${nombre}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
      });

      onCambiar?.(recortada, URL.createObjectURL(recortada));
      limpiarEncuadre();
    } catch (fallo) {
      setError(fallo?.message || 'No se pudo preparar el recorte.');
    }
  }, [origen, area, porEncuadrar, onCambiar, limpiarEncuadre]);

  const enEncuadre = !!origen;

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Fotografía de la portada</Typography>

      <Box
        sx={{
          width: 1,
          borderRadius: 1.5,
          overflow: 'hidden',
          position: 'relative',
          aspectRatio: `${ANCHO} / ${ALTO}`,
          bgcolor: 'common.black',
          border: (theme) => `dashed 1px ${theme.vars.palette.divider}`,
        }}
      >
        {enEncuadre && (
          <Cropper
            image={origen}
            crop={posicion}
            zoom={acercamiento}
            aspect={PROPORCION}
            showGrid={false}
            // QUE LLENE EL RECUADRO DE ENTRADA. Por defecto la foto se mete
            // entera dentro y deja franjas negras a los lados: parecia que el
            // encuadre ya estaba mal antes de tocar nada.
            objectFit="cover"
            onCropChange={setPosicion}
            onZoomChange={setAcercamiento}
            onCropComplete={(_, areaEnPixeles) => setArea(areaEnPixeles)}
          />
        )}

        {!enEncuadre && vistaPrevia && (
          <Box
            component="img"
            alt="Fotografía de la portada"
            src={vistaPrevia}
            sx={{ width: 1, height: 1, objectFit: 'cover', display: 'block' }}
          />
        )}

        {!enEncuadre && !vistaPrevia && (
          <Stack
            spacing={0.5}
            alignItems="center"
            justifyContent="center"
            sx={{ width: 1, height: 1, color: 'text.disabled' }}
          >
            <Iconify icon="solar:gallery-add-bold" width={32} />

            <Typography variant="caption">Sin fotografía: la portada usa el degradado</Typography>
          </Stack>
        )}
      </Box>

      {enEncuadre && (
        <Stack direction="row" spacing={2} alignItems="center">
          <Iconify icon="solar:minus-circle-bold" width={20} sx={{ color: 'text.disabled' }} />

          <Slider
            min={1}
            max={3}
            step={0.01}
            value={acercamiento}
            onChange={(_, valor) => setAcercamiento(valor)}
            aria-label="Acercar la fotografía"
          />

          <Iconify icon="solar:add-circle-bold" width={20} sx={{ color: 'text.disabled' }} />
        </Stack>
      )}

      {!!error && (
        <Typography variant="caption" sx={{ color: 'error.main' }}>
          {error}
        </Typography>
      )}

      <Box
        component="input"
        type="file"
        accept="image/*"
        ref={entradaRef}
        onChange={handleElegirArchivo}
        sx={{ display: 'none' }}
      />

      {/* DEBAJO DEL RECUADRO Y A LA DERECHA. Mientras se encuadra solo caben dos
          respuestas —esta o no esta—, asi que el resto de botones se aparta. */}
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        {enEncuadre ? (
          <>
            <Typography
              variant="caption"
              sx={{ mr: 'auto', alignSelf: 'center', color: 'text.disabled' }}
            >
              Arrastra la foto para moverla y acércala con el control.
            </Typography>

            <Button color="inherit" onClick={limpiarEncuadre}>
              Cancelar
            </Button>

            <Button variant="contained" onClick={handleGuardarEncuadre} disabled={!area}>
              Guardar
            </Button>
          </>
        ) : (
          <>
            {!!vistaPrevia && (
              <Button
                color="error"
                disabled={deshabilitado}
                onClick={() => onCambiar?.(null, '')}
                startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
              >
                Quitar
              </Button>
            )}

            <Button
              color="inherit"
              disabled={deshabilitado}
              onClick={() => entradaRef.current?.click()}
              startIcon={<Iconify icon="solar:gallery-add-bold" />}
            >
              {vistaPrevia ? 'Cambiar foto' : 'Agregar foto'}
            </Button>
          </>
        )}
      </Stack>
    </Stack>
  );
}
