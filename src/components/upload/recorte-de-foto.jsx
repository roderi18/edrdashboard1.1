'use client';

import Cropper from 'react-easy-crop';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// Elegir el encuadre, como en cualquier red social: se arrastra la foto, se
// acerca con la rueda o el control, y lo que queda dentro del circulo es lo que
// se sube.
//
// Antes se subia el archivo tal cual y el recorte lo decidia el navegador al
// dibujarlo: una foto apaisada salia con la cara descentrada y no habia forma de
// arreglarlo mas que recortandola por fuera.
// ----------------------------------------------------------------------

// El lado del cuadrado que se sube. Cubre de sobra la ficha y el chat; el peso
// final lo termina de ajustar el optimizador, que la deja en WebP.
const LADO = 900;

/** La porcion elegida, dibujada a tamaño util y en WebP. */
const recortar = async (origen, area) => {
  const imagen = await new Promise((resolve, reject) => {
    const elemento = new Image();
    elemento.addEventListener('load', () => resolve(elemento));
    elemento.addEventListener('error', reject);
    elemento.src = origen;
  });

  const lienzo = document.createElement('canvas');
  lienzo.width = LADO;
  lienzo.height = LADO;

  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('No se pudo preparar el recorte.');

  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(imagen, area.x, area.y, area.width, area.height, 0, 0, LADO, LADO);

  const blob = await new Promise((resolve) => lienzo.toBlob(resolve, 'image/webp', 0.9));

  if (!blob) throw new Error('No se pudo preparar el recorte.');

  return blob;
};

export function RecorteDeFoto({ abierto, archivo, onCancelar, onListo }) {
  const [origen, setOrigen] = useState(null);
  const [posicion, setPosicion] = useState({ x: 0, y: 0 });
  const [acercamiento, setAcercamiento] = useState(1);
  const [area, setArea] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // El archivo llega como objeto: se convierte a algo que la imagen sepa pintar,
  // y se suelta al cerrar para no dejar la memoria ocupada.
  useEffect(() => {
    if (!archivo) return undefined;

    const url = URL.createObjectURL(archivo);
    setOrigen(url);

    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const alCambiarElArea = useCallback((_, areaEnPixeles) => setArea(areaEnPixeles), []);

  const cerrar = () => {
    setPosicion({ x: 0, y: 0 });
    setAcercamiento(1);
    setArea(null);
    setError(null);
    onCancelar?.();
  };

  const confirmar = async () => {
    if (!origen || !area) return;

    setGuardando(true);
    setError(null);

    try {
      const blob = await recortar(origen, area);
      const nombre = String(archivo?.name || 'foto').replace(/\.[^.]+$/, '');
      const recortada = new File([blob], `${nombre}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
      });

      onListo?.(recortada);
      cerrar();
    } catch (fallo) {
      setError(fallo?.message || 'No se pudo preparar el recorte.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={!!abierto} onClose={guardando ? undefined : cerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Encuadra la foto</DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Box
          sx={{
            width: 1,
            height: 320,
            borderRadius: 1.5,
            overflow: 'hidden',
            position: 'relative',
            bgcolor: 'common.black',
          }}
        >
          {!!origen && (
            <Cropper
              image={origen}
              crop={posicion}
              zoom={acercamiento}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setPosicion}
              onZoomChange={setAcercamiento}
              onCropComplete={alCambiarElArea}
            />
          )}
        </Box>

        <Stack direction="row" spacing={2} sx={{ mt: 2.5, alignItems: 'center' }}>
          <Iconify icon="solar:minus-circle-bold" width={20} sx={{ color: 'text.disabled' }} />

          <Slider
            min={1}
            max={3}
            step={0.01}
            value={acercamiento}
            onChange={(_, valor) => setAcercamiento(valor)}
            aria-label="Acercar la foto"
          />

          <Iconify icon="solar:add-circle-bold" width={20} sx={{ color: 'text.disabled' }} />
        </Stack>

        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
          Arrastra la foto para moverla. Se subirá en WebP, ligera.
        </Typography>

        {!!error && (
          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'error.main' }}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>

        <LoadingButton variant="contained" loading={guardando} onClick={confirmar}>
          Usar esta foto
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
