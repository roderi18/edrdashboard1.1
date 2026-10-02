'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { ID_TARJETA_DEMO, TARJETA_DE_FABRICA } from 'src/utils/tarjeta-editable.mjs';
import { textoDePlaca, validarDirectorNuevo } from 'src/utils/galeria-directores.mjs';

import { getMembers } from 'src/services/member-service';
import { leerTarjetaEditable } from 'src/services/tarjeta-editable-service';
import {
  leerGaleriaDeDirectores,
  agregarDirectorALaGaleria,
  editarDirectorDeLaGaleria,
  periodoDeDirectorNacionalDe,
} from 'src/services/galeria-directores-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { RecorteDeFoto } from 'src/components/upload/recorte-de-foto';
import { TarjetaEditable } from 'src/components/tarjeta-editable/tarjeta-editable';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// GALERÍA DE DIRECTORES NACIONALES (pestaña de Consejo Nacional).
//
// Una tarjeta por director —foto, nombre y año— con el diseño de EXPLORA
// Designer → Tarjeta (tamaño de la foto, letra, redondeo, placa flotante con
// {nombre} y {año}). Del año más antiguo al más reciente, en tres columnas en
// pantalla grande, cada una del tamaño exacto del Designer. Añade el Administrador Global desde aquí mismo, con la foto
// recortada a la forma de la tarjeta. Regla y orden en
// `src/utils/galeria-directores.mjs`.
// ----------------------------------------------------------------------

// LA GALERÍA HEREDA LA TARJETA TAL CUAL: mismo ancho, alto de foto, letra,
// tamaños, redondeo y placa que en EXPEDITION Designer → Tarjeta. Antes cada
// tarjeta se estiraba a su columna y la foto (y la placa encima) cambiaba de
// proporción. Ahora las columnas miden lo que la tarjeta: tres como mucho, y
// en pantallas estrechas bajan a dos o a una.
const SEPARACION = 24;

const rejillaPara = (ancho) => ({
  p: { xs: 2, md: 3 },
  mx: 'auto',
  gap: `${SEPARACION}px`,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  maxWidth: ancho * 3 + SEPARACION * 2 + 48,
});

export function GaleriaDirectores() {
  const { user } = useAuthContext();
  const esAdmin = isAdminGlobal(user);

  const [diseno, setDiseno] = useState(() => ({ ...TARJETA_DE_FABRICA }));
  const [directores, setDirectores] = useState(null);
  // null = cerrado; 'nuevo' = alta; un director = editarlo.
  const [dialogo, setDialogo] = useState(null);
  // La tarjeta elegida (un clic la marca, otro la suelta): es la que edita "Editar".
  const [seleccionado, setSeleccionado] = useState(null);
  const elegido = directores?.find((d) => d.id === seleccionado) || null;

  const cargar = useCallback(() => {
    leerGaleriaDeDirectores()
      .then(setDirectores)
      .catch(() => setDirectores((actual) => actual ?? []));
  }, []);

  useEffect(() => {
    let vigente = true;

    leerTarjetaEditable(ID_TARJETA_DEMO)
      .then((guardado) => {
        if (vigente && guardado) setDiseno(guardado);
      })
      .catch(() => {
        // Sin diseño guardado, el de fábrica.
      });
    cargar();

    return () => {
      vigente = false;
    };
  }, [cargar]);

  return (
    <>
      {esAdmin && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ px: { xs: 2, md: 3 }, pt: 3, justifyContent: 'flex-end' }}
        >
          {/* Editar va a la izquierda de Agregar; vivo solo con una tarjeta elegida. */}
          <Button
            variant="outlined"
            color="inherit"
            disabled={!elegido}
            startIcon={<Iconify icon="solar:pen-bold" />}
            onClick={() => setDialogo(elegido)}
          >
            Editar
          </Button>
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => setDialogo('nuevo')}
          >
            Agregar director
          </Button>
        </Stack>
      )}

      {directores === null && (
        <Box sx={rejillaPara(diseno.ancho)}>
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              variant="rounded"
              width={diseno.ancho}
              height={diseno.altoImagen + 90}
              sx={{ maxWidth: 1 }}
            />
          ))}
        </Box>
      )}

      {directores?.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', py: 8, textAlign: 'center' }}>
          Todavía no hay directores en la galería.
        </Typography>
      )}

      {!!directores?.length && (
        <Box sx={rejillaPara(diseno.ancho)}>
          {directores.map((director) => (
            <TarjetaEditable
              key={director.id}
              tarjeta={{ ...diseno, imagenUrl: director.fotoUrl, imagenLocal: '' }}
              textos={{
                nombre: director.nombre,
                anio: director.anio,
                placa: textoDePlaca(director),
              }}
              {...(esAdmin && {
                onClick: () =>
                  setSeleccionado((actual) => (actual === director.id ? null : director.id)),
                sx: (theme) => ({
                  cursor: 'pointer',
                  outline: '2px solid transparent',
                  outlineOffset: 2,
                  transition: theme.transitions.create('outline-color'),
                  ...(seleccionado === director.id && {
                    outlineColor: theme.vars.palette.primary.main,
                  }),
                }),
              })}
            />
          ))}
        </Box>
      )}

      {esAdmin && (
        <DialogoDirector
          abierto={!!dialogo}
          director={dialogo === 'nuevo' ? null : dialogo}
          diseno={diseno}
          usuario={user}
          onCerrar={() => setDialogo(null)}
          onGuardado={() => {
            setDialogo(null);
            cargar();
          }}
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------------

// Alta (sin `director`) o edición (con él). Al editar, la foto es opcional: sin
// elegir otra se queda la que tiene.
// EL NOMBRE SE BUSCA EN TODO EL PADRÓN. Al elegir a la persona se guarda su id
// (la lista de la Directiva casa por él) y el año se rellena con los cuatrienios
// en que fue Director Nacional. Quien no está en el padrón —los primeros
// directores— se escribe a mano, como antes.
const nombreDelMiembro = (miembro) =>
  `${miembro?.firstName ?? ''} ${miembro?.lastName ?? ''}`.replace(/\s+/g, ' ').trim();

const sinAcentos = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

function DialogoDirector({ abierto, director, diseno, usuario, onCerrar, onGuardado }) {
  const [nombre, setNombre] = useState('');
  const [idMiembros, setIdMiembros] = useState('');
  const [miembros, setMiembros] = useState(null);
  const [buscandoAnio, setBuscandoAnio] = useState(false);
  const [anio, setAnio] = useState('');
  const [foto, setFoto] = useState(null);
  const [fotoLocal, setFotoLocal] = useState('');
  const [original, setOriginal] = useState(null);
  const [porRecortar, setPorRecortar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [preparando, setPreparando] = useState(false);

  // Al abrir para editar, el formulario parte de lo que ya tiene.
  useEffect(() => {
    if (!abierto) return;
    setNombre(director?.nombre ?? '');
    setIdMiembros(director?.idMiembros ?? '');
    setAnio(director?.anio ?? '');
    setFoto(null);
    setFotoLocal('');
    setOriginal(null);
  }, [abierto, director]);

  // El padrón, al abrir (sale de la caché si ya se leyó en esta visita).
  useEffect(() => {
    if (!abierto || miembros) return undefined;
    let activo = true;

    getMembers()
      .then((lista) => activo && setMiembros(Array.isArray(lista) ? lista : []))
      .catch(() => activo && setMiembros([]));

    return () => {
      activo = false;
    };
  }, [abierto, miembros]);

  const opciones = useMemo(
    () =>
      (miembros || [])
        .map((miembro) => {
          const nombreCompleto = nombreDelMiembro(miembro);

          return {
            id: String(miembro.id ?? miembro.idMiembros ?? ''),
            nombre: nombreCompleto,
            codigo: miembro.memberId || '',
            clave: sinAcentos(`${nombreCompleto} ${miembro.memberId || ''}`),
          };
        })
        .filter((opcion) => opcion.id && opcion.nombre)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [miembros]
  );

  const elegirMiembro = async (opcion) => {
    if (!opcion || typeof opcion === 'string') return;

    setNombre(opcion.nombre);
    setIdMiembros(opcion.id);
    setBuscandoAnio(true);
    try {
      const periodo = await periodoDeDirectorNacionalDe(opcion.id);

      if (periodo) setAnio(periodo);
      else toast.info('No consta su periodo en la Directiva por cuatrienio: escribe el año.');
    } finally {
      setBuscandoAnio(false);
    }
  };

  // Recortar la foto que ya tiene: se baja una vez y se reencuadra.
  const recortarLaActual = async () => {
    if (original) {
      setPorRecortar(original);
      return;
    }
    setPreparando(true);
    try {
      const respuesta = await fetch(director.fotoUrl);
      if (!respuesta.ok) throw new Error();
      const blob = await respuesta.blob();
      const archivo = new File([blob], 'director', { type: blob.type || 'image/webp' });
      setOriginal(archivo);
      setPorRecortar(archivo);
    } catch {
      toast.error('No se pudo abrir la foto para recortarla. Elige la foto de nuevo.');
    } finally {
      setPreparando(false);
    }
  };

  // La foto se recorta con la forma del hueco de la tarjeta del Designer.
  const aspecto = Math.max(0.2, (diseno.ancho - 16) / diseno.altoImagen);

  const limpiar = () => {
    setNombre('');
    setIdMiembros('');
    setAnio('');
    setFoto(null);
    setFotoLocal('');
    setOriginal(null);
  };

  const cerrar = () => {
    if (guardando) return;
    limpiar();
    onCerrar();
  };

  const elegir = (event) => {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;
    setOriginal(archivo);
    setPorRecortar(archivo);
  };

  const guardar = async () => {
    const error = validarDirectorNuevo({
      nombre,
      anio,
      tieneFoto: Boolean(foto || director?.fotoUrl),
    });
    if (error) {
      toast.error(error);
      return;
    }

    setGuardando(true);
    try {
      if (director) {
        await editarDirectorDeLaGaleria({ director, nombre, anio, foto, usuario, idMiembros });
        toast.success('Director actualizado.');
      } else {
        await agregarDirectorALaGaleria({ nombre, anio, foto, usuario, idMiembros });
        toast.success('Director añadido a la galería.');
      }
      limpiar();
      onGuardado();
    } catch (fallo) {
      toast.error(fallo?.message || 'No se pudo guardar el director.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog
      open={abierto}
      onClose={cerrar}
      fullWidth
      // Cabe la tarjeta a su tamaño real, para que la vista previa sea la de la galería.
      slotProps={{ paper: { sx: { maxWidth: Math.max(444, diseno.ancho + 48) } } }}
    >
      <DialogTitle>{director ? 'Editar director nacional' : 'Nuevo director nacional'}</DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Autocomplete
            freeSolo
            options={opciones}
            loading={miembros === null}
            inputValue={nombre}
            onInputChange={(event, valor, motivo) => {
              setNombre(valor);
              // Escribir a mano suelta el enlace con la persona elegida.
              if (motivo === 'input') setIdMiembros('');
            }}
            onChange={(event, opcion) => elegirMiembro(opcion)}
            getOptionLabel={(opcion) => (typeof opcion === 'string' ? opcion : opcion.nombre)}
            isOptionEqualToValue={(opcion, valor) => opcion.id === valor?.id}
            filterOptions={(lista, { inputValue }) => {
              const buscado = sinAcentos(inputValue);

              if (buscado.length < 2) return [];

              return lista.filter((opcion) => opcion.clave.includes(buscado)).slice(0, 50);
            }}
            renderOption={(props, opcion) => {
              const { key, ...resto } = props;

              return (
                <li key={opcion.id || key} {...resto}>
                  <Stack>
                    <Typography variant="body2">{opcion.nombre}</Typography>
                    {opcion.codigo && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {opcion.codigo}
                      </Typography>
                    )}
                  </Stack>
                </li>
              );
            }}
            noOptionsText="Sigue escribiendo: si no está en el padrón, se guarda tal cual."
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                label="Nombre"
                helperText={
                  idMiembros
                    ? 'Miembro del padrón: el año sale de la Directiva por cuatrienio.'
                    : 'Busca en todos los miembros, o escríbelo si no está en el padrón.'
                }
              />
            )}
          />
          <TextField
            label={buscandoAnio ? 'Año (buscando…)' : 'Año'}
            disabled={buscandoAnio}
            placeholder="2008-2010"
            value={anio}
            onChange={(event) => setAnio(event.target.value)}
            // Quien dirigió dos veces lleva los dos periodos, como en su placa.
            helperText="Si dirigió más de una vez, sepáralos con / (2010-2014 / 2018-2022)."
            slotProps={{
              input: {
                endAdornment: (
                  <Button
                    size="small"
                    color="inherit"
                    sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                    startIcon={<Iconify icon="mingcute:add-line" />}
                    onClick={() =>
                      setAnio((actual) => (actual.trim() ? `${actual.trim()} / ` : ''))
                    }
                  >
                    Otro periodo
                  </Button>
                ),
              },
            }}
          />

          <Button
            component="label"
            variant="outlined"
            startIcon={<Iconify icon="solar:gallery-add-bold" />}
          >
            {foto || director ? 'Cambiar foto' : 'Elegir foto'}
            <input hidden type="file" accept="image/*" onChange={elegir} />
          </Button>
          {!!(original || director) && (
            <Button
              color="inherit"
              variant="outlined"
              loading={preparando}
              startIcon={<Iconify icon="solar:pen-bold" />}
              onClick={recortarLaActual}
            >
              Recortar foto
            </Button>
          )}

          {/* Así va a salir en la galería. */}
          <TarjetaEditable
            sx={{ mx: 'auto' }}
            tarjeta={{ ...diseno, imagenUrl: director?.fotoUrl || '', imagenLocal: fotoLocal }}
            textos={{
              nombre: nombre || 'Nombre',
              anio: anio || 'Año',
              placa: textoDePlaca({ nombre: nombre || 'Nombre', anio: anio || 'Año' }),
            }}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" loading={guardando} onClick={guardar}>
          Guardar
        </Button>
      </DialogActions>

      <RecorteDeFoto
        abierto={!!porRecortar}
        archivo={porRecortar}
        aspecto={aspecto}
        forma="rect"
        onCancelar={() => setPorRecortar(null)}
        onListo={(recortada) => {
          setPorRecortar(null);
          setFoto(recortada);
          setFotoLocal(URL.createObjectURL(recortada));
        }}
      />
    </Dialog>
  );
}
