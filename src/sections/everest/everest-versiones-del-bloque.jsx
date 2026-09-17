'use client';

import { useState } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';
import { ESTADOS_DEL_BLOQUE } from 'src/utils/everest/estado-del-bloque.mjs';
import {
  ACCIONES_DE_VERSION,
  ETIQUETAS_DE_ACCION,
  publicacionDeVersion,
} from 'src/utils/everest/versiones.mjs';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------
// LAS VERSIONES DEL BLOQUE ABIERTO (fase 5).
//
// Cada publicacion y cada "volver al original" deja una. Abrir una la pone como
// borrador —no la publica—: se ve en la vista previa y se publica con el boton
// de siempre. Asi volver atras no es un camino aparte que se salte el "verlo
// antes de que lo vea todo el mundo".
//
// Si ya hay un borrador, se pide confirmacion: abrir la version lo reemplaza.
// ----------------------------------------------------------------------

const MAXIMO_VISIBLE = 20;

/** La version que esta en vivo: la mas nueva, si coincide con lo que se pinta hoy. */
const esLaDeEnVivo = (version, indice, enVivo) => {
  if (indice !== 0) return false;

  if (version.accion === ACCIONES_DE_VERSION.original) return enVivo?.origen === 'codigo';

  return enVivo?.origen === 'designer' && enVivo.publicadoEn === version.creadoEn;
};

export function EverestVersionesDelBloque({ estado, versiones, onAbrir, onReintentar, sx }) {
  const [porConfirmar, setPorConfirmar] = useState(null);

  if (!estado || estado.estado === ESTADOS_DEL_BLOQUE.externo) return null;

  const { lista = [], cargando, error } = versiones ?? {};

  const abrir = (version) => {
    try {
      onAbrir?.(estado.idBloque, version);
      toast.success('Versión abierta como borrador. Publícala para que se vea en la portada.');
    } catch (causa) {
      toast.error(causa?.message || 'No se pudo abrir la versión.');
    }
  };

  return (
    <Card sx={[{ p: 2.5 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Iconify icon="solar:clock-circle-bold" sx={{ color: 'text.secondary' }} />
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          Versiones
        </Typography>
        {cargando && <CircularProgress size={16} />}
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 1.5 }}
          action={
            <Button color="inherit" size="small" onClick={onReintentar}>
              Reintentar
            </Button>
          }
        >
          No se pudieron leer las versiones.
        </Alert>
      )}

      {!cargando && !error && !lista.length && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Todavía no hay versiones. Cada vez que se publique este bloque quedará una aquí.
        </Typography>
      )}

      <Stack spacing={1.5}>
        {lista.slice(0, MAXIMO_VISIBLE).map((version, indice) => {
          const sePuedeAbrir = publicacionDeVersion(version) !== null;

          return (
            <Stack
              key={version.id}
              spacing={0.75}
              sx={{ p: 1.5, borderRadius: 1, border: '1px dashed', borderColor: 'divider' }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                  {ETIQUETAS_DE_ACCION[version.accion]}
                </Typography>
                {esLaDeEnVivo(version, indice, estado.enVivo) && (
                  <Label color="success">En vivo</Label>
                )}
              </Stack>

              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {fDateTime(version.creadoEn)} · {version.creadoPor?.nombre || 'alguien'}
              </Typography>

              {version.accion === ACCIONES_DE_VERSION.publicar &&
                (sePuedeAbrir ? (
                  <Button
                    size="small"
                    color="inherit"
                    variant="outlined"
                    startIcon={<Iconify icon="solar:pen-bold" />}
                    sx={{ alignSelf: 'flex-start' }}
                    onClick={() => (estado.borrador ? setPorConfirmar(version) : abrir(version))}
                  >
                    Abrir como borrador
                  </Button>
                ) : (
                  <Typography variant="caption" sx={{ color: 'warning.main' }}>
                    Ya no cuadra con el bloque de hoy y no se puede abrir.
                  </Typography>
                ))}
            </Stack>
          );
        })}
      </Stack>

      <ConfirmDialog
        open={Boolean(porConfirmar)}
        onClose={() => setPorConfirmar(null)}
        title="¿Reemplazar el borrador?"
        content="Hay un borrador sin publicar en este bloque. Abrir esta versión lo sustituye. La portada no cambia hasta publicar."
        action={
          <Button
            variant="contained"
            onClick={() => {
              abrir(porConfirmar);
              setPorConfirmar(null);
            }}
          >
            Reemplazar
          </Button>
        }
      />
    </Card>
  );
}
