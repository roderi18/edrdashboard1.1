'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useWatch, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';

import { optimizeImageFile } from 'src/utils/image-optimizer';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// En el celular no se arrastra nada: la caja de "Arrastra o selecciona" ocupaba
// media pantalla. Aquí es un botón corto que abre la galería o la cámara, y
// debajo la vista previa con la X para quitarla.
// ----------------------------------------------------------------------

export function FotoMovil({ name, texto = 'Seleccionar foto' }) {
  const { control, setValue } = useFormContext();
  const valor = useWatch({ control, name });
  const entrada = useRef(null);

  const vista = useMemo(
    () => (valor instanceof File ? URL.createObjectURL(valor) : typeof valor === 'string' ? valor : ''),
    [valor]
  );
  useEffect(() => () => vista.startsWith('blob:') && URL.revokeObjectURL(vista), [vista]);

  const elegir = async (event) => {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;
    const optimizado = await optimizeImageFile(archivo, 'avatar').catch(() => archivo);
    setValue(name, optimizado || archivo, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <Stack spacing={1.5}>
      <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={elegir} />
      <Button
        fullWidth
        variant="outlined"
        color="inherit"
        startIcon={<Iconify icon="solar:camera-add-bold" />}
        onClick={() => entrada.current?.click()}
      >
        {vista ? 'Cambiar foto' : texto}
      </Button>
      {vista && (
        <Box sx={{ position: 'relative', alignSelf: 'center' }}>
          <Box
            component="img"
            alt="Vista previa"
            src={vista}
            sx={{ maxWidth: 1, maxHeight: 220, borderRadius: 1.5, display: 'block' }}
          />
          <IconButton
            size="small"
            aria-label="Quitar foto"
            onClick={() => setValue(name, null, { shouldValidate: true })}
            sx={{ top: 6, right: 6, position: 'absolute', color: 'common.white', bgcolor: 'rgba(0,0,0,.55)' }}
          >
            <Iconify icon="mingcute:close-line" width={16} />
          </IconButton>
        </Box>
      )}
    </Stack>
  );
}
