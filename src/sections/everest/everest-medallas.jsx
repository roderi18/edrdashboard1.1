'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { TIPOS_INSIGNIA } from 'src/utils/insignias-personalizadas.mjs';
import {
  moverMedallaEnOrden,
  EFECTOS_BRILLO_MEDALLA,
  normalizarOrdenDeMedallas,
  catalogoDeMedallasEnOrden,
  EFECTOS_MOVIMIENTO_MEDALLA,
  esOrdenDeMedallasDeFabrica,
} from 'src/utils/medallas-perfil.mjs';

import { guardarOrdenDeMedallas } from 'src/services/medallas-miembros-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import {
  ImagenDeMedalla,
  useOrdenDeMedallas,
  useCatalogoDeMedallas,
  OPCIONES_BRILLO_MEDALLA,
  AjustesDeEfectosDeMedalla,
  OPCIONES_MOVIMIENTO_MEDALLA,
} from 'src/components/insignias-perfil';

import { useAuthContext } from 'src/auth/hooks';

import { RejillaOrdenable } from './rejilla-ordenable';
import { AgregarInsigniaDialog } from './agregar-insignia-dialog';

// ----------------------------------------------------------------------
// LAS MEDALLAS, DENTRO DE EXPLORA DESIGNER.
//
// Todas las imagenes de la carpeta de medallas, con la misma pieza que el perfil
// (`ImagenDeMedalla`). Arrastrandolas se cambia el ORDEN GLOBAL, que al guardar
// manda en todos los perfiles y en el dialogo para asignarlas. Una imagen nueva
// en la carpeta aparece aqui al final, sola.
//
// Las flechas hacen lo mismo que arrastrar, para el telefono y el teclado.
// ----------------------------------------------------------------------

export function EverestMedallas() {
  const { user } = useAuthContext();
  const catalogo = useCatalogoDeMedallas();
  const ordenGuardado = useOrdenDeMedallas();
  // `null`: sin tocar, se sigue lo guardado (y lo que llegue en vivo).
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  // Para probar los efectos sobre todo el catálogo. No se guardan aquí: cada
  // miembro lleva los suyos, elegidos con el lápiz de las cintas.
  const [efectoMovimiento, setEfectoMovimiento] = useState(EFECTOS_MOVIMIENTO_MEDALLA.SOPLO);
  const [efectoBrillo, setEfectoBrillo] = useState(EFECTOS_BRILLO_MEDALLA.DESTELLO);
  const [ajustes, setAjustes] = useState({});

  const actual = useMemo(
    () => normalizarOrdenDeMedallas(borrador ?? ordenGuardado ?? [], catalogo),
    [borrador, ordenGuardado, catalogo]
  );
  const medallas = useMemo(() => catalogoDeMedallasEnOrden(catalogo, actual), [catalogo, actual]);
  const guardadoNormalizado = normalizarOrdenDeMedallas(ordenGuardado ?? [], catalogo);
  const hayCambios = borrador !== null && actual.join('|') !== guardadoNormalizado.join('|');

  const mover = (idQueSeMueve, idDestino) =>
    setBorrador(moverMedallaEnOrden(actual, catalogo, idQueSeMueve, idDestino));

  const moverUnPaso = (id, paso) => {
    const destino = actual[actual.indexOf(id) + paso];

    if (destino) mover(id, destino);
  };

  const guardar = async () => {
    setGuardando(true);

    try {
      await guardarOrdenDeMedallas({
        orden: actual,
        anterior: guardadoNormalizado,
        usuario: user,
      });
      setBorrador(null);
      toast.success('Orden guardado. Ya se ve así en todos los perfiles.');
    } catch (error) {
      console.error('[medallas] no se pudo guardar el orden', error);
      toast.error(error?.message || 'No se pudo guardar el orden.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card sx={{ p: 3 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6">Medallas</Typography>
            <Label color="info">{catalogo.length}</Label>
            {hayCambios && <Label color="warning">Sin guardar</Label>}
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Las de la carpeta de medallas y las añadidas aquí. Arrastra una: las demás se apartan
            para hacerle sitio; al guardar, ese orden se usa en todos los perfiles y al asignarlas. Movimiento,
            brillo, su velocidad y su intensidad se prueban aquí y se eligen para cada miembro con
            el lápiz de las cintas.
          </Typography>
        </Box>

        <TextField
          select
          size="small"
          label="Movimiento"
          value={efectoMovimiento}
          onChange={(evento) => setEfectoMovimiento(evento.target.value)}
          sx={{ minWidth: 200 }}
        >
          {OPCIONES_MOVIMIENTO_MEDALLA.map(([valor, etiqueta]) => (
            <MenuItem key={valor} value={valor}>
              {etiqueta}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Brillo del medallón"
          value={efectoBrillo}
          onChange={(evento) => setEfectoBrillo(evento.target.value)}
          sx={{ minWidth: 200 }}
        >
          {OPCIONES_BRILLO_MEDALLA.map(([valor, etiqueta]) => (
            <MenuItem key={valor} value={valor}>
              {etiqueta}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <AjustesDeEfectosDeMedalla valores={ajustes} onCambiar={setAjustes} sx={{ mb: 2 }} />

      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<Iconify icon="mingcute:add-line" />}
          disabled={guardando}
          onClick={() => setAgregando(true)}
          sx={{ mr: 'auto' }}
        >
          Agregar medalla
        </Button>
        <Stack direction="row" spacing={1}>
          <Button
            color="inherit"
            startIcon={<Iconify icon="solar:restart-bold" />}
            disabled={guardando || esOrdenDeMedallasDeFabrica(actual, catalogo)}
            onClick={() => setBorrador(normalizarOrdenDeMedallas([], catalogo))}
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
        items={medallas}
        deshabilitado={guardando}
        onMover={mover}
        sx={{
          gridTemplateColumns: {
            xs: 'repeat(3, minmax(0, 1fr))',
            sm: 'repeat(4, minmax(0, 1fr))',
            md: 'repeat(6, minmax(0, 1fr))',
            lg: 'repeat(8, minmax(0, 1fr))',
          },
        }}
        renderItem={(medalla, indice, { arrastrando, flotante }) => (
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
                    <Typography variant="subtitle2">{medalla.nombre}</Typography>
                    {medalla.descripcion && (
                      <Typography variant="caption">{medalla.descripcion}</Typography>
                    )}
                  </>
                )
              }
            >
              <Box sx={{ flexGrow: 1, '& img': { userSelect: 'none', pointerEvents: 'none' } }}>
                <ImagenDeMedalla
                  medalla={medalla}
                  efectoMovimiento={efectoMovimiento}
                  efectoBrillo={efectoBrillo}
                  {...ajustes}
                />
              </Box>
            </Tooltip>

            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ mt: 0.75 }}>
              <Label sx={{ flexShrink: 0 }}>{indice + 1}</Label>
              <Typography variant="caption" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                {medalla.nombre}
              </Typography>
              {!flotante && (
                <>
                  <IconButton
                    size="small"
                    aria-label={`Mover ${medalla.nombre} antes`}
                    disabled={guardando || indice === 0}
                    onClick={() => moverUnPaso(medalla.id, -1)}
                    sx={{ p: 0.25 }}
                  >
                    <Iconify icon="eva:arrow-ios-back-fill" width={16} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Mover ${medalla.nombre} después`}
                    disabled={guardando || indice === medallas.length - 1}
                    onClick={() => moverUnPaso(medalla.id, 1)}
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
        tipo={TIPOS_INSIGNIA.MEDALLA}
        open={agregando}
        onClose={() => setAgregando(false)}
      />

      {!catalogo.length && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Todavía no hay imágenes en la carpeta de medallas.
        </Typography>
      )}
    </Card>
  );
}
