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

import {
  catalogoEnOrden,
  esOrdenDeFabrica,
  moverCintaEnOrden,
  EFECTOS_BORDE_CINTA,
  EFECTOS_NUMERO_CINTA,
  normalizarOrdenGlobal,
  CATALOGO_CINTAS_PERFIL,
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
} from 'src/components/insignias-perfil';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// LAS CINTAS, DENTRO DE EXPLORA DESIGNER.
//
// Todas las cintas que existen, pintadas con la MISMA pieza que el perfil
// (`ImagenDeCinta`). Arrastrándolas se cambia el ORDEN GLOBAL: al guardar, ese
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
  const [arrastrada, setArrastrada] = useState('');
  const [encima, setEncima] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [efectoBorde, setEfectoBorde] = useState(EFECTOS_BORDE_CINTA.BARRIDO);
  const [efectoNumero, setEfectoNumero] = useState(EFECTOS_NUMERO_CINTA.BARRIDO);
  // Cuantas veces se ve ganada cada una: con mas de una, lleva el numero dorado.
  const [veces, setVeces] = useState(1);

  const actual = useMemo(
    () => normalizarOrdenGlobal(borrador ?? ordenGuardado ?? []),
    [borrador, ordenGuardado]
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

  const soltar = () => {
    setArrastrada('');
    setEncima('');
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
            <Label color="info">{CATALOGO_CINTAS_PERFIL.length}</Label>
            {hayCambios && <Label color="warning">Sin guardar</Label>}
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Arrastra una cinta sobre otra para cambiar su lugar. Al guardar, ese orden se usa en
            todos los perfiles y al asignarlas.
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

      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mb: 3 }}>
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

      <Box
        sx={{
          gap: 2,
          display: 'grid',
          // `minmax(0, 1fr)`: con `1fr` a secas un nombre largo ensanchaba la columna.
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
            lg: 'repeat(6, minmax(0, 1fr))',
          },
        }}
      >
        {cintas.map((cinta, indice) => (
          <Box
            key={cinta.id}
            draggable={!guardando}
            onDragStart={(evento) => {
              evento.dataTransfer.effectAllowed = 'move';
              // Firefox no arrastra nada sin un dato puesto.
              evento.dataTransfer.setData('text/plain', cinta.id);
              setArrastrada(cinta.id);
            }}
            onDragOver={(evento) => {
              if (!arrastrada) return;
              evento.preventDefault();
              evento.dataTransfer.dropEffect = 'move';
              if (encima !== cinta.id) setEncima(cinta.id);
            }}
            onDragLeave={() => {
              if (encima === cinta.id) setEncima('');
            }}
            onDrop={(evento) => {
              evento.preventDefault();
              if (arrastrada) mover(arrastrada, cinta.id);
              soltar();
            }}
            onDragEnd={soltar}
            sx={(theme) => ({
              p: 1,
              minWidth: 0,
              borderRadius: 1,
              cursor: guardando ? 'default' : 'grab',
              opacity: arrastrada === cinta.id ? 0.4 : 1,
              border: `1px ${encima === cinta.id && arrastrada !== cinta.id ? 'dashed' : 'solid'} ${
                encima === cinta.id && arrastrada !== cinta.id
                  ? theme.vars.palette.primary.main
                  : theme.vars.palette.divider
              }`,
              transition: theme.transitions.create(['opacity', 'border-color']),
              '&:active': { cursor: 'grabbing' },
            })}
          >
            <Tooltip
              arrow
              title={<TextoDeCinta cinta={cinta} />}
              slotProps={{ tooltip: { sx: { maxWidth: 380 } } }}
            >
              {/* La imagen no se arrastra sola: se arrastra la tarjeta entera. */}
              <Box
                sx={{
                  pointerEvents: arrastrada ? 'none' : 'auto',
                  '& img': { userSelect: 'none' },
                }}
              >
                <ImagenDeCinta
                  cinta={cinta}
                  veces={veces}
                  efectoBorde={efectoBorde}
                  efectoNumero={efectoNumero}
                />
              </Box>
            </Tooltip>

            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ mt: 0.75 }}>
              <Label sx={{ flexShrink: 0 }}>{indice + 1}</Label>
              <Typography variant="caption" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                {cinta.id}. {cinta.nombre}
              </Typography>
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
            </Stack>
          </Box>
        ))}
      </Box>
    </Card>
  );
}
