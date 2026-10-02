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
  catalogoEnOrden,
  esOrdenDeFabrica,
  moverCintaEnOrden,
  EFECTOS_BORDE_CINTA,
  EFECTOS_NUMERO_CINTA,
  normalizarOrdenGlobal,
} from 'src/utils/cintas-perfil.mjs';

import { guardarOrdenDeCintas } from 'src/services/cintas-miembros-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import {
  TextoDeCinta,
  ImagenDeCinta,
  OPCIONES_BORDE,
  OPCIONES_NUMERO,
  useOrdenDeCintas,
  AjustesDeEfectosDeCinta,
  useInsigniasPersonalizadas,
} from 'src/components/insignias-perfil';

import { useAuthContext } from 'src/auth/hooks';

import { RejillaOrdenable } from './rejilla-ordenable';
import { AgregarInsigniaDialog } from './agregar-insignia-dialog';

// ----------------------------------------------------------------------
// LAS CINTAS, DENTRO DE EXPLORA DESIGNER.
//
// Todas las cintas que existen —las de la carpeta y las añadidas aquí con
// "Agregar cinta"—, pintadas con la MISMA pieza que el perfil (`ImagenDeCinta`).
// Arrastrándolas (`RejillaOrdenable`) se cambia el ORDEN GLOBAL: al guardar, ese
// orden manda en todos los perfiles —también en los que ya tenían sus cintas— y
// en el diálogo para asignarlas (`src/utils/cintas-perfil.mjs`). Hasta pulsar
// "Guardar orden" no cambia nada fuera de aquí.
//
// Las flechas hacen lo mismo que arrastrar, para el teléfono y el teclado, donde
// arrastrar no funciona.
// ----------------------------------------------------------------------

export function EverestCintas() {
  const { user } = useAuthContext();
  const ordenGuardado = useOrdenDeCintas();
  // `null`: sin tocar, se sigue lo guardado (y lo que llegue en vivo).
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  // Las añadidas en el Designer entran en el catálogo al llegar: con esto la
  // rejilla se vuelve a calcular y aparecen al final.
  const { cintas: personalizadas } = useInsigniasPersonalizadas();

  const [efectoBorde, setEfectoBorde] = useState(EFECTOS_BORDE_CINTA.BARRIDO);
  const [efectoNumero, setEfectoNumero] = useState(EFECTOS_NUMERO_CINTA.BARRIDO);
  // Las perillas solo se prueban aquí, como los dos brillos: no se guardan.
  const [ajustes, setAjustes] = useState({});
  // Cuantas veces se ve ganada cada una: con mas de una, lleva el numero dorado.
  const [veces, setVeces] = useState(1);

  const actual = useMemo(
    () => normalizarOrdenGlobal(borrador ?? ordenGuardado ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [borrador, ordenGuardado, personalizadas]
  );
  const cintas = useMemo(() => catalogoEnOrden(actual), [actual]);
  const hayCambios =
    borrador !== null &&
    borrador.join(',') !== normalizarOrdenGlobal(ordenGuardado ?? []).join(',');

  const mover = (idQueSeMueve, idDestino) =>
    setBorrador(moverCintaEnOrden(actual, idQueSeMueve, idDestino));

  const moverUnPaso = (id, paso) => {
    const indice = actual.indexOf(id);
    const destino = actual[indice + paso];

    if (destino) mover(id, destino);
  };

  const guardar = async () => {
    setGuardando(true);

    try {
      await guardarOrdenDeCintas({ orden: actual, anterior: ordenGuardado ?? [], usuario: user });
      setBorrador(null);
      toast.success('Orden guardado. Ya se ve así en todos los perfiles.');
    } catch (error) {
      console.error('[cintas] no se pudo guardar el orden', error);
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
            <Typography variant="h6">Cintas</Typography>
            <Label color="info">{cintas.length}</Label>
            {hayCambios && <Label color="warning">Sin guardar</Label>}
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Arrastra una cinta: las demás se apartan para hacerle sitio. Al guardar, ese orden se
            usa en todos los perfiles y al asignarlas.
          </Typography>
        </Box>

        <TextField
          select
          size="small"
          label="Brillo de bordes dorados"
          value={efectoBorde}
          onChange={(evento) => setEfectoBorde(evento.target.value)}
          sx={{ minWidth: 220 }}
        >
          {OPCIONES_BORDE.map(([valor, etiqueta]) => (
            <MenuItem key={valor} value={valor}>
              {etiqueta}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Brillo de números"
          value={efectoNumero}
          onChange={(evento) => setEfectoNumero(evento.target.value)}
          sx={{ minWidth: 200 }}
        >
          {OPCIONES_NUMERO.map(([valor, etiqueta]) => (
            <MenuItem key={valor} value={valor}>
              {etiqueta}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Veces ganada"
          value={veces}
          onChange={(evento) => setVeces(Number(evento.target.value))}
          sx={{ minWidth: 130 }}
        >
          {[1, 2, 5, 12].map((valor) => (
            <MenuItem key={valor} value={valor}>
              {valor === 1 ? 'Una vez' : `×${valor}`}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <AjustesDeEfectosDeCinta valores={ajustes} onCambiar={setAjustes} sx={{ mb: 2 }} />

      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<Iconify icon="mingcute:add-line" />}
          disabled={guardando}
          onClick={() => setAgregando(true)}
          sx={{ mr: 'auto' }}
        >
          Agregar cinta
        </Button>
        <Button
          color="inherit"
          startIcon={<Iconify icon="solar:restart-bold" />}
          disabled={guardando || esOrdenDeFabrica(actual)}
          onClick={() => setBorrador(normalizarOrdenGlobal([]))}
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

      <RejillaOrdenable
        items={cintas}
        deshabilitado={guardando}
        onMover={mover}
        sx={{
          // `minmax(0, 1fr)`: con `1fr` a secas un nombre largo ensanchaba la columna.
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
            lg: 'repeat(6, minmax(0, 1fr))',
          },
        }}
        renderItem={(cinta, indice, { arrastrando, flotante }) => (
          <Box
            sx={(theme) => ({
              p: 1,
              height: 1,
              borderRadius: 1,
              border: `1px solid ${theme.vars.palette.divider}`,
            })}
          >
            <Tooltip
              arrow
              title={arrastrando ? '' : <TextoDeCinta cinta={cinta} />}
              slotProps={{ tooltip: { sx: { maxWidth: 380 } } }}
            >
              <Box sx={{ '& img': { userSelect: 'none', pointerEvents: 'none' } }}>
                <ImagenDeCinta
                  cinta={cinta}
                  veces={veces}
                  efectoBorde={efectoBorde}
                  efectoNumero={efectoNumero}
                  {...ajustes}
                />
              </Box>
            </Tooltip>

            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ mt: 0.75 }}>
              <Label sx={{ flexShrink: 0 }}>{indice + 1}</Label>
              <Typography variant="caption" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                {cinta.personalizada ? cinta.nombre : `${cinta.id}. ${cinta.nombre}`}
              </Typography>
              {!flotante && (
                <>
                  <IconButton
                    size="small"
                    aria-label={`Mover ${cinta.nombre} antes`}
                    disabled={guardando || indice === 0}
                    onClick={() => moverUnPaso(cinta.id, -1)}
                    sx={{ p: 0.25 }}
                  >
                    <Iconify icon="eva:arrow-ios-back-fill" width={16} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Mover ${cinta.nombre} después`}
                    disabled={guardando || indice === cintas.length - 1}
                    onClick={() => moverUnPaso(cinta.id, 1)}
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
        tipo={TIPOS_INSIGNIA.CINTA}
        open={agregando}
        onClose={() => setAgregando(false)}
      />
    </Card>
  );
}
