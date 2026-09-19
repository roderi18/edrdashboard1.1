'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Accordion from '@mui/material/Accordion';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import CircularProgress from '@mui/material/CircularProgress';

import { RouterLink } from 'src/routes/components';

import { puedeEditarDirectivaHistorica } from 'src/utils/org-level-access';
import {
  CUATRIENIOS,
  claveDeTexto,
  nombreCompleto,
  cuatrienioDeFecha,
  ocupanteHistorico,
  GRUPOS_CUATRIENIO,
  NIVELES_CUATRIENIO,
  esCuatrienioVigente,
  integrantesDeEntidad,
} from 'src/utils/directiva-cuatrienios.mjs';

import { ID_CUATRIENIO_LISTADO } from 'src/catalogs/directiva-2022-2026.mjs';
import { tomarFotoDeLaDirectivaActual } from 'src/services/directiva-importacion-service';
import {
  quitarIntegrante,
  obtenerIntegrantesDelCuatrienio,
} from 'src/services/directiva-cuatrienios-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog, ConfirmEscribiendoDialog } from 'src/components/custom-dialog';

import { NationalLeadershipView } from 'src/sections/national/leadership/national-leadership-view';
import { RegionalLeadershipView } from 'src/sections/regional/leadership/regional-leadership-view';
import { SectionalLeadershipView } from 'src/sections/sectional/leadership/sectional-leadership-view';

import { useAuthContext } from 'src/auth/hooks';

import { IntegranteDialog } from './integrante-dialog';
import { ImportarListadoDialog } from './importar-listado-dialog';

// ----------------------------------------------------------------------
// Directivas por cuatrienio: la memoria de la Directiva Nacional.
//
// Cada cuatrienio se despliega en la Directiva Nacional (con sus oficiales y
// ex comandantes), cada region y, dentro, cada seccion. Cada una abre su
// organigrama con los MISMOS componentes de la directiva de hoy, pintados con
// los de entonces. Lo ven todos; lo editan el Administrador Global y la Oficina
// Nacional. Reglas en `src/utils/directiva-cuatrienios.mjs`.
// ----------------------------------------------------------------------

const VISTA_ORGANIGRAMA = {
  [NIVELES_CUATRIENIO.nacional]: NationalLeadershipView,
  [NIVELES_CUATRIENIO.regional]: RegionalLeadershipView,
  [NIVELES_CUATRIENIO.seccional]: SectionalLeadershipView,
};

const TITULO_GRUPO = {
  [GRUPOS_CUATRIENIO.directiva]: 'Directiva',
  [GRUPOS_CUATRIENIO.oficiales]: 'Oficiales de la Nacional',
  [GRUPOS_CUATRIENIO.exComandantes]: 'Ex comandantes nacionales',
};

const claveEntidad = (id, nombre) => (id ? `id:${id}` : `nombre:${claveDeTexto(nombre)}`);

// Nacional → regiones → secciones, con lo que haya en el cuatrienio.
const agrupar = (integrantes = []) => {
  const nacional = integrantes.filter((fila) => fila.nivel === NIVELES_CUATRIENIO.nacional);
  const regiones = new Map();

  const regionDe = (id, nombre) => {
    const clave = claveEntidad(id, nombre);

    if (!regiones.has(clave)) {
      regiones.set(clave, { id, nombre, integrantes: [], secciones: new Map() });
    }

    return regiones.get(clave);
  };

  integrantes.forEach((fila) => {
    if (fila.nivel === NIVELES_CUATRIENIO.regional) {
      regionDe(fila.regionId, fila.regionNombre).integrantes.push(fila);
    }

    if (fila.nivel === NIVELES_CUATRIENIO.seccional) {
      const region = regionDe(fila.regionId, fila.regionNombre);
      const clave = claveEntidad(fila.seccionId, fila.seccionNombre);

      if (!region.secciones.has(clave)) {
        region.secciones.set(clave, {
          id: fila.seccionId,
          nombre: fila.seccionNombre,
          regionId: fila.regionId,
          regionNombre: fila.regionNombre,
          integrantes: [],
        });
      }

      region.secciones.get(clave).integrantes.push(fila);
    }
  });

  const porNombre = (a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');

  return {
    nacional,
    regiones: [...regiones.values()]
      .map((region) => ({ ...region, secciones: [...region.secciones.values()].sort(porNombre) }))
      .sort(porNombre),
  };
};

const coincideConBusqueda = (integrante, busqueda) =>
  !busqueda ||
  claveDeTexto(`${nombreCompleto(integrante)} ${integrante.cargoNombre}`).includes(
    claveDeTexto(busqueda)
  );

// ----------------------------------------------------------------------

function FilaIntegrante({ integrante, puedeEditar, onEditar, onQuitar }) {
  const nombre = nombreCompleto(integrante) || 'Sin nombre';

  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 1 }}>
      <Avatar alt={nombre} src={integrante.fotoUrl || ''} sx={{ width: 40, height: 40 }}>
        {nombre.charAt(0)}
      </Avatar>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2" noWrap>
          {integrante.idMiembros ? (
            <Link
              component={RouterLink}
              href={`/dashboard/level/member/${integrante.idMiembros}/edit`}
              color="inherit"
              underline="hover"
            >
              {nombre}
            </Link>
          ) : (
            nombre
          )}
        </Typography>
        <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary' }}>
          {integrante.cargoNombre}
        </Typography>
      </Box>

      {integrante.cargo === 'provisional' && (
        <Label color="warning" variant="soft">
          Provisional
        </Label>
      )}

      {puedeEditar && (
        <>
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEditar(integrante)}>
              <Iconify icon="solar:pen-bold" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Quitar de la historia">
            <IconButton size="small" color="error" onClick={() => onQuitar(integrante)}>
              <Iconify icon="solar:trash-bin-trash-bold" width={18} />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Stack>
  );
}

function ListaIntegrantes({ filas, vacio = 'Nadie registrado.', ...acciones }) {
  if (!filas.length) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
        {vacio}
      </Typography>
    );
  }

  return filas.map((integrante) => (
    <FilaIntegrante key={integrante.id} integrante={integrante} {...acciones} />
  ));
}

function BloqueDesplegable({ titulo, subtitulo, cantidad, acciones, children, defaultExpanded }) {
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters>
      <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            {titulo}
          </Typography>
          {subtitulo && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
              {subtitulo}
            </Typography>
          )}
          <Label variant="soft">{cantidad}</Label>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {acciones && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            {acciones}
          </Stack>
        )}
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

// ----------------------------------------------------------------------

export function DirectivaCuatrieniosView() {
  const { user } = useAuthContext();
  const puedeEditar = puedeEditarDirectivaHistorica(user);
  const [cuatrienio, setCuatrienio] = useState(
    () => cuatrienioDeFecha()?.id || CUATRIENIOS[CUATRIENIOS.length - 1].id
  );
  const [integrantes, setIntegrantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [organigrama, setOrganigrama] = useState(null);
  const [edicion, setEdicion] = useState(null);
  const [aQuitar, setAQuitar] = useState(null);
  const [importando, setImportando] = useState(false);
  const [pidiendoFoto, setPidiendoFoto] = useState(false);
  const [tomandoFoto, setTomandoFoto] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      setIntegrantes(await obtenerIntegrantesDelCuatrienio(cuatrienio));
    } catch (error) {
      console.error('[directiva-cuatrienios] no se pudo leer el cuatrienio', error);
      toast.error('No se pudo leer la directiva de ese cuatrienio.');
      setIntegrantes([]);
    } finally {
      setCargando(false);
    }
  }, [cuatrienio]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(
    () => integrantes.filter((fila) => coincideConBusqueda(fila, busqueda)),
    [integrantes, busqueda]
  );
  const estructura = useMemo(() => agrupar(filtrados), [filtrados]);
  const acciones = { puedeEditar, onEditar: setEdicion, onQuitar: setAQuitar };

  const abrirOrganigrama = (nivel, { id = '', nombre = '' } = {}) => {
    const filas = integrantesDeEntidad(integrantes, { nivel, idEntidad: id, nombre });

    setOrganigrama({
      nivel,
      idEntidad: id,
      nombreEntidad: nombre,
      cuatrienio,
      obtenerOcupante: (nodeId) => ocupanteHistorico(filas, nivel, nodeId),
    });
  };

  const nuevo = (base) => setEdicion({ nuevo: true, cuatrienio, ...base });

  const confirmarQuitar = async () => {
    const integrante = aQuitar;

    setAQuitar(null);

    try {
      await quitarIntegrante({ integrante, usuario: user });
      toast.success('Se quitó de la directiva del cuatrienio.');
      cargar();
    } catch (error) {
      toast.error(error?.message || 'No se pudo quitar.');
    }
  };

  const tomarFoto = async () => {
    setPidiendoFoto(false);
    setTomandoFoto('Empezando…');

    try {
      const { integrantes: total } = await tomarFotoDeLaDirectivaActual({
        cuatrienio,
        usuario: user,
        alAvanzar: setTomandoFoto,
      });

      toast.success(`Se guardaron ${total} integrantes en la Directiva ${cuatrienio}.`);
      cargar();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la directiva de hoy.');
    } finally {
      setTomandoFoto('');
    }
  };

  const VistaOrganigrama = organigrama ? VISTA_ORGANIGRAMA[organigrama.nivel] : null;
  const botonOrganigrama = (nivel, entidad) => (
    <Button
      size="small"
      variant="outlined"
      startIcon={<Iconify icon="solar:users-group-rounded-bold" />}
      onClick={() => abrirOrganigrama(nivel, entidad)}
    >
      Ver organigrama
    </Button>
  );
  const botonAgregar = (base) =>
    puedeEditar ? (
      <Button
        size="small"
        startIcon={<Iconify icon="mingcute:add-line" />}
        onClick={() => nuevo(base)}
      >
        Agregar
      </Button>
    ) : null;

  const nacionalPorGrupo = (grupo) => estructura.nacional.filter((fila) => fila.grupo === grupo);

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={cuatrienio}
          onChange={(event, valor) => setCuatrienio(valor)}
          variant="scrollable"
          sx={{ px: 2.5 }}
        >
          {[...CUATRIENIOS].reverse().map((item) => (
            <Tab
              key={item.id}
              value={item.id}
              label={item.id}
              iconPosition="end"
              icon={
                esCuatrienioVigente(item.id) ? (
                  <Label color="success" variant="soft">
                    Vigente
                  </Label>
                ) : undefined
              }
            />
          ))}
        </Tabs>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'center' }}
          sx={{ p: 2.5 }}
        >
          <TextField
            size="small"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar persona o cargo…"
            sx={{ flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          {puedeEditar && cuatrienio === ID_CUATRIENIO_LISTADO && (
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:import-bold" />}
              onClick={() => setImportando(true)}
            >
              Cargar listado {ID_CUATRIENIO_LISTADO}
            </Button>
          )}

          {puedeEditar && esCuatrienioVigente(cuatrienio) && (
            <Button
              variant="outlined"
              disabled={Boolean(tomandoFoto)}
              startIcon={
                tomandoFoto ? (
                  <CircularProgress size={16} />
                ) : (
                  <Iconify icon="solar:camera-add-bold" />
                )
              }
              onClick={() => setPidiendoFoto(true)}
            >
              {tomandoFoto || 'Guardar la directiva de hoy'}
            </Button>
          )}
        </Stack>
      </Card>

      {cargando ? (
        <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          {!integrantes.length && (
            <Card sx={{ p: 3 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Todavía no hay nadie guardado en la Directiva {cuatrienio}.
                {puedeEditar &&
                  (cuatrienio === ID_CUATRIENIO_LISTADO
                    ? ' Usa "Cargar listado" para traer el documento de la organización.'
                    : ' Usa "Guardar la directiva de hoy" para copiar la directiva actual.')}
              </Typography>
            </Card>
          )}

          <Card>
            <BloqueDesplegable
              defaultExpanded
              titulo="Directiva Nacional"
              subtitulo="Consejo Ejecutivo"
              cantidad={estructura.nacional.length}
              acciones={
                <>
                  {botonOrganigrama(NIVELES_CUATRIENIO.nacional)}
                  {botonAgregar({ nivel: NIVELES_CUATRIENIO.nacional })}
                </>
              }
            >
              {Object.values(GRUPOS_CUATRIENIO).map((grupo) => (
                <Box key={grupo} sx={{ mt: 1.5 }}>
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                    {TITULO_GRUPO[grupo]}
                  </Typography>
                  <ListaIntegrantes filas={nacionalPorGrupo(grupo)} {...acciones} />
                </Box>
              ))}
            </BloqueDesplegable>
          </Card>

          {estructura.regiones.map((region) => (
            <Card key={claveEntidad(region.id, region.nombre)}>
              <BloqueDesplegable
                titulo={region.nombre || 'Región sin nombre'}
                subtitulo={`${region.secciones.length} secciones`}
                cantidad={
                  region.integrantes.length +
                  region.secciones.reduce((total, seccion) => total + seccion.integrantes.length, 0)
                }
                acciones={
                  <>
                    {botonOrganigrama(NIVELES_CUATRIENIO.regional, region)}
                    {botonAgregar({
                      nivel: NIVELES_CUATRIENIO.regional,
                      regionId: region.id,
                      regionNombre: region.nombre,
                    })}
                  </>
                }
              >
                <ListaIntegrantes
                  filas={region.integrantes}
                  vacio="Nadie registrado en la directiva regional."
                  {...acciones}
                />

                <Stack spacing={1} sx={{ mt: 2 }}>
                  {region.secciones.map((seccion) => (
                    <BloqueDesplegable
                      key={claveEntidad(seccion.id, seccion.nombre)}
                      titulo={`Sección ${seccion.nombre}`}
                      cantidad={seccion.integrantes.length}
                      acciones={
                        <>
                          {botonOrganigrama(NIVELES_CUATRIENIO.seccional, seccion)}
                          {botonAgregar({
                            nivel: NIVELES_CUATRIENIO.seccional,
                            regionId: region.id,
                            regionNombre: region.nombre,
                            seccionId: seccion.id,
                            seccionNombre: seccion.nombre,
                          })}
                        </>
                      }
                    >
                      <ListaIntegrantes filas={seccion.integrantes} {...acciones} />
                    </BloqueDesplegable>
                  ))}
                </Stack>
              </BloqueDesplegable>
            </Card>
          ))}

          {puedeEditar && (
            <Box>
              <Button
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => nuevo({ nivel: NIVELES_CUATRIENIO.seccional })}
              >
                Agregar en otra región o sección
              </Button>
            </Box>
          )}
        </Stack>
      )}

      <Dialog
        fullWidth
        maxWidth="xl"
        open={Boolean(organigrama)}
        onClose={() => setOrganigrama(null)}
      >
        <DialogTitle sx={{ pr: 7 }}>
          Organigrama · {organigrama?.cuatrienio}
          <IconButton
            aria-label="Cerrar"
            onClick={() => setOrganigrama(null)}
            sx={{ position: 'absolute', top: 12, right: 12 }}
          >
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {VistaOrganigrama && <VistaOrganigrama historico={organigrama} />}
        </DialogContent>
      </Dialog>

      {edicion && (
        <IntegranteDialog
          inicial={edicion}
          cuatrienio={cuatrienio}
          integrantes={integrantes}
          usuario={user}
          onClose={() => setEdicion(null)}
          onGuardado={() => {
            setEdicion(null);
            cargar();
          }}
        />
      )}

      {importando && (
        <ImportarListadoDialog
          usuario={user}
          onClose={() => setImportando(false)}
          onTerminado={() => {
            setImportando(false);
            cargar();
          }}
        />
      )}

      <ConfirmDialog
        open={pidiendoFoto}
        onClose={() => setPidiendoFoto(false)}
        title={`Guardar la directiva de hoy en ${cuatrienio}`}
        content="Se copian los cargos nacionales, regionales y seccionales que hay asignados ahora, con su foto de perfil de hoy. Si alguien ya estaba guardado en la misma casilla, se reemplaza."
        action={
          <Button variant="contained" onClick={tomarFoto}>
            Guardar
          </Button>
        }
      />

      <ConfirmEscribiendoDialog
        open={Boolean(aQuitar)}
        onClose={() => setAQuitar(null)}
        title="Quitar de la historia"
        content={
          <>
            ¿Quitar a <strong>{nombreCompleto(aQuitar || {})}</strong> ({aQuitar?.cargoNombre}) de
            la Directiva {aQuitar?.cuatrienio}? Queda constancia en Historial.
          </>
        }
        onConfirm={confirmarQuitar}
        palabra="Quitar"
        confirmLabel="Quitar"
      />
    </>
  );
}
