'use client';

import Card from '@mui/material/Card';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemButton from '@mui/material/ListItemButton';

import { bloquePorId, GRUPOS_DE_BLOQUES } from 'src/utils/everest/bloques.mjs';
import { ESTADOS_DEL_BLOQUE, ETIQUETAS_DEL_ESTADO } from 'src/utils/everest/estado-del-bloque.mjs';

import { Label } from 'src/components/label';

// ----------------------------------------------------------------------
// LA LISTA DE BLOQUES, CON SU ESTADO A LA VISTA.
//
// Lo primero que hay que saber al entrar es que esta tocado y que no: un bloque
// con un borrador a medias es algo pendiente, y uno publicado ya no es el de
// siempre. Por eso cada fila lleva su estado, y cada estado un color que lo
// distingue de los demas —ese es el unico motivo del color—.
// ----------------------------------------------------------------------

export const COLOR_DEL_ESTADO = Object.freeze({
  [ESTADOS_DEL_BLOQUE.original]: 'default',
  [ESTADOS_DEL_BLOQUE.publicado]: 'success',
  [ESTADOS_DEL_BLOQUE.borrador]: 'warning',
  [ESTADOS_DEL_BLOQUE.externo]: 'info',
});

export function EverestListaDeBloques({ estados = [], idSeleccionado, onSeleccionar, sx }) {
  const grupos = Object.values(GRUPOS_DE_BLOQUES).map((grupo) => ({
    grupo,
    estados: estados.filter((estado) => bloquePorId(estado.idBloque)?.grupo === grupo),
  }));

  return (
    <Card sx={[{ py: 1 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <List disablePadding component="nav" aria-label="Bloques de la portada">
        {grupos.map(({ grupo, estados: delGrupo }) => (
          <li key={grupo}>
            <ul style={{ padding: 0 }}>
              <ListSubheader sx={{ bgcolor: 'transparent', lineHeight: '36px' }}>
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  {grupo}
                </Typography>
              </ListSubheader>

              {delGrupo.map((estado) => (
                <ListItemButton
                  key={estado.idBloque}
                  selected={estado.idBloque === idSeleccionado}
                  onClick={() => onSeleccionar?.(estado.idBloque)}
                  sx={{ mx: 1, borderRadius: 1, gap: 1 }}
                >
                  <ListItemText
                    primary={bloquePorId(estado.idBloque)?.nombre}
                    slotProps={{ primary: { noWrap: true, typography: 'body2' } }}
                  />
                  <Label color={COLOR_DEL_ESTADO[estado.estado]} sx={{ flexShrink: 0 }}>
                    {ETIQUETAS_DEL_ESTADO[estado.estado]}
                  </Label>
                </ListItemButton>
              ))}
            </ul>
          </li>
        ))}
      </List>
    </Card>
  );
}
