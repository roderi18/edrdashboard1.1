'use client';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { hoyISO, fechaCorta } from 'src/utils/everest/presentacion.mjs';
import { ESTADOS_DEL_BLOQUE } from 'src/utils/everest/estado-del-bloque.mjs';
import {
  estadoDeCampana,
  TIPOS_DE_AUDIENCIA,
  ESTADOS_DE_CAMPANA,
  ETIQUETAS_DE_AUDIENCIA,
  ETIQUETAS_DE_ESTADO_DE_CAMPANA,
} from 'src/utils/everest/campanas.mjs';

import { getDestsApi } from 'src/services/dest-service';
import { getRegionals } from 'src/services/regional-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { CampoFecha, CampoTexto, CampoOpciones } from './editores/campos';

// ----------------------------------------------------------------------
// LAS CAMPAÑAS DEL BLOQUE ABIERTO (fases 7 y 8).
//
// Una campaña toma lo que se esta editando —o, sin borrador, lo que esta en
// vivo— y lo pone en la portada SOLO entre dos fechas, y si se quiere, solo para
// unas regiones o unos destacamentos. Antes de empezar no se ve; al terminar
// desaparece sola y vuelve lo publicado.
//
// Programarla no toca lo publicado ni el borrador: se puede seguir editando el
// bloque para despues de la campaña.
// ----------------------------------------------------------------------

const COLOR_DEL_ESTADO = {
  [ESTADOS_DE_CAMPANA.programada]: 'info',
  [ESTADOS_DE_CAMPANA.vigente]: 'success',
  [ESTADOS_DE_CAMPANA.terminada]: 'default',
};

const OPCIONES_DE_AUDIENCIA = Object.values(TIPOS_DE_AUDIENCIA).map((tipo) => ({
  valor: tipo,
  etiqueta: ETIQUETAS_DE_AUDIENCIA[tipo],
}));

const FORMULARIO_VACIO = {
  nombre: '',
  desde: '',
  hasta: '',
  tipo: TIPOS_DE_AUDIENCIA.todos,
  elegidos: [],
  avisar: true,
};

/** Las regiones o los destacamentos para elegir, cargados al abrir el formulario. */
function useOpcionesDeAudiencia(tipo, abierto) {
  const [opciones, setOpciones] = useState({ regiones: null, destacamentos: null });

  useEffect(() => {
    if (!abierto || tipo === TIPOS_DE_AUDIENCIA.todos || opciones[tipo]) return undefined;

    let vigente = true;
    const cargar =
      tipo === TIPOS_DE_AUDIENCIA.regiones
        ? getRegionals({ includePhotos: false }).then((lista) =>
            lista.map((region) => ({
              id: String(region.id),
              nombre: region.name || region.regionalName,
            }))
          )
        : getDestsApi({ includePhotos: false }).then((lista) =>
            lista.map((destacamento) => ({
              id: String(destacamento.id),
              nombre: [destacamento.destNumber, destacamento.name].filter(Boolean).join(' — '),
            }))
          );

    cargar
      .then((lista) => {
        if (vigente)
          setOpciones((actual) => ({ ...actual, [tipo]: lista.filter((item) => item.id) }));
      })
      .catch(() => {
        if (vigente) setOpciones((actual) => ({ ...actual, [tipo]: [] }));
      });

    return () => {
      vigente = false;
    };
  }, [abierto, opciones, tipo]);

  return opciones[tipo];
}

function FormularioDeCampana({ abierto, idBloque, conBorrador, accion, onCerrar, onProgramar }) {
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const opciones = useOpcionesDeAudiencia(formulario.tipo, abierto);

  const cambiar = (campo, valor) => setFormulario((actual) => ({ ...actual, [campo]: valor }));
  const acotada = formulario.tipo !== TIPOS_DE_AUDIENCIA.todos;

  const programar = async () => {
    try {
      const campana = await onProgramar({
        nombre: formulario.nombre,
        desde: formulario.desde,
        hasta: formulario.hasta,
        audiencia: acotada
          ? {
              tipo: formulario.tipo,
              ids: formulario.elegidos.map((item) => item.id),
              nombres: formulario.elegidos.map((item) => item.nombre),
            }
          : { tipo: TIPOS_DE_AUDIENCIA.todos },
        avisar: idBloque === 'comunicados' && formulario.avisar,
      });

      toast.success(
        campana?.avisados
          ? `Campaña programada. Se avisó de ${campana.avisados} comunicado(s) en la campana.`
          : 'Campaña programada.'
      );
      setFormulario(FORMULARIO_VACIO);
      onCerrar();
    } catch (error) {
      toast.error(error?.message || 'No se pudo programar la campaña.');
    }
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>Programar campaña</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            {conBorrador
              ? 'La campaña usará el borrador que estás editando, tal como se ve en la vista previa.'
              : 'La campaña usará lo que está en vivo ahora. Edita el bloque antes si quieres otro contenido.'}
          </Alert>

          <CampoTexto
            etiqueta="Nombre de la campaña"
            valor={formulario.nombre}
            onCambiar={(valor) => cambiar('nombre', valor)}
            max={80}
            obligatorio
            ayuda="Solo para reconocerla aquí. Ej.: Investidura Nacional 2026."
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <CampoFecha
              etiqueta="Empieza"
              valor={formulario.desde}
              minimo={hoyISO()}
              onCambiar={(valor) => cambiar('desde', valor ?? '')}
            />
            <CampoFecha
              etiqueta="Termina"
              valor={formulario.hasta}
              minimo={formulario.desde || hoyISO()}
              onCambiar={(valor) => cambiar('hasta', valor ?? '')}
            />
          </Stack>

          <CampoOpciones
            etiqueta="¿Quién la ve?"
            valor={formulario.tipo}
            opciones={OPCIONES_DE_AUDIENCIA}
            onCambiar={(valor) =>
              setFormulario((actual) => ({ ...actual, tipo: valor, elegidos: [] }))
            }
          />

          {acotada && (
            <Autocomplete
              multiple
              size="small"
              loading={!opciones}
              options={opciones ?? []}
              value={formulario.elegidos}
              isOptionEqualToValue={(opcion, valor) => opcion.id === valor.id}
              getOptionLabel={(opcion) => opcion.nombre || opcion.id}
              onChange={(evento, nuevos) => cambiar('elegidos', nuevos)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={
                    formulario.tipo === TIPOS_DE_AUDIENCIA.regiones ? 'Regiones' : 'Destacamentos'
                  }
                  helperText="Quien no sea de ninguno sigue viendo lo publicado para todos."
                />
              )}
            />
          )}

          {idBloque === 'comunicados' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={formulario.avisar}
                  onChange={(evento) => cambiar('avisar', evento.target.checked)}
                />
              }
              label="Avisar en la campana de los comunicados nuevos a quien va dirigida"
            />
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button variant="contained" loading={accion === 'campana'} onClick={programar}>
          Programar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function EverestCampanasDelBloque({
  estado,
  campanas = [],
  analiticas,
  accion = '',
  onProgramar,
  onQuitar,
  onAbrir,
  sx,
}) {
  const [abierto, setAbierto] = useState(false);
  const [porQuitar, setPorQuitar] = useState(null);

  if (!estado || estado.estado === ESTADOS_DEL_BLOQUE.externo) return null;

  const hoy = hoyISO();
  const ordenadas = [...campanas].sort((a, b) => b.desde.localeCompare(a.desde));

  return (
    <Card sx={[{ p: 2.5 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Iconify icon="solar:calendar-date-bold" sx={{ color: 'text.secondary' }} />
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          Campañas
        </Typography>
        <Button
          size="small"
          startIcon={<Iconify icon="mingcute:add-line" />}
          disabled={Boolean(accion) || (estado.borrador && !estado.borrador.valido)}
          onClick={() => setAbierto(true)}
        >
          Programar
        </Button>
      </Stack>

      {!ordenadas.length && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Sin campañas. Programa una para que este bloque cambie solo entre dos fechas, para toda la
          organización o solo para una parte.
        </Typography>
      )}

      <Stack spacing={1.5}>
        {ordenadas.map((campana) => {
          const estadoDeLa = estadoDeCampana(campana, hoy);
          const contado = analiticas?.campanas?.[campana.id];

          return (
            <Stack
              key={campana.id}
              spacing={0.75}
              sx={{ p: 1.5, borderRadius: 1, border: '1px dashed', borderColor: 'divider' }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                  {campana.nombre}
                </Typography>
                <Label color={COLOR_DEL_ESTADO[estadoDeLa]}>
                  {ETIQUETAS_DE_ESTADO_DE_CAMPANA[estadoDeLa]}
                </Label>
              </Stack>

              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Del {fechaCorta(campana.desde)} al {fechaCorta(campana.hasta)} ·{' '}
                {campana.audiencia.tipo === TIPOS_DE_AUDIENCIA.todos
                  ? 'toda la organización'
                  : (campana.audiencia.nombres?.length
                      ? campana.audiencia.nombres
                      : campana.audiencia.ids
                    ).join(', ')}
              </Typography>

              {contado && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Vista {contado.impresiones} {contado.impresiones === 1 ? 'vez' : 'veces'} ·{' '}
                  {contado.clics} {contado.clics === 1 ? 'pulsación' : 'pulsaciones'}
                </Typography>
              )}

              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<Iconify icon="solar:pen-bold" />}
                  onClick={() => {
                    onAbrir?.(campana);
                    toast.info('Campaña abierta como borrador del bloque.');
                  }}
                >
                  Abrir como borrador
                </Button>
                <Button
                  size="small"
                  color="error"
                  disabled={Boolean(accion)}
                  onClick={() => setPorQuitar(campana)}
                >
                  Quitar
                </Button>
              </Stack>
            </Stack>
          );
        })}
      </Stack>

      <FormularioDeCampana
        abierto={abierto}
        idBloque={estado.idBloque}
        conBorrador={Boolean(estado.borrador)}
        accion={accion}
        onCerrar={() => setAbierto(false)}
        onProgramar={(datos) => onProgramar?.(estado.idBloque, datos)}
      />

      <ConfirmDialog
        open={Boolean(porQuitar)}
        onClose={() => setPorQuitar(null)}
        title="¿Quitar la campaña?"
        content={`"${porQuitar?.nombre}" dejará de verse en la portada (si está en curso, vuelve lo publicado). Queda registrado en Historial.`}
        action={
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              try {
                await onQuitar?.(porQuitar.id);
                toast.success('Campaña quitada.');
              } catch (error) {
                toast.error(error?.message || 'No se pudo quitar la campaña.');
              } finally {
                setPorQuitar(null);
              }
            }}
          >
            Quitar
          </Button>
        }
      />
    </Card>
  );
}
