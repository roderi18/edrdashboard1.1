'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import SvgIcon from '@mui/material/SvgIcon';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';
import FormControlLabel from '@mui/material/FormControlLabel';

import { Iconify } from 'src/components/iconify';

import {
  limitar,
  STORAGE_KEY,
  crearElemento,
  ESCENA_INICIAL,
  normalizarEscena,
} from './composicion-mapa.mjs';

const NIVELES_ENTIDAD = [
  { valor: 'nacional', nombre: 'Consejo Nacional' },
  { valor: 'region', nombre: 'Regiones' },
  { valor: 'seccion', nombre: 'Secciones' },
  { valor: 'destacamento', nombre: 'Destacamentos' },
];

const ICONOS_DE_FORMA = [
  { valor: 'solar:medal-star-circle-bold', nombre: 'Medalla' },
  { valor: 'solar:flag-bold', nombre: 'Bandera' },
  { valor: 'solar:heart-bold', nombre: 'Corazón' },
  { valor: 'solar:medical-kit-bold', nombre: 'Botiquín' },
];

const CONSEJO_NACIONAL = {
  id: 'consejo-nacional',
  nombre: 'Consejo Nacional',
  imagen: '/insignias/consejo-nacional.webp',
};

function useEntidadesOrganizacionales(activo) {
  const [datos, setDatos] = useState({ regiones: [], secciones: [], destacamentos: [] });
  const [fotos, setFotos] = useState({ region: {}, seccion: {}, destacamento: {} });
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!activo) return undefined;
    let vigente = true;
    setCargando(true);

    // Este editor excluye miembros desde el origen: solo pide los tres catálogos
    // de entidades y aprovecha sus cachés e imágenes ya usadas por sus listados.
    Promise.all([
      import('src/services/regional-service'),
      import('src/services/sectional-service'),
      import('src/services/dest-service'),
    ])
      .then(([regionales, seccionales, destacamentos]) =>
        Promise.all([
          regionales.getRegionals({ includePhotos: false }),
          seccionales.getSectionals({ includePhotos: false }),
          destacamentos.getDestsApi({ includePhotos: false }),
        ])
      )
      .then(([regiones, secciones, destacamentos]) => {
        if (!vigente) return;
        setDatos({ regiones, secciones, destacamentos });
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    import('src/utils/firebase-photos').then(({ obtenerFotosPrincipalesPorEntidad }) => {
      Promise.all(
        ['region', 'seccion', 'destacamento'].map((tipoEntidad) =>
          obtenerFotosPrincipalesPorEntidad({ tipoEntidad }).catch(() => ({}))
        )
      ).then(([region, seccion, destacamento]) => {
        if (vigente) setFotos({ region, seccion, destacamento });
      });
    });

    return () => {
      vigente = false;
    };
  }, [activo]);

  return { ...datos, fotos, cargando };
}

const BOTON_SX = {
  color: 'common.white',
  '&:hover': { bgcolor: 'rgba(255,255,255,.12)' },
};

function IconoHerramienta({ tipo }) {
  const caminos = {
    rectangulo: <path d="M4 5h16v14H4V5zm2 2v10h12V7H6z" />,
    circulo: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14z" />,
    linea: <path d="m5.2 19.8-1-1L18.8 4.2l1 1L5.2 19.8z" />,
    texto: <path d="M5 4v3h5.5v13h3V7H19V4H5z" />,
    icono: (
      <path d="m12 2 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2z" />
    ),
    entidad: (
      <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h16V5H4zm3 11 3-4 2.2 2.7L15 11l4 5H7zm2-8.5A1.5 1.5 0 1 1 9 10a1.5 1.5 0 0 1 0-3z" />
    ),
    guardar: <path d="M5 3h12l3 3v15H4V3h1zm1 2v14h12V7l-2-2H6zm2 0h7v5H8V5zm1 8h6v5H9v-5z" />,
    frente: <path d="M7 7h10v10H7V7zm-3 3h2v8h8v2H4V10zm6-6h10v10h-2V6h-8V4z" />,
    invertir: (
      <path d="M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7V7zm10 10H6l3 3-1.4 1.4L2.2 16l5.4-5.4L9 12l-3 3h11v2z" />
    ),
  };
  return <SvgIcon>{caminos[tipo]}</SvgIcon>;
}

export function useComposicionMapa() {
  const [activo, setActivo] = useState(false);
  const [escena, setEscena] = useState(ESCENA_INICIAL);
  const [seleccionado, setSeleccionado] = useState(null);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(STORAGE_KEY);
      if (guardado) setEscena(normalizarEscena(JSON.parse(guardado)));
    } catch {
      // Una composición antigua o incompleta no debe impedir que el mapa cargue.
    }
  }, []);

  const actualizar = useCallback((id, cambios) => {
    setEscena((actual) => {
      if (id === 'mapa') {
        return { ...actual, mapa: normalizarEscena({ mapa: { ...actual.mapa, ...cambios } }).mapa };
      }
      return {
        ...actual,
        elementos: actual.elementos.map((elemento) =>
          elemento.id === id ? { ...elemento, ...cambios } : elemento
        ),
      };
    });
  }, []);

  const agregar = useCallback(
    (tipo) => {
      // La selección se cambia fuera del actualizador de React; así cada alta
      // queda seleccionada de inmediato incluso al crear varios elementos seguidos.
      const elemento = crearElemento(tipo, escena.elementos.length);
      setEscena((actual) => ({ ...actual, elementos: [...actual.elementos, elemento] }));
      setSeleccionado(elemento.id);
    },
    [escena.elementos.length]
  );

  const eliminar = useCallback((id) => {
    if (!id || id === 'mapa') return;
    setEscena((actual) => ({
      ...actual,
      elementos: actual.elementos.filter((elemento) => elemento.id !== id),
    }));
    setSeleccionado(null);
  }, []);

  const duplicar = useCallback((id) => {
    setEscena((actual) => {
      const original = actual.elementos.find((elemento) => elemento.id === id);
      if (!original) return actual;
      const copia = {
        ...original,
        id: `${original.tipo}-${Date.now()}`,
        x: limitar(original.x + 2, 0, 100 - original.ancho),
        y: limitar(original.y + 2, 0, 100 - original.alto),
        z: Math.max(3, ...actual.elementos.map((elemento) => elemento.z || 3)) + 1,
      };
      setSeleccionado(copia.id);
      return { ...actual, elementos: [...actual.elementos, copia] };
    });
  }, []);

  const traerAlFrente = useCallback(
    (id) => {
      const maximo = Math.max(3, ...escena.elementos.map((elemento) => elemento.z || 3));
      actualizar(id, { z: maximo + 1 });
    },
    [actualizar, escena.elementos]
  );

  const guardar = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(escena));
    setMensaje('Composición guardada en este navegador');
  }, [escena]);

  const elementoSeleccionado =
    seleccionado === 'mapa'
      ? escena.mapa
      : escena.elementos.find((elemento) => elemento.id === seleccionado) || null;

  return {
    activo,
    escena,
    mensaje,
    seleccionado,
    elementoSeleccionado,
    setActivo,
    setMensaje,
    setSeleccionado,
    actualizar,
    agregar,
    eliminar,
    duplicar,
    traerAlFrente,
    guardar,
  };
}

export function MarcoEditable({
  marco,
  activo,
  seleccionado,
  contenedorRef,
  onSeleccionar,
  onCambiar,
  children,
}) {
  const operacion = useRef(null);
  const esMapa = marco.tipo === 'mapa';
  const estaSeleccionado = activo && seleccionado === marco.id;

  const iniciar = (modo) => (evento) => {
    if (!activo || evento.button > 0) return;
    evento.preventDefault();
    evento.stopPropagation();
    evento.currentTarget.setPointerCapture(evento.pointerId);
    const contenedor = contenedorRef.current?.getBoundingClientRect();
    if (!contenedor) return;
    onSeleccionar(marco.id);
    operacion.current = {
      modo,
      pointerId: evento.pointerId,
      inicioX: evento.clientX,
      inicioY: evento.clientY,
      contenedor,
      marco: { ...marco },
    };
  };

  const mover = (evento) => {
    const actual = operacion.current;
    if (!actual || actual.pointerId !== evento.pointerId) return;
    evento.preventDefault();
    const dx = ((evento.clientX - actual.inicioX) / actual.contenedor.width) * 100;
    const dy = ((evento.clientY - actual.inicioY) / actual.contenedor.height) * 100;

    if (actual.modo === 'mover') {
      onCambiar(marco.id, {
        x: limitar(actual.marco.x + dx, 0, 100 - actual.marco.ancho),
        y: limitar(actual.marco.y + dy, 0, 100 - actual.marco.alto),
      });
      return;
    }

    const minimoAncho = esMapa ? 25 : marco.tipo === 'linea' ? 6 : 4;
    const minimoAlto = esMapa ? 25 : 3;
    onCambiar(marco.id, {
      ancho: limitar(actual.marco.ancho + dx, minimoAncho, 100 - actual.marco.x),
      alto: limitar(actual.marco.alto + dy, minimoAlto, 100 - actual.marco.y),
    });
  };

  const terminar = (evento) => {
    if (operacion.current?.pointerId === evento.pointerId) operacion.current = null;
  };

  return (
    <Box
      onPointerDown={iniciar('mover')}
      onPointerMove={mover}
      onPointerUp={terminar}
      onPointerCancel={terminar}
      sx={{
        position: 'absolute',
        left: `${marco.x}%`,
        top: `${marco.y}%`,
        width: `${marco.ancho}%`,
        height: `${marco.alto}%`,
        zIndex: marco.z,
        touchAction: activo ? 'none' : 'auto',
        cursor: activo ? 'move' : 'inherit',
        ...(estaSeleccionado && marco.tipo !== 'entidad' && {
          outline: '2px solid #f4b942',
          outlineOffset: '-2px',
          boxShadow: 'inset 0 0 0 1px rgba(7,31,58,.55)',
        }),
      }}
    >
      {children}
      {estaSeleccionado && (
        <Box
          role="button"
          aria-label={`Cambiar tamaño de ${esMapa ? 'mapa' : marco.tipo}`}
          tabIndex={0}
          onPointerDown={iniciar('redimensionar')}
          sx={{
            position: 'absolute',
            right: 3,
            bottom: 3,
            width: 18,
            height: 18,
            bgcolor: '#f4b942',
            border: '2px solid white',
            borderRadius: 0.75,
            cursor: 'nwse-resize',
            zIndex: 4,
          }}
        />
      )}
    </Box>
  );
}

function Figura({ elemento }) {
  const comun = { width: 1, height: 1, opacity: elemento.opacidad ?? 1 };

  if (elemento.tipo === 'rectangulo') {
    return (
      <Box
        sx={{
          ...comun,
          border: `3px solid ${elemento.color}`,
          bgcolor: `${elemento.color}22`,
          borderRadius: 1,
        }}
      />
    );
  }
  if (elemento.tipo === 'circulo') {
    return (
      <Box
        sx={{
          ...comun,
          border: `3px solid ${elemento.color}`,
          bgcolor: `${elemento.color}22`,
          borderRadius: '50%',
        }}
      />
    );
  }
  if (elemento.tipo === 'linea') {
    return (
      <Box component="svg" viewBox="0 0 100 100" preserveAspectRatio="none" sx={comun}>
        <line
          x1="2"
          y1={elemento.invertida ? 2 : 98}
          x2="98"
          y2={elemento.invertida ? 98 : 2}
          stroke={elemento.color}
          strokeWidth="4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </Box>
    );
  }
  if (elemento.tipo === 'texto') {
    return (
      <Box
        sx={{
          ...comun,
          color: elemento.color,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: `${elemento.tamanoTexto || 24}px`,
          lineHeight: 1.1,
        }}
      >
        {elemento.texto}
      </Box>
    );
  }
  if (elemento.tipo === 'icono') {
    return (
      <Box sx={{ ...comun, color: elemento.color, display: 'grid', placeItems: 'center' }}>
        <Iconify icon={elemento.icono} width="78%" height="78%" />
      </Box>
    );
  }
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={0.4}
      sx={{ ...comun, color: elemento.color }}
    >
      {elemento.imagenEntidad && (
        <Box
          component="img"
          src={elemento.imagenEntidad}
          alt={elemento.nombreEntidad || 'Entidad organizacional'}
          draggable={false}
          sx={{
            width: elemento.mostrarNombre ? '74%' : '100%',
            height: elemento.mostrarNombre ? '74%' : '100%',
            display: 'block',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      )}
      {!elemento.imagenEntidad && (
        <Typography
          variant="caption"
          sx={{ color: 'rgba(255,255,255,.7)', textAlign: 'center' }}
        >
          Selecciona una entidad con imagen
        </Typography>
      )}
      {elemento.mostrarNombre && (
        <Typography
          component="span"
          sx={{
            maxWidth: 1,
            color: elemento.color,
            fontSize: `${elemento.tamanoTexto || 13}px`,
            fontWeight: 700,
            lineHeight: 1.05,
            textAlign: 'center',
            textShadow: '0 1px 3px rgba(0,0,0,.8)',
          }}
        >
          {elemento.nombreEntidad || 'Selecciona una entidad'}
        </Typography>
      )}
    </Stack>
  );
}

export function ElementosEditables({ editor, contenedorRef }) {
  return editor.escena.elementos.map((elemento) => (
    <MarcoEditable
      key={elemento.id}
      marco={elemento}
      activo={editor.activo}
      seleccionado={editor.seleccionado}
      contenedorRef={contenedorRef}
      onSeleccionar={editor.setSeleccionado}
      onCambiar={editor.actualizar}
    >
      <Figura elemento={elemento} />
    </MarcoEditable>
  ));
}

export function PanelEditorMapa({ editor }) {
  const organizacion = useEntidadesOrganizacionales(editor.activo);
  if (!editor.activo) return null;
  const elemento = editor.elementoSeleccionado;
  const entidadesPorNivel = {
    nacional: [CONSEJO_NACIONAL],
    region: organizacion.regiones.map((entidad) => ({
      id: String(entidad.id ?? entidad.regionId ?? ''),
      nombre: entidad.regionalName || entidad.name || entidad.nombre || 'Región',
      imagen: organizacion.fotos.region?.[String(entidad.id ?? entidad.regionId)]?.urlFoto || '',
    })),
    seccion: organizacion.secciones.map((entidad) => ({
      id: String(entidad.id ?? entidad.idSeccion ?? ''),
      nombre: entidad.sectionalName || entidad.name || entidad.nombre || 'Sección',
      imagen: organizacion.fotos.seccion?.[String(entidad.id ?? entidad.idSeccion)]?.urlFoto || '',
    })),
    destacamento: organizacion.destacamentos.map((entidad) => ({
      id: String(entidad.id ?? entidad.idDestacamento ?? ''),
      nombre:
        [entidad.name || entidad.nombre, entidad.destNumber || entidad.numero]
          .filter(Boolean)
          .join(' ') || 'Destacamento',
      imagen:
        organizacion.fotos.destacamento?.[String(entidad.id ?? entidad.idDestacamento)]?.urlFoto ||
        entidad.logo ||
        '',
    })),
  };
  const entidadesDisponibles =
    elemento?.tipo === 'entidad' ? entidadesPorNivel[elemento.nivelEntidad] || [] : [];
  const entidadElegida =
    entidadesDisponibles.find((entidad) => entidad.id === elemento?.entidadId) || null;

  return (
    <Paper
      elevation={10}
      sx={{
        position: 'absolute',
        top: 'max(16px, env(safe-area-inset-top))',
        left: 'max(16px, env(safe-area-inset-left))',
        width: { xs: 'calc(100% - 112px)', sm: 360 },
        maxWidth: 420,
        zIndex: 1100,
        p: 1,
        color: 'common.white',
        bgcolor: 'rgba(7, 31, 58, .96)',
        backdropFilter: 'blur(12px)',
        borderRadius: 2,
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" spacing={0.25}>
          <Typography variant="subtitle2" sx={{ px: 1, mr: 'auto' }}>
            Editor de composición
          </Typography>
          <Tooltip title="Guardar posiciones y tamaños">
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<IconoHerramienta tipo="guardar" />}
              onClick={editor.guardar}
            >
              Guardar
            </Button>
          </Tooltip>
        </Stack>

        <Stack direction="row" sx={{ overflowX: 'auto' }}>
          {['rectangulo', 'circulo', 'linea', 'texto', 'icono', 'entidad'].map((tipo) => (
            <Tooltip
              key={tipo}
              title={`Agregar ${tipo === 'entidad' ? 'imagen organizacional' : tipo}`}
            >
              <IconButton
                aria-label={`Agregar ${tipo === 'entidad' ? 'imagen de entidad organizacional' : tipo}`}
                onClick={() => editor.agregar(tipo)}
                sx={BOTON_SX}
              >
                <IconoHerramienta tipo={tipo} />
              </IconButton>
            </Tooltip>
          ))}
        </Stack>

        <Typography variant="caption" sx={{ px: 1, color: 'rgba(255,255,255,.68)' }}>
          Arrastra un elemento para moverlo y usa el tirador amarillo para cambiar su tamaño.
        </Typography>

        {elemento && (
          <Stack spacing={1} sx={{ px: 1, pb: 0.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="caption" sx={{ minWidth: 58, textTransform: 'capitalize' }}>
                {elemento.tipo === 'entidad' ? 'Entidad' : elemento.tipo}
              </Typography>
              {elemento.tipo !== 'mapa' && (
                <Box
                  component="input"
                  type="color"
                  aria-label="Color del elemento"
                  value={elemento.color}
                  onChange={(evento) =>
                    editor.actualizar(elemento.id, { color: evento.target.value })
                  }
                  sx={{
                    width: 34,
                    height: 28,
                    p: 0,
                    border: 0,
                    bgcolor: 'transparent',
                    cursor: 'pointer',
                  }}
                />
              )}
              <Box sx={{ flex: 1 }} />
              {elemento.tipo === 'linea' && (
                <Tooltip title="Invertir línea">
                  <IconButton
                    size="small"
                    aria-label="Invertir línea"
                    onClick={() =>
                      editor.actualizar(elemento.id, { invertida: !elemento.invertida })
                    }
                    sx={BOTON_SX}
                  >
                    <IconoHerramienta tipo="invertir" />
                  </IconButton>
                </Tooltip>
              )}
              {elemento.tipo !== 'mapa' && (
                <>
                  <Tooltip title="Traer al frente">
                    <IconButton
                      size="small"
                      aria-label="Traer al frente"
                      onClick={() => editor.traerAlFrente(elemento.id)}
                      sx={BOTON_SX}
                    >
                      <IconoHerramienta tipo="frente" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Duplicar">
                    <IconButton
                      size="small"
                      aria-label="Duplicar elemento"
                      onClick={() => editor.duplicar(elemento.id)}
                      sx={BOTON_SX}
                    >
                      <Iconify icon="solar:copy-bold" width={22} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <IconButton
                      size="small"
                      aria-label="Eliminar elemento"
                      onClick={() => editor.eliminar(elemento.id)}
                      sx={BOTON_SX}
                    >
                      <Iconify icon="solar:trash-bin-trash-bold" width={22} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Stack>

            {elemento.tipo === 'texto' && (
              <Stack spacing={1}>
                <TextField
                  size="small"
                  label="Texto"
                  value={elemento.texto}
                  onChange={(evento) =>
                    editor.actualizar(elemento.id, { texto: evento.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{
                    input: { color: 'common.white' },
                    label: { color: 'rgba(255,255,255,.7)' },
                  }}
                />
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                    Tamaño de letra
                  </Typography>
                  <Slider
                    size="small"
                    min={10}
                    max={72}
                    step={1}
                    value={elemento.tamanoTexto || 24}
                    valueLabelDisplay="auto"
                    onChange={(_, valor) => editor.actualizar(elemento.id, { tamanoTexto: valor })}
                    aria-label="Tamaño del texto"
                  />
                </Stack>
              </Stack>
            )}
            {elemento.tipo === 'icono' && (
              <TextField
                select
                size="small"
                label="Icono"
                value={elemento.icono || ICONOS_DE_FORMA[0].valor}
                onChange={(evento) =>
                  editor.actualizar(elemento.id, { icono: evento.target.value })
                }
                sx={{ '& .MuiSelect-select': { color: 'common.white' } }}
              >
                {ICONOS_DE_FORMA.map((icono) => (
                  <MenuItem key={icono.valor} value={icono.valor}>
                    {icono.nombre}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {elemento.tipo === 'entidad' && (
              <Stack spacing={1}>
                <TextField
                  select
                  size="small"
                  label="Nivel organizacional"
                  value={elemento.nivelEntidad || 'nacional'}
                  onChange={(evento) => {
                    const nivelEntidad = evento.target.value;
                    const primera = entidadesPorNivel[nivelEntidad]?.[0] || null;
                    editor.actualizar(elemento.id, {
                      nivelEntidad,
                      entidadId: primera?.id || '',
                      nombreEntidad: primera?.nombre || '',
                      imagenEntidad: primera?.imagen || '',
                    });
                  }}
                  sx={{ '& .MuiSelect-select': { color: 'common.white' } }}
                >
                  {NIVELES_ENTIDAD.map((nivel) => (
                    <MenuItem key={nivel.valor} value={nivel.valor}>
                      {nivel.nombre}
                    </MenuItem>
                  ))}
                </TextField>
                <Autocomplete
                  disablePortal
                  size="small"
                  options={entidadesDisponibles}
                  loading={organizacion.cargando}
                  loadingText="Cargando entidades…"
                  value={entidadElegida}
                  getOptionLabel={(opcion) => opcion.nombre || ''}
                  isOptionEqualToValue={(opcion, valor) => opcion.id === valor.id}
                  onChange={(_, opcion) =>
                    editor.actualizar(elemento.id, {
                      entidadId: opcion?.id || '',
                      nombreEntidad: opcion?.nombre || '',
                      imagenEntidad: opcion?.imagen || '',
                    })
                  }
                  noOptionsText="No hay entidades disponibles"
                  renderInput={(parametros) => (
                    <TextField
                      {...parametros}
                      label="Entidad"
                      placeholder="Busca por nombre"
                      sx={{ input: { color: 'common.white' } }}
                    />
                  )}
                />
                <FormControlLabel
                  label="Mostrar nombre"
                  sx={{ m: 0, justifyContent: 'space-between' }}
                  control={
                    <Switch
                      checked={elemento.mostrarNombre ?? true}
                      onChange={(_, checked) =>
                        editor.actualizar(elemento.id, { mostrarNombre: checked })
                      }
                      slotProps={{ input: { 'aria-label': 'Mostrar nombre de la entidad' } }}
                    />
                  }
                />
                {elemento.mostrarNombre && (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                      Tamaño del nombre
                    </Typography>
                    <Slider
                      size="small"
                      min={9}
                      max={36}
                      step={1}
                      value={elemento.tamanoTexto || 13}
                      valueLabelDisplay="auto"
                      onChange={(_, valor) =>
                        editor.actualizar(elemento.id, { tamanoTexto: valor })
                      }
                      aria-label="Tamaño del nombre de la entidad"
                    />
                  </Stack>
                )}
              </Stack>
            )}
            {elemento.tipo !== 'mapa' && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption">Opacidad</Typography>
                <Slider
                  size="small"
                  min={0.15}
                  max={1}
                  step={0.05}
                  value={elemento.opacidad ?? 1}
                  onChange={(_, valor) => editor.actualizar(elemento.id, { opacidad: valor })}
                  aria-label="Opacidad del elemento"
                />
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
