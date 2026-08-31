'use client';

import { useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';

import { RecorteDeFoto } from './recorte-de-foto';

// ----------------------------------------------------------------------
// La foto de un miembro.
//
// Pulsarla la abre en grande, flotando: es lo que se espera de una foto, y antes
// abría el selector de archivos —a quien solo quería verla le saltaba el
// explorador—.
//
// Cambiarla es otra cosa, y va en su propio botón: solo aparece para quien
// puede. A quien no, no se le enseña una puerta que no puede abrir.
// ----------------------------------------------------------------------

const TIPOS = 'image/jpeg,image/jpg,image/png,image/gif,image/webp';

// El escudo, en la esquina de la foto ampliada. Se dibuja a su tamaño nativo
// —48px, los que trae el archivo—, asi que se ve nitido y no hace falta
// prepararlo aparte.
const SELLO = '/exploradores-del-rey-icono.ico';

export function FotoDeMiembro({
  url,
  nombre = '',
  puedeEditar = false,
  cargando = false,
  onFoto,
  tamano = 144,
  ayuda = null,
}) {
  const entrada = useRef(null);
  const [ampliada, setAmpliada] = useState(false);
  const [porRecortar, setPorRecortar] = useState(null);
  const iniciales = String(nombre)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');

  const alElegirArchivo = (evento) => {
    const archivo = evento.target.files?.[0];

    // Se limpia siempre: si no, elegir DOS VECES la misma foto no dispara nada.
    evento.target.value = '';

    if (archivo) setPorRecortar(archivo);
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ position: 'relative', width: tamano, height: tamano }}>
          <Tooltip title={url ? 'Ampliar' : 'Sin foto'}>
            <Box
              component="button"
              type="button"
              onClick={() => url && setAmpliada(true)}
              aria-label={url ? `Ver la foto de ${nombre || 'el miembro'}` : 'Sin foto'}
              sx={{
                p: 0,
                m: 0,
                border: 0,
                width: 1,
                height: 1,
                display: 'block',
                borderRadius: '50%',
                overflow: 'hidden',
                bgcolor: 'transparent',
                cursor: url ? 'zoom-in' : 'default',
              }}
            >
              <Avatar
                src={url || undefined}
                alt={nombre}
                sx={{ width: 1, height: 1, fontSize: tamano / 3.5 }}
              >
                {iniciales}
              </Avatar>
            </Box>
          </Tooltip>

          {cargando && (
            <Box
              sx={{
                inset: 0,
                display: 'flex',
                position: 'absolute',
                alignItems: 'center',
                borderRadius: '50%',
                justifyContent: 'center',
                bgcolor: 'rgba(0, 0, 0, 0.48)',
              }}
            >
              <CircularProgress size={28} sx={{ color: 'common.white' }} />
            </Box>
          )}

          {puedeEditar && !cargando && (
            <Tooltip title="Cambiar la foto">
              <IconButton
                onClick={() => entrada.current?.click()}
                aria-label="Cambiar la foto"
                sx={{
                  right: 0,
                  bottom: 0,
                  position: 'absolute',
                  color: 'common.white',
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <Iconify icon="solar:camera-add-bold" width={20} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {ayuda}
      </Box>

      {/* Solo se monta para quien puede cambiarla. */}
      {puedeEditar && (
        <input
          ref={entrada}
          type="file"
          accept={TIPOS}
          style={{ display: 'none' }}
          onChange={alElegirArchivo}
        />
      )}

      <Dialog open={ampliada} onClose={() => setAmpliada(false)} maxWidth="lg">
        {/* La foto y el sello, en la misma caja: asi el sello se pega a la
            esquina de LA IMAGEN y no a la del dialogo, que puede sobrarle. */}
        <Box sx={{ display: 'block', position: 'relative', lineHeight: 0 }}>
          <Box
            component="img"
            src={url || undefined}
            alt={nombre}
            sx={{ display: 'block', maxWidth: '92vw', maxHeight: '88vh' }}
          />

          {/* Sin capturar el raton: pulsar la foto tiene que seguir cerrando el
              dialogo, no chocar contra el sello. */}
          <Box
            component="img"
            src={SELLO}
            alt=""
            aria-hidden
            sx={{
              width: 56,
              right: 14,
              bottom: 14,
              opacity: 0.9,
              position: 'absolute',
              pointerEvents: 'none',
              // Para que se lea igual sobre una foto clara que sobre una oscura.
              filter: 'drop-shadow(0 1px 4px rgba(0, 0, 0, 0.55))',
            }}
          />
        </Box>
      </Dialog>

      <RecorteDeFoto
        abierto={!!porRecortar}
        archivo={porRecortar}
        onCancelar={() => setPorRecortar(null)}
        onListo={(recortada) => {
          setPorRecortar(null);
          onFoto?.(recortada);
        }}
      />
    </>
  );
}
