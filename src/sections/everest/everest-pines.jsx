'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { TIPOS_INSIGNIA } from 'src/utils/insignias-personalizadas.mjs';
import {
  moverPinEnOrden,
  normalizarOrdenDePines,
  catalogoDePinesEnOrden,
  esOrdenDePinesDeFabrica,
} from 'src/utils/pines-perfil.mjs';

import { guardarOrdenDePines } from 'src/services/pines-miembros-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ImagenDePin, useOrdenDePines, useCatalogoDePines } from 'src/components/insignias-perfil';

import { useAuthContext } from 'src/auth/hooks';

import { RejillaOrdenable } from './rejilla-ordenable';
import { AgregarInsigniaDialog } from './agregar-insignia-dialog';

// ----------------------------------------------------------------------
// LOS PINES, DENTRO DE EXPLORA DESIGNER.
//
// Como las medallas: todas las imágenes de la carpeta de pines y los añadidos
// aquí, con la misma pieza que el perfil (`ImagenDePin`). Arrastrándolos se
// cambia el ORDEN GLOBAL, que al guardar manda en todos los perfiles y en el
// diálogo para asignarlos. Las flechas hacen lo mismo, para el teléfono.
// ----------------------------------------------------------------------

export function EverestPines() {
  const { user } = useAuthContext();
  const catalogo = useCatalogoDePines();
  const ordenGuardado = useOrdenDePines();
  // `null`: sin tocar, se sigue lo guardado (y lo que llegue en vivo).
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [agregando, setAgregando] = useState(false);

  const actual = useMemo(
    () => normalizarOrdenDePines(borrador ?? ordenGuardado ?? [], catalogo),
    [borrador, ordenGuardado, catalogo]
  );
  const pines = useMemo(() => catalogoDePinesEnOrden(catalogo, actual), [catalogo, actual]);
  const guardadoNormalizado = normalizarOrdenDePines(ordenGuardado ?? [], catalogo);
  const hayCambios = borrador !== null && actual.join('|') !== guardadoNormalizado.join('|');

  const mover = (idQueSeMueve, idDestino) =>
    setBorrador(moverPinEnOrden(actual, catalogo, idQueSeMueve, idDestino));

  const moverUnPaso = (id, paso) => {
    const destino = actual[actual.indexOf(id) + paso];

    if (destino) mover(id, destino);
  };

  const guardar = async () => {
    setGuardando(true);

    try {
      await guardarOrdenDePines({ orden: actual, anterior: guardadoNormalizado, usuario: user });
      setBorrador(null);
      toast.success('Orden guardado. Ya se ve así en todos los perfiles.');
    } catch (error) {
      console.error('[pines] no se pudo guardar el orden', error);
      toast.error(error?.message || 'No se pudo guardar el orden.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card sx={{ p: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6">Pines</Typography>
          <Label color="info">{catalogo.length}</Label>
          {hayCambios && <Label color="warning">Sin guardar</Label>}
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Los de la carpeta de pines y los añadidos aquí. En el perfil van encima de las cintas,
          centrados, como mucho tres. Arrastra uno: los demás se apartan para hacerle sitio; al
          guardar, ese orden se usa en todos los perfiles y al asignarlos con el lápiz de las
          cintas.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<Iconify icon="mingcute:add-line" />}
          disabled={guardando}
          onClick={() => setAgregando(true)}
          sx={{ mr: 'auto' }}
        >
          Agregar pin
        </Button>
        <Stack direction="row" spacing={1}>
          <Button
            color="inherit"
            startIcon={<Iconify icon="solar:restart-bold" />}
            disabled={guardando || esOrdenDePinesDeFabrica(actual, catalogo)}
            onClick={() => setBorrador(normalizarOrdenDePines([], catalogo))}
          >
            Orden de fábrica
          </Button>
          <Button
            color="inherit"
            disabled={!hayCambios || guardando}
            onClick={() => setBorrador(null)}
          >
            Descartar
          </Button>
          <Button
            variant="contained"
            startIcon={<Iconify icon="eva:checkmark-fill" />}
            disabled={!hayCambios || guardando}
            onClick={guardar}
          >
            {guardando ? 'Guardando…' : 'Guardar orden'}
          </Button>
        </Stack>
      </Stack>

      <RejillaOrdenable
        items={pines}
        deshabilitado={guardando}
        onMover={mover}
        sx={{
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(4, minmax(0, 1fr))',
            md: 'repeat(6, minmax(0, 1fr))',
          },
        }}
        renderItem={(pin, indice, { arrastrando, flotante }) => (
          <Box
            sx={(theme) => ({
              p: 1,
              height: 1,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 1,
              border: `1px solid ${theme.vars.palette.divider}`,
            })}
          >
            <Tooltip
              arrow
              title={
                arrastrando ? (
                  ''
                ) : (
                  <>
                    <Typography variant="subtitle2">{pin.nombre}</Typography>
                    {pin.descripcion && (
                      <Typography variant="caption">{pin.descripcion}</Typography>
                    )}
                  </>
                )
              }
            >
              <Box
                sx={{
                  flexGrow: 1,
                  display: 'flex',
                  alignItems: 'center',
                  '& img': { userSelect: 'none', pointerEvents: 'none' },
                }}
              >
                <ImagenDePin pin={pin} />
              </Box>
            </Tooltip>

            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ mt: 0.75 }}>
              <Label sx={{ flexShrink: 0 }}>{indice + 1}</Label>
              <Typography variant="caption" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                {pin.nombre}
              </Typography>
              {!flotante && (
                <>
                  <IconButton
                    size="small"
                    aria-label={`Mover ${pin.nombre} antes`}
                    disabled={guardando || indice === 0}
                    onClick={() => moverUnPaso(pin.id, -1)}
                    sx={{ p: 0.25 }}
                  >
                    <Iconify icon="eva:arrow-ios-back-fill" width={16} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Mover ${pin.nombre} después`}
                    disabled={guardando || indice === pines.length - 1}
                    onClick={() => moverUnPaso(pin.id, 1)}
                    sx={{ p: 0.25 }}
                  >
                    <Iconify icon="eva:arrow-ios-forward-fill" width={16} />
                  </IconButton>
                </>
              )}
            </Stack>
          </Box>
        )}
      />

      <AgregarInsigniaDialog
        tipo={TIPOS_INSIGNIA.PIN}
        open={agregando}
        onClose={() => setAgregando(false)}
      />

      {!catalogo.length && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Todavía no hay imágenes en la carpeta de pines.
        </Typography>
      )}
    </Card>
  );
}
