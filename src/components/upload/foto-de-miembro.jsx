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

// El escudo, en la esquina de la foto ampliada. Viene ya redondo, con
// transparencia y a 192px: sobrado para dibujarlo a 56 y que se lea nitido
// incluso en pantallas densas.
const SELLO = '/watermark.webp';

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
        <Box
          onContextMenu={(evento) => evento.preventDefault()}
          sx={{ display: 'block', position: 'relative', lineHeight: 0 }}
        >
          <Box
            component="img"
            src={url || undefined}
            alt={nombre}
            draggable={false}
            sx={{
              display: 'block',
              maxWidth: '92vw',
              maxHeight: '88vh',
              userSelect: 'none',
              // El raton no llega a la imagen: llega al cristal de abajo. Sin
              // esto, el menu del boton derecho seguiria ofreciendo "Guardar
              // imagen como", porque el elemento senalado seria la foto.
              pointerEvents: 'none',
              WebkitUserSelect: 'none',
              // En movil, mantener el dedo sobre una foto abre el menu de
              // guardar. Esto lo apaga.
              WebkitTouchCallout: 'none',
            }}
          />

          {/* Sin capturar el raton: pulsar la foto tiene que seguir cerrando el
              dialogo, no chocar contra el sello. */}
          <Box
            component="img"
            src={SELLO}
            alt=""
            aria-hidden
            sx={{
              // Un 14% del ancho de la foto, con tope: en una foto grande se ve
              // de verdad, y en una pequeña no se la come. El archivo tiene
              // 192px, asi que hasta ahi se lee nitido.
              width: { xs: 72, sm: 96 },
              right: { xs: 12, sm: 18 },
              bottom: { xs: 12, sm: 18 },
              opacity: 0.9,
              position: 'absolute',
              pointerEvents: 'none',
              // Para que se lea igual sobre una foto clara que sobre una oscura.
              filter: 'drop-shadow(0 1px 4px rgba(0, 0, 0, 0.55))',
            }}
          />

          {/* EL CRISTAL.
              Una capa transparente por encima de todo. Lo que el raton senala es
              ESTO, no la foto, asi que el menu del boton derecho no trae
              "Guardar imagen como" ni "Copiar imagen": no hay ninguna imagen
              debajo del cursor que ofrecer.

              Que quede dicho: esto quita las formas faciles —boton derecho,
              arrastrar, mantener pulsado en el movil—. No es un candado. Quien
              sepa abrir las herramientas del navegador ve la direccion del
              archivo igual, y eso no hay CSS que lo impida. */}
          <Box
            onContextMenu={(evento) => evento.preventDefault()}
            onDragStart={(evento) => evento.preventDefault()}
            sx={{
              inset: 0,
              position: 'absolute',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
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
