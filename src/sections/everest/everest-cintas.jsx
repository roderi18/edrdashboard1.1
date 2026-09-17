'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  EFECTOS_BORDE_CINTA,
  EFECTOS_NUMERO_CINTA,
  CATALOGO_CINTAS_PERFIL,
} from 'src/utils/cintas-perfil.mjs';

import { Label } from 'src/components/label';
import {
  TextoDeCinta,
  ImagenDeCinta,
  OPCIONES_BORDE,
  OPCIONES_NUMERO,
} from 'src/components/insignias-perfil';

// ----------------------------------------------------------------------
// LAS CINTAS, DENTRO DE EXPLORA DESIGNER.
//
// De momento es solo el catalogo: todas las cintas que existen, pintadas con la
// MISMA pieza que el perfil (`ImagenDeCinta`), para verlas juntas con sus brillos
// sin tener que abrir el perfil de nadie. No guarda nada: los efectos de arriba
// son para mirar, y asignar cintas a un miembro sigue siendo desde su perfil.
// ----------------------------------------------------------------------

export function EverestCintas() {
  const [efectoBorde, setEfectoBorde] = useState(EFECTOS_BORDE_CINTA.BARRIDO);
  const [efectoNumero, setEfectoNumero] = useState(EFECTOS_NUMERO_CINTA.BARRIDO);
  // Cuantas veces se ve ganada cada una: con mas de una, lleva el numero dorado.
  const [veces, setVeces] = useState(1);

  return (
    <Card sx={{ p: 3 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6">Cintas</Typography>
            <Label color="info">{CATALOGO_CINTAS_PERFIL.length}</Label>
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Todas las cintas que existen, como se ven en el perfil. Pasa el cursor por una para leer
            su descripción.
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
        {CATALOGO_CINTAS_PERFIL.map((cinta) => (
          <Tooltip
            key={cinta.id}
            arrow
            title={<TextoDeCinta cinta={cinta} />}
            slotProps={{ tooltip: { sx: { maxWidth: 380 } } }}
          >
            <Box
              sx={{
                p: 1,
                minWidth: 0,
                borderRadius: 1,
                border: (theme) => `1px solid ${theme.vars.palette.divider}`,
              }}
            >
              <ImagenDeCinta
                cinta={cinta}
                veces={veces}
                efectoBorde={efectoBorde}
                efectoNumero={efectoNumero}
              />
              <Typography variant="caption" noWrap sx={{ display: 'block', mt: 0.75 }}>
                {cinta.id}. {cinta.nombre}
              </Typography>
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Card>
  );
}
