'use client';

import { useState } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';
import { bloquePorId } from 'src/utils/everest/bloques.mjs';
import { ESTADOS_DEL_BLOQUE, ETIQUETAS_DEL_ESTADO } from 'src/utils/everest/estado-del-bloque.mjs';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { COLOR_DEL_ESTADO } from './everest-lista-de-bloques';

// ----------------------------------------------------------------------
// EL PANEL DEL BLOQUE ABIERTO: QUE HAY EN VIVO, QUE HAY A MEDIAS, Y QUE HACER.
//
// Aqui va el editor de cada bloque (`editor`), y debajo las acciones que valen
// para todos. Publicar solo se puede con un borrador que pase el saneado: un
// boton que se deja pulsar y luego falla ensena a desconfiar del boton.
//
// "Volver al original" pide confirmacion porque lo cambia para toda la
// organizacion, y "Descartar borrador" no, porque solo tira lo que nadie ha visto.
//
// Dos pestañas: CONTENIDO (que dice) y DISEÑO (como se ve: colores, tamaños,
// textos fijos, que se muestra). Las dos escriben el mismo borrador y se publican
// juntas.
// ----------------------------------------------------------------------

const quien = (persona) => persona?.nombre || 'alguien';

const vecesVisto = (contado) =>
  contado
    ? `Visto ${contado.impresiones} ${contado.impresiones === 1 ? 'vez' : 'veces'} · ${contado.clics} ${contado.clics === 1 ? 'pulsación' : 'pulsaciones'}`
    : 'Sin visitas contadas todavía.';

export function EverestPanelDelBloque({
  estado,
  editor = null,
  editorDeDiseno = null,
  analiticas = null,
  guardando = false,
  accion = '',
  onPublicar,
  onDescartarBorrador,
  onVolverAlOriginal,
  sx,
}) {
  const [confirmarOriginal, setConfirmarOriginal] = useState(false);
  const [pestana, setPestana] = useState('contenido');
  // Los comunicados nuevos se avisan en la campana, salvo que se desmarque.
  const [avisar, setAvisar] = useState(true);

  if (!estado) return null;

  const bloque = bloquePorId(estado.idBloque);
  const esExterno = estado.estado === ESTADOS_DEL_BLOQUE.externo;
  const publicadoEnVivo = estado.enVivo?.origen === 'designer';

  const conAviso = (tarea, textoExito) => async () => {
    try {
      const resultado = await tarea();

      toast.success(typeof textoExito === 'function' ? textoExito(resultado) : textoExito);
    } catch (error) {
      toast.error(error?.message || 'No se pudo completar la acción.');
    }
  };

  return (
    <Card sx={[{ p: 2.5 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
          {bloque?.nombre}
        </Typography>
        <Label color={COLOR_DEL_ESTADO[estado.estado]}>{ETIQUETAS_DEL_ESTADO[estado.estado]}</Label>
      </Stack>

      {esExterno ? (
        <>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Este encabezado tiene su propio editor visual, sobre la tienda misma.
          </Typography>
          <Button
            component={RouterLink}
            href={paths.dashboard.product.root}
            variant="outlined"
            startIcon={<Iconify icon="solar:cart-3-bold" />}
          >
            Abrir la tienda
          </Button>
        </>
      ) : (
        <>
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {publicadoEnVivo
                ? `En vivo: publicado ${estado.enVivo.publicadoEn ? `el ${fDateTime(estado.enVivo.publicadoEn)}` : ''} por ${quien(estado.enVivo.publicadoPor)}.`
                : 'En vivo: el diseño original.'}
            </Typography>

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {vecesVisto(analiticas)}
            </Typography>

            {estado.borrador && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {guardando
                  ? 'Guardando borrador…'
                  : `Borrador guardado ${estado.borrador.guardadoEn ? `el ${fDateTime(estado.borrador.guardadoEn)}` : ''}.`}
              </Typography>
            )}
          </Stack>

          {estado.borrador && !estado.borrador.valido && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              El borrador tiene datos que todavía no se pueden publicar. La vista previa enseña lo
              que está en vivo hasta que se corrijan.
            </Alert>
          )}

          <Tabs
            value={pestana}
            onChange={(evento, nueva) => setPestana(nueva)}
            sx={{ mb: 2 }}
            variant="fullWidth"
          >
            <Tab value="contenido" label="Contenido" />
            <Tab value="diseno" label="Diseño" />
          </Tabs>

          {pestana === 'contenido' &&
            (editor ?? (
              <Alert severity="info" sx={{ mb: 2 }}>
                Este bloque todavía no tiene editor de contenido. Su diseño sí se puede cambiar.
              </Alert>
            ))}

          {pestana === 'diseno' && editorDeDiseno}

          <Divider sx={{ my: 2, borderStyle: 'dashed' }} />

          <Stack spacing={1}>
            {estado.idBloque === 'comunicados' && (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={avisar}
                    onChange={(evento) => setAvisar(evento.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">
                    Avisar en la campana de los comunicados nuevos
                  </Typography>
                }
              />
            )}

            <Button
              variant="contained"
              startIcon={<Iconify icon="eva:cloud-upload-fill" />}
              disabled={!estado.borrador?.valido || Boolean(accion)}
              loading={accion === 'publicar'}
              onClick={conAviso(
                () =>
                  onPublicar?.(estado.idBloque, {
                    avisar: estado.idBloque === 'comunicados' && avisar,
                  }),
                (resultado) =>
                  resultado?.avisados
                    ? `"${bloque?.nombre}" publicado. Se avisó de ${resultado.avisados} comunicado(s) en la campana.`
                    : `"${bloque?.nombre}" publicado.`
              )}
            >
              Publicar
            </Button>

            {estado.borrador && (
              <Button
                color="inherit"
                variant="outlined"
                startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                disabled={Boolean(accion)}
                loading={accion === 'descartar'}
                onClick={conAviso(
                  () => onDescartarBorrador?.(estado.idBloque),
                  'Borrador descartado.'
                )}
              >
                Descartar borrador
              </Button>
            )}

            {publicadoEnVivo && (
              <Button
                color="error"
                variant="text"
                startIcon={<Iconify icon="solar:restart-bold" />}
                disabled={Boolean(accion)}
                onClick={() => setConfirmarOriginal(true)}
              >
                Volver al original
              </Button>
            )}
          </Stack>
        </>
      )}

      <ConfirmDialog
        open={confirmarOriginal}
        onClose={() => setConfirmarOriginal(false)}
        title="¿Volver al diseño original?"
        content={`"${bloque?.nombre}" dejará de mostrar lo publicado y volverá a verse como antes, para toda la organización. Queda registrado en Historial.`}
        action={
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              await conAviso(
                () => onVolverAlOriginal?.(estado.idBloque),
                `"${bloque?.nombre}" volvió a su diseño original.`
              )();
              setConfirmarOriginal(false);
            }}
          >
            Volver al original
          </Button>
        }
      />
    </Card>
  );
}
