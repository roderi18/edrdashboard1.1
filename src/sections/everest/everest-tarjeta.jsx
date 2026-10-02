'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { puedeEnDesigner } from 'src/utils/org-level-access';
import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';
import { recortarBordesTransparentes } from 'src/utils/recortar-bordes-transparentes';
import {
  MAX_CAPAS,
  LIMITES_CAPA,
  TEXTO_DE_CAPA,
  FUENTES_TARJETA,
  LIMITES_TARJETA,
  ID_TARJETA_DEMO,
  TARJETA_DE_FABRICA,
} from 'src/utils/tarjeta-editable.mjs';

import { leerTarjetaEditable, guardarTarjetaEditable } from 'src/services/tarjeta-editable-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { RecorteDeFoto } from 'src/components/upload/recorte-de-foto';
import { TarjetaEditable } from 'src/components/tarjeta-editable/tarjeta-editable';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// EXPLORA DESIGNER → TARJETA (`?seccion=tarjeta`).
//
// Nació en "Desarrollo · pantalla" (`/dashboard/desarrollo/tarjeta`, que ahora
// solo redirige aquí): es diseño, del mismo Administrador Global del Designer.
//
// El recuadro de `/dashboard/course` rehecho con los componentes de la casa,
// y a su derecha los controles: foto, título y subtítulo, letra (tipo y
// tamaño), tamaño del contenedor e imágenes flotantes encima de la foto
// (se arrastran sobre la vista previa). Los
// cambios se ven al momento y se guardan al pulsar "Guardar" en
// `tarjetas_desarrollo/demo` (regla de Firestore: solo Administrador Global).
// La foto va a `everest/tarjeta-desarrollo/`, carpeta que ya solo escribe él.
// ----------------------------------------------------------------------

export function EverestTarjeta() {
  const { user } = useAuthContext();
  // Quien puede editar la Tarjeta (el Administrador Global, o a quien se la dé "Accesos").
  const esAdmin = puedeEnDesigner(user, 'tarjeta', 'editar');

  const [tarjeta, setTarjeta] = useState(() => ({ ...TARJETA_DE_FABRICA }));
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const inputFoto = useRef(null);
  // El archivo original de esta visita: recortar de nuevo no lo vuelve a bajar.
  const originalRef = useRef(null);
  const [porRecortar, setPorRecortar] = useState(null);
  const [preparandoRecorte, setPreparandoRecorte] = useState(false);
  const inputCapa = useRef(null);
  const [subiendoCapa, setSubiendoCapa] = useState(false);

  useEffect(() => {
    if (!esAdmin) return undefined;
    let vigente = true;

    leerTarjetaEditable(ID_TARJETA_DEMO)
      .then((guardada) => {
        if (vigente && guardada) setTarjeta(guardada);
      })
      .catch(() => {
        // "No se pudo leer" no borra lo que ya se ve: sigue la de fábrica.
      });

    return () => {
      vigente = false;
    };
  }, [esAdmin]);

  if (!esAdmin) {
    return <Alert severity="error">La tarjeta es solo para el Administrador Global.</Alert>;
  }

  const cambiar = (campo) => (event) =>
    setTarjeta((actual) => ({ ...actual, [campo]: event.target.value }));
  const cambiarTamano = (campo) => (_event, valor) =>
    setTarjeta((actual) => ({ ...actual, [campo]: valor }));

  // La proporción del recorte es la del hueco de la foto en la tarjeta (el
  // ancho menos el margen de 8 px a cada lado): lo que se encuadra es lo que se ve.
  const aspecto = Math.max(0.2, (tarjeta.ancho - 16) / tarjeta.altoImagen);

  const subir = (archivo, sufijo) =>
    uploadOptimizedImage({
      file: archivo,
      preset: 'general',
      storagePath: `everest/tarjeta-desarrollo/${ID_TARJETA_DEMO}-${Date.now()}-${sufijo}.webp`,
    });

  // Una foto nueva abre el recorte antes de subir nada. El original se sube a
  // la vez, para poder volver a encuadrarlo otro día.
  const elegirFoto = (event) => {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;

    originalRef.current = archivo;
    setPorRecortar(archivo);
    subir(archivo, 'original')
      .then((subida) =>
        setTarjeta((actual) => ({ ...actual, imagenOriginalUrl: subida.downloadUrl }))
      )
      .catch(() => {
        // Sin original guardado, recortar otro día parte de la foto recortada.
      });
  };

  // Recortar la que ya está: el original de esta visita, o si no, el guardado
  // (o la recortada, si la tarjeta es de antes de guardar originales).
  const recortarExistente = async () => {
    if (originalRef.current) {
      setPorRecortar(originalRef.current);
      return;
    }
    const url = tarjeta.imagenOriginalUrl || tarjeta.imagenUrl;
    if (!url) return;

    setPreparandoRecorte(true);
    try {
      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error();
      const blob = await respuesta.blob();
      const archivo = new File([blob], 'tarjeta', { type: blob.type || 'image/webp' });
      originalRef.current = archivo;
      setPorRecortar(archivo);
    } catch {
      toast.error('No se pudo abrir la foto para recortarla. Vuelve a subirla.');
    } finally {
      setPreparandoRecorte(false);
    }
  };

  const usarRecorte = async (recortada) => {
    setPorRecortar(null);
    // La foto se ve al instante con una URL local mientras se sube.
    const local = URL.createObjectURL(recortada);
    setTarjeta((actual) => ({ ...actual, imagenLocal: local }));
    setSubiendo(true);

    try {
      const subida = await subir(recortada, 'recorte');
      setTarjeta((actual) => ({ ...actual, imagenUrl: subida.downloadUrl }));
    } catch (error) {
      toast.error(error?.message || 'No se pudo subir la foto.');
      setTarjeta((actual) => ({ ...actual, imagenLocal: '' }));
    } finally {
      setSubiendo(false);
    }
  };

  // IMÁGENES FLOTANTES. Se ven al instante con la URL local y se sube el
  // archivo tal cual (optimizado, sin recorte: suelen ser PNG con transparencia).
  const cambiarCapa = (id, cambios) =>
    setTarjeta((actual) => ({
      ...actual,
      capas: actual.capas.map((capa) => (capa.id === id ? { ...capa, ...cambios } : capa)),
    }));

  const quitarCapa = (id) =>
    setTarjeta((actual) => ({
      ...actual,
      capas: actual.capas.filter((capa) => capa.id !== id),
    }));

  const agregarCapa = async (event) => {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;
    if (tarjeta.capas.length >= MAX_CAPAS) {
      toast.error(`Como mucho ${MAX_CAPAS} imágenes flotantes.`);
      return;
    }

    const id = `c${Date.now()}`;
    setTarjeta((actual) => ({
      ...actual,
      capas: [
        ...actual.capas,
        {
          id,
          url: '',
          urlLocal: URL.createObjectURL(archivo),
          x: 50,
          y: 50,
          ancho: 30,
          ...TEXTO_DE_CAPA,
        },
      ],
    }));
    setSubiendoCapa(true);

    try {
      // Sin los bordes transparentes de la imagen: si no, debajo de la foto
      // dejaban un hueco que ningún margen quitaba.
      const sinBordes = await recortarBordesTransparentes(archivo);
      const subida = await uploadOptimizedImage({
        file: sinBordes,
        preset: 'general',
        storagePath: `everest/tarjeta-desarrollo/${ID_TARJETA_DEMO}-${id}-capa.webp`,
      });
      cambiarCapa(id, { url: subida.downloadUrl });
    } catch (error) {
      toast.error(error?.message || 'No se pudo subir la imagen.');
      quitarCapa(id);
    } finally {
      setSubiendoCapa(false);
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const limpia = await guardarTarjetaEditable({
        id: ID_TARJETA_DEMO,
        tarjeta,
        usuario: user,
      });
      setTarjeta(limpia);
      toast.success('Tarjeta guardada.');
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la tarjeta.');
    } finally {
      setGuardando(false);
    }
  };

  const restablecer = () => {
    originalRef.current = null;
    setTarjeta({ ...TARJETA_DE_FABRICA });
  };

  return (
    <Box
      sx={{
        gap: 3,
        display: 'grid',
        alignItems: 'start',
        gridTemplateColumns: { xs: '1fr', md: '1fr 360px' },
      }}
    >
      <Box
        sx={{
          p: { xs: 2, md: 4 },
          borderRadius: 2,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          bgcolor: 'background.neutral',
        }}
      >
        <TarjetaEditable
          tarjeta={tarjeta}
          onMoverCapa={cambiarCapa}
          // La vista previa usa el título y el subtítulo como director de muestra:
          // así {nombre} y {año} de la placa se ven ya cambiados.
          textos={{ nombre: tarjeta.titulo, anio: tarjeta.subtitulo }}
        />
      </Box>

      <Card sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          {/* Este diseño es el de la Galería de Directores Nacionales: allí el
              título y el subtítulo son el nombre y el año de cada director, y la
              foto la de cada uno. */}
          <Alert
            severity="info"
            action={
              <Button
                size="small"
                color="inherit"
                component={RouterLink}
                href={`${paths.dashboard.level.national.root}?vista=galeria`}
              >
                Ver galería
              </Button>
            }
          >
            Es el diseño de la Galería de Directores Nacionales. En el texto de las imágenes
            flotantes, escribe {'{nombre}'} y {'{año}'} para poner los de cada director.
          </Alert>

          <Typography variant="subtitle1">Foto</Typography>
          <input ref={inputFoto} hidden type="file" accept="image/*" onChange={elegirFoto} />
          <Button
            variant="outlined"
            loading={subiendo}
            startIcon={<Iconify icon="solar:gallery-add-bold" />}
            onClick={() => inputFoto.current?.click()}
          >
            {tarjeta.imagenUrl || tarjeta.imagenLocal ? 'Cambiar foto' : 'Agregar foto'}
          </Button>
          {!!(tarjeta.imagenUrl || tarjeta.imagenLocal) && (
            <Button
              variant="outlined"
              color="inherit"
              loading={preparandoRecorte}
              disabled={subiendo}
              startIcon={<Iconify icon="solar:pen-bold" />}
              onClick={recortarExistente}
            >
              Recortar foto
            </Button>
          )}
          <RecorteDeFoto
            abierto={!!porRecortar}
            archivo={porRecortar}
            aspecto={aspecto}
            forma="rect"
            onCancelar={() => setPorRecortar(null)}
            onListo={usarRecorte}
          />

          <Typography variant="subtitle1">Imágenes flotantes</Typography>
          <input ref={inputCapa} hidden type="file" accept="image/*" onChange={agregarCapa} />
          <Button
            variant="outlined"
            loading={subiendoCapa}
            disabled={tarjeta.capas.length >= MAX_CAPAS}
            startIcon={<Iconify icon="solar:add-circle-bold" />}
            onClick={() => inputCapa.current?.click()}
          >
            Agregar imagen encima
          </Button>
          {tarjeta.capas.length > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Arrástralas sobre la foto para colocarlas.
            </Typography>
          )}
          {tarjeta.capas.map((capa, indice) => (
            <Stack key={capa.id} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                component="img"
                alt={`Imagen ${indice + 1}`}
                src={capa.urlLocal || capa.url}
                sx={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
              />
              <Box sx={{ flexGrow: 1 }}>
                {/* Sobre la foto se arrastra; debajo va centrada con los textos. */}
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="Dónde va"
                  value={capa.zona || 'foto'}
                  onChange={(event) => cambiarCapa(capa.id, { zona: event.target.value })}
                  sx={{ mb: 1 }}
                >
                  <MenuItem value="foto">Sobre la foto</MenuItem>
                  <MenuItem value="textos">Debajo, con los textos</MenuItem>
                </TextField>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Tamaño: {capa.ancho}%
                </Typography>
                <Slider
                  size="small"
                  value={capa.ancho}
                  min={LIMITES_CAPA.ancho.min}
                  max={LIMITES_CAPA.ancho.max}
                  onChange={(_e, valor) => cambiarCapa(capa.id, { ancho: valor })}
                />
              </Box>
              <IconButton color="error" onClick={() => quitarCapa(capa.id)}>
                <Iconify icon="solar:trash-bin-trash-bold" />
              </IconButton>
            </Stack>
          ))}
          {tarjeta.capas.map((capa, indice) => (
            <TextoDeCapa
              key={`texto-${capa.id}`}
              capa={capa}
              numero={indice + 1}
              onCambiar={(cambios) => cambiarCapa(capa.id, cambios)}
            />
          ))}

          <Typography variant="subtitle1">Textos</Typography>
          <TextField label="Título" value={tarjeta.titulo} onChange={cambiar('titulo')} />
          <TextField label="Subtítulo" value={tarjeta.subtitulo} onChange={cambiar('subtitulo')} />
          {/* Con la barra dorada debajo diciendo nombre y año, el título y el
              subtítulo repetían lo mismo. */}
          <FormControlLabel
            control={
              <Switch
                // Con una imagen debajo de la foto, los textos se ocultan solos.
                disabled={tarjeta.capas.some((capa) => capa.zona === 'textos')}
                checked={
                  tarjeta.mostrarTextos !== false &&
                  !tarjeta.capas.some((capa) => capa.zona === 'textos')
                }
                onChange={(event) =>
                  setTarjeta((actual) => ({ ...actual, mostrarTextos: event.target.checked }))
                }
              />
            }
            label="Mostrar título y subtítulo"
          />
          {tarjeta.capas.some((capa) => capa.zona === 'textos') && (
            <>
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1.5 }}>
                Con una imagen debajo de la foto (la barra), solo se ve la barra.
              </Typography>
              {/* El hueco de la barra con la foto y con el borde de la tarjeta.
                  En negativo la acerca aunque la imagen traiga borde
                  transparente. */}
              <ControlDeTamano
                etiqueta="Margen de la barra · arriba"
                valor={tarjeta.margenBarraArriba}
                limites={LIMITES_TARJETA.margenBarra}
                onChange={cambiarTamano('margenBarraArriba')}
              />
              <ControlDeTamano
                etiqueta="Margen de la barra · abajo"
                valor={tarjeta.margenBarraAbajo}
                limites={LIMITES_TARJETA.margenBarra}
                onChange={cambiarTamano('margenBarraAbajo')}
              />
            </>
          )}

          <Typography variant="subtitle1">Letra</Typography>
          <TextField
            select
            label="Tipo de letra"
            value={tarjeta.fuente}
            onChange={cambiar('fuente')}
          >
            {FUENTES_TARJETA.map((fuente) => (
              <MenuItem
                key={fuente.id}
                value={fuente.id}
                sx={{ fontFamily: fuente.css || undefined }}
              >
                {fuente.nombre}
              </MenuItem>
            ))}
          </TextField>
          <ControlDeTamano
            etiqueta="Tamaño del título"
            valor={tarjeta.tamanoTitulo}
            limites={LIMITES_TARJETA.tamanoTitulo}
            onChange={cambiarTamano('tamanoTitulo')}
          />
          <ControlDeTamano
            etiqueta="Tamaño del subtítulo"
            valor={tarjeta.tamanoSubtitulo}
            limites={LIMITES_TARJETA.tamanoSubtitulo}
            onChange={cambiarTamano('tamanoSubtitulo')}
          />

          <Typography variant="subtitle1">Tamaño del contenedor</Typography>
          <ControlDeTamano
            etiqueta="Ancho"
            valor={tarjeta.ancho}
            limites={LIMITES_TARJETA.ancho}
            onChange={cambiarTamano('ancho')}
          />
          <ControlDeTamano
            etiqueta="Alto de la foto"
            valor={tarjeta.altoImagen}
            limites={LIMITES_TARJETA.altoImagen}
            onChange={cambiarTamano('altoImagen')}
          />
          <ControlDeTamano
            etiqueta="Redondeo"
            valor={tarjeta.radio}
            limites={LIMITES_TARJETA.radio}
            onChange={cambiarTamano('radio')}
          />

          <Stack direction="row" spacing={1.5}>
            <Button
              fullWidth
              color="inherit"
              variant="outlined"
              startIcon={<Iconify icon="solar:restart-bold" />}
              onClick={restablecer}
            >
              Restablecer
            </Button>
            <Button
              fullWidth
              variant="contained"
              loading={guardando}
              disabled={subiendo || subiendoCapa}
              startIcon={<Iconify icon="eva:cloud-upload-fill" />}
              onClick={guardar}
            >
              Guardar
            </Button>
          </Stack>
        </Stack>
      </Card>
    </Box>
  );
}

// ----------------------------------------------------------------------

// El texto de una imagen flotante (una placa: nombre arriba, años abajo).
function TextoDeCapa({ capa, numero, onCambiar }) {
  const cambiar = (campo) => (event) => onCambiar({ [campo]: event.target.value });

  return (
    <Stack spacing={1.5} sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.neutral' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Texto sobre la imagen {numero}
      </Typography>
      <TextField
        size="small"
        label="Arriba (nombre)"
        value={capa.textoArriba}
        onChange={cambiar('textoArriba')}
      />
      <TextField
        size="small"
        label="Abajo (años)"
        value={capa.textoAbajo}
        onChange={cambiar('textoAbajo')}
      />
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Letra"
          value={capa.fuenteTexto}
          onChange={cambiar('fuenteTexto')}
          sx={{ flexGrow: 1 }}
        >
          {FUENTES_TARJETA.map((fuente) => (
            <MenuItem
              key={fuente.id}
              value={fuente.id}
              sx={{ fontFamily: fuente.css || undefined }}
            >
              {fuente.nombre}
            </MenuItem>
          ))}
        </TextField>
        {/* El selector nativo, invisible encima de la muestra (como en Paleta). */}
        <Box
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 1,
            position: 'relative',
            bgcolor: capa.colorTexto,
            border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
          }}
        >
          <Box
            component="input"
            type="color"
            aria-label="Color del texto"
            value={capa.colorTexto}
            onChange={(event) => onCambiar({ colorTexto: event.target.value.toUpperCase() })}
            sx={{
              inset: 0,
              width: 1,
              height: 1,
              opacity: 0,
              border: 'none',
              cursor: 'pointer',
              position: 'absolute',
            }}
          />
        </Box>
      </Stack>
      <ControlDeTamano
        etiqueta="Tamaño del texto"
        valor={capa.tamanoTexto}
        limites={LIMITES_CAPA.tamanoTexto}
        onChange={(_e, valor) => onCambiar({ tamanoTexto: valor })}
      />
    </Stack>
  );
}

function ControlDeTamano({ etiqueta, valor, limites, onChange }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {etiqueta}: {valor}px
      </Typography>
      <Slider
        size="small"
        value={valor}
        min={limites.min}
        max={limites.max}
        onChange={onChange}
        valueLabelDisplay="auto"
      />
    </Box>
  );
}
