'use client';

import dayjs from 'dayjs';
import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { destino as destinoValido } from 'src/utils/everest/saneado.mjs';

import { subirMedioDeBloque, listarBibliotecaDeMedios } from 'src/services/everest-medios-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import ICONOS_REGISTRADOS from 'src/components/iconify/icon-sets';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// LAS PIEZAS CON LAS QUE SE ARMAN LOS EDITORES DE EXPLORA DESIGNER.
//
// Cada editor de bloque se compone con estas piezas, y cada pieza ya trae las
// reglas del proyecto: los colores se eligen por nombre (nunca un hex), los
// iconos solo de los registrados, las fechas con el calendario de la casa y los
// destinos de una lista de pantallas o una direccion https. Asi un editor nuevo
// no tiene que acordarse de nada, y lo que se escribe en el Designer es lo mismo
// que luego acepta el saneado.
//
// Todas avisan del error en el sitio —un titulo vacio, un texto demasiado
// largo— para que el "no se puede publicar" del panel tenga una causa a la vista.
// ----------------------------------------------------------------------

export function CampoTexto({
  etiqueta,
  valor,
  onCambiar,
  max = 120,
  obligatorio = false,
  multilinea = false,
  ayuda,
}) {
  const largo = String(valor ?? '').trim().length;
  const falta = obligatorio && largo === 0;
  const sobra = largo > max;

  return (
    <TextField
      fullWidth
      size="small"
      label={etiqueta}
      value={valor ?? ''}
      required={obligatorio}
      multiline={multilinea}
      minRows={multilinea ? 2 : undefined}
      onChange={(evento) => onCambiar(evento.target.value)}
      error={falta || sobra}
      helperText={
        falta ? 'Obligatorio.' : sobra ? `Máximo ${max} caracteres.` : (ayuda ?? `${largo}/${max}`)
      }
    />
  );
}

export function CampoNumero({ etiqueta, valor, onCambiar, min = 0, max, entero = true, ayuda }) {
  const numero = typeof valor === 'number' ? valor : null;
  const fuera =
    numero === null ||
    numero < min ||
    (max !== undefined && numero > max) ||
    (entero && !Number.isInteger(numero));

  return (
    <TextField
      fullWidth
      size="small"
      type="number"
      label={etiqueta}
      value={numero ?? ''}
      onChange={(evento) =>
        onCambiar(evento.target.value === '' ? undefined : Number(evento.target.value))
      }
      slotProps={{ htmlInput: { min, max, step: entero ? 1 : 'any' } }}
      error={fuera}
      helperText={fuera ? `Entre ${min} y ${max ?? '∞'}.` : ayuda}
    />
  );
}

/** Opciones con nombre. Si llevan `color`, cada una se ve con su `Label`. */
export function CampoOpciones({ etiqueta, valor, opciones, onCambiar }) {
  return (
    <TextField
      select
      fullWidth
      size="small"
      label={etiqueta}
      value={valor ?? ''}
      onChange={(evento) => onCambiar(evento.target.value)}
    >
      {opciones.map((opcion) => (
        <MenuItem key={opcion.valor} value={opcion.valor}>
          {opcion.color ? (
            <Label variant="soft" color={opcion.color}>
              {opcion.etiqueta}
            </Label>
          ) : (
            opcion.etiqueta
          )}
        </MenuItem>
      ))}
    </TextField>
  );
}

// Solo los iconos registrados: uno sin registrar se bajaria por internet.
const NOMBRES_DE_ICONOS = Object.keys(ICONOS_REGISTRADOS).sort();

export function CampoIcono({ etiqueta = 'Icono', valor, onCambiar }) {
  return (
    <Autocomplete
      size="small"
      options={NOMBRES_DE_ICONOS}
      value={valor ?? null}
      onChange={(evento, nuevo) => nuevo && onCambiar(nuevo)}
      renderOption={(props, opcion) => {
        const { key, ...resto } = props;

        return (
          <Box component="li" key={key} {...resto} sx={{ gap: 1 }}>
            <Iconify icon={opcion} width={20} />
            <Typography variant="body2" noWrap>
              {opcion}
            </Typography>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={etiqueta}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: valor ? <Iconify icon={valor} width={20} sx={{ ml: 0.5 }} /> : null,
            },
          }}
        />
      )}
    />
  );
}

// Las pantallas a las que suele llevar un boton de la portada. Se puede escribir
// cualquier otra ruta de la aplicacion, o una direccion https.
const DESTINOS_FRECUENTES = [
  { ruta: paths.dashboard.calendar, nombre: 'Calendario de actividades' },
  { ruta: paths.dashboard.certificates, nombre: 'Certificados e insignias' },
  { ruta: paths.dashboard.fileManager, nombre: 'Documentos' },
  { ruta: paths.dashboard.level.dest.root, nombre: 'Destacamentos' },
  { ruta: paths.dashboard.product.root, nombre: 'Tienda Virtual' },
  { ruta: paths.dashboard.chat, nombre: 'Mensajes' },
  { ruta: paths.dashboard.principal, nombre: 'Principal' },
];

export function CampoDestino({ etiqueta = 'Lleva a', valor, onCambiar }) {
  const invalido = Boolean(valor) && destinoValido(valor) === null;

  return (
    <Autocomplete
      freeSolo
      size="small"
      options={DESTINOS_FRECUENTES.map((destino) => destino.ruta)}
      value={valor ?? ''}
      inputValue={valor ?? ''}
      onInputChange={(evento, nuevo) => onCambiar(nuevo)}
      getOptionLabel={(opcion) => opcion}
      renderOption={(props, opcion) => {
        const { key, ...resto } = props;
        const nombre = DESTINOS_FRECUENTES.find((destino) => destino.ruta === opcion)?.nombre;

        return (
          <Box
            component="li"
            key={key}
            {...resto}
            sx={{ flexDirection: 'column', alignItems: 'flex-start !important' }}
          >
            <Typography variant="body2">{nombre}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {opcion}
            </Typography>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={etiqueta}
          error={invalido || !valor}
          helperText={
            invalido || !valor
              ? 'Una pantalla de la aplicación (/dashboard/...) o una dirección https.'
              : undefined
          }
        />
      )}
    />
  );
}

/** Una fecha `AAAA-MM-DD`, con el calendario del proyecto. */
export function CampoFecha({ etiqueta, valor, onCambiar, minimo }) {
  return (
    <DatePicker
      label={etiqueta}
      format="DD/MM/YYYY"
      value={valor ? dayjs(valor) : null}
      minDate={minimo ? dayjs(minimo) : undefined}
      onChange={(fecha) =>
        onCambiar(fecha && fecha.isValid() ? fecha.format('YYYY-MM-DD') : undefined)
      }
      slotProps={{ textField: { size: 'small', fullWidth: true } }}
    />
  );
}

/**
 * LA BIBLIOTECA: lo que ya se subio desde el Designer, para reutilizarlo sin
 * subirlo otra vez (fase 8). Elegir no publica: deja la direccion en el borrador,
 * igual que subir.
 */
function BibliotecaDeMedios({ abierta, aceptaVideo, onCerrar, onElegir }) {
  const { user } = useAuthContext();
  const [medios, setMedios] = useState(null);

  useEffect(() => {
    if (!abierta) return undefined;

    let vigente = true;

    setMedios(null);
    listarBibliotecaDeMedios({
      usuario: user,
      tipos: aceptaVideo ? ['imagen', 'video'] : ['imagen'],
    })
      .then((lista) => vigente && setMedios(lista))
      .catch((error) => {
        if (!vigente) return;
        toast.error(error?.message || 'No se pudo abrir la biblioteca.');
        setMedios([]);
      });

    return () => {
      vigente = false;
    };
  }, [abierta, aceptaVideo, user]);

  return (
    <Dialog open={abierta} onClose={onCerrar} fullWidth maxWidth="md">
      <DialogTitle>Biblioteca de medios</DialogTitle>

      <DialogContent>
        {!medios && (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        )}

        {medios && !medios.length && (
          <Typography variant="body2" sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
            Todavía no se ha subido nada desde EXPLORA Designer.
          </Typography>
        )}

        {!!medios?.length && (
          <Box
            sx={{
              gap: 1.5,
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
              },
            }}
          >
            {medios.map((medio) => (
              <Box
                key={medio.url}
                component="button"
                type="button"
                onClick={() => onElegir({ url: medio.url, tipo: medio.tipo })}
                sx={{
                  p: 0,
                  height: 110,
                  border: 0,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  borderRadius: 1,
                  position: 'relative',
                  bgcolor: 'background.neutral',
                  outline: (theme) => `solid 1px ${theme.vars.palette.divider}`,
                  '&:hover': { outline: (theme) => `solid 2px ${theme.vars.palette.primary.main}` },
                }}
              >
                {medio.tipo === 'video' ? (
                  <Box
                    component="video"
                    src={medio.url}
                    muted
                    playsInline
                    preload="metadata"
                    sx={{ width: 1, height: 1, objectFit: 'cover' }}
                  />
                ) : (
                  <Box
                    component="img"
                    src={medio.url}
                    alt=""
                    loading="lazy"
                    sx={{ width: 1, height: 1, objectFit: 'cover' }}
                  />
                )}
                <Label
                  variant="filled"
                  sx={{ left: 6, bottom: 6, position: 'absolute', textTransform: 'none' }}
                >
                  {medio.tipo === 'video' ? 'Video' : 'Imagen'}
                </Label>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onCerrar}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * El fondo propio de una tarjeta. Subir no publica: deja la direccion en el
 * borrador. "Quitar" vuelve al fondo de siempre.
 */
export function CampoMedio({ idBloque, valor, onCambiar, aceptaVideo = false }) {
  const { user } = useAuthContext();
  const entradaRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [biblioteca, setBiblioteca] = useState(false);

  const elegir = async (evento) => {
    const archivo = evento.target.files?.[0];

    // Se vacia siempre: sin esto, elegir dos veces el mismo archivo no avisaba.
    evento.target.value = '';

    if (!archivo) return;

    setSubiendo(true);

    try {
      onCambiar(await subirMedioDeBloque({ idBloque, archivo, aceptaVideo, usuario: user }));
    } catch (error) {
      toast.error(error?.message || 'No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Fondo</Typography>

      {valor ? (
        <Box
          sx={{
            height: 120,
            overflow: 'hidden',
            borderRadius: 1,
            bgcolor: 'background.neutral',
          }}
        >
          {valor.tipo === 'video' ? (
            <Box
              component="video"
              src={valor.url}
              muted
              loop
              autoPlay
              playsInline
              sx={{ width: 1, height: 1, objectFit: 'cover' }}
            />
          ) : (
            <Box
              component="img"
              src={valor.url}
              alt="Fondo"
              sx={{ width: 1, height: 1, objectFit: 'cover' }}
            />
          )}
        </Box>
      ) : (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Se usa el fondo de siempre.
        </Typography>
      )}

      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          loading={subiendo}
          startIcon={<Iconify icon="solar:gallery-add-bold" />}
          onClick={() => entradaRef.current?.click()}
        >
          {valor ? 'Cambiar' : 'Subir'}
        </Button>

        <Button
          size="small"
          color="inherit"
          startIcon={<Iconify icon="solar:gallery-wide-bold" />}
          onClick={() => setBiblioteca(true)}
        >
          Biblioteca
        </Button>

        {valor && (
          <Button size="small" color="inherit" onClick={() => onCambiar(undefined)}>
            Quitar
          </Button>
        )}
      </Stack>

      <input
        ref={entradaRef}
        hidden
        type="file"
        accept={aceptaVideo ? 'image/*,video/mp4,video/webm' : 'image/*'}
        onChange={elegir}
      />

      <BibliotecaDeMedios
        abierta={biblioteca}
        aceptaVideo={aceptaVideo}
        onCerrar={() => setBiblioteca(false)}
        onElegir={(medio) => {
          onCambiar(medio);
          setBiblioteca(false);
        }}
      />
    </Stack>
  );
}

/**
 * Una lista que se ordena, se amplia y se recorta. Cada elemento se edita con
 * `renderElemento(elemento, cambiarElemento)`.
 */
export function ListaEditable({
  titulo,
  elementos = [],
  onCambiar,
  nuevo,
  max = 10,
  etiquetaDe,
  renderElemento,
}) {
  const cambiarEn = (indice, cambio) =>
    onCambiar(
      elementos.map((elemento, i) => (i === indice ? { ...elemento, ...cambio } : elemento))
    );

  const mover = (indice, paso) => {
    const destino = indice + paso;

    if (destino < 0 || destino >= elementos.length) return;

    const copia = [...elementos];

    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    onCambiar(copia);
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2">
          {titulo} ({elementos.length}/{max})
        </Typography>

        <Button
          size="small"
          startIcon={<Iconify icon="mingcute:add-line" />}
          disabled={elementos.length >= max}
          onClick={() => onCambiar([...elementos, nuevo()])}
        >
          Añadir
        </Button>
      </Stack>

      {elementos.map((elemento, indice) => (
        <Card key={elemento.clave ?? indice} variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ flexGrow: 1, color: 'text.secondary' }} noWrap>
              {indice + 1}. {etiquetaDe?.(elemento) || 'Sin título'}
            </Typography>

            <Tooltip title="Subir">
              <span>
                <IconButton size="small" disabled={indice === 0} onClick={() => mover(indice, -1)}>
                  <Iconify icon="eva:arrow-upward-fill" width={18} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Bajar">
              <span>
                <IconButton
                  size="small"
                  disabled={indice === elementos.length - 1}
                  onClick={() => mover(indice, 1)}
                >
                  <Iconify icon="eva:arrow-downward-fill" width={18} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Quitar">
              <IconButton
                size="small"
                color="error"
                onClick={() => onCambiar(elementos.filter((_, i) => i !== indice))}
              >
                <Iconify icon="solar:trash-bin-trash-bold" width={18} />
              </IconButton>
            </Tooltip>
          </Stack>

          <Stack spacing={1.5}>
            {renderElemento(elemento, (cambio) => cambiarEn(indice, cambio))}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

/** Una clave nueva y unica para un elemento de lista. */
export const claveNueva = (prefijo = 'item') =>
  `${prefijo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
