'use client';

import { useMemo, Fragment, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import ListSubheader from '@mui/material/ListSubheader';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, usePathname, useSearchParams } from 'src/routes/hooks';

import {
  AREAS,
  RESULTADO,
  CAPACIDADES,
  analizarCombinacion,
  construirUsuarioSimulado,
} from 'src/utils/simulador-permisos';
import {
  isCombinationCapabilityValidated,
  mergeCombinationCapabilityReview,
  countValidatedCombinationCapabilities,
} from 'src/utils/role-combination-reviews';

import {
  obtenerCombinacionesRoles,
  sembrarCombinacionesRoles,
  guardarRevisionCombinacion,
  guardarRevisionCapacidadCombinacion,
} from 'src/services/combinaciones-roles-service';
import {
  rolesDeNivel,
  COMBINACIONES,
  idCombinacion,
  ETIQUETA_NIVEL,
  NIVEL_COMBINACION,
  NIVELES_ACOMPANANTES,
  ROL_COMBINABLE_POR_CODIGO,
} from 'src/catalogs/combinaciones-roles';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { TableHeadCustom } from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// Combinacion de roles.
//
// Una persona puede ocupar dos casillas a la vez y desde entonces ejerce las
// dos. Esta pantalla responde a la unica pregunta que importa: con esos dos
// cargos, ¿que puede hacer exactamente?
//
// No lo describe: lo ejecuta. Arma la sesion que armaria la aplicacion y le
// hace las MISMAS preguntas que le hacen las pantallas. Por eso no puede
// quedarse desfasada respecto a lo que de verdad pasa.
// ----------------------------------------------------------------------

const ROLES_DESTACAMENTO = rolesDeNivel(NIVEL_COMBINACION.destacamento);

const PRESENTACION = {
  [RESULTADO.si]: { texto: 'Sí', color: 'success' },
  [RESULTADO.aprobacion]: { texto: 'Con aprobación', color: 'warning' },
  [RESULTADO.no]: { texto: 'No', color: 'error' },
  [RESULTADO.oculto]: { texto: 'Oculto', color: 'default' },
};

function ResultadoLabel({ valor }) {
  const { texto, color } = PRESENTACION[valor] ?? PRESENTACION[RESULTADO.no];

  return (
    <Label variant="soft" color={color}>
      {texto}
    </Label>
  );
}

// ----------------------------------------------------------------------

function Simulador({
  codigoDestacamento,
  codigoAcompanante,
  onCambiar,
  revisionGuardada,
  onRevisarCapacidad,
  guardandoCapacidades,
  cargandoRevisiones,
}) {
  const [mostrarSueltos, setMostrarSueltos] = useState(true);

  const destacamento = ROL_COMBINABLE_POR_CODIGO[codigoDestacamento];
  const acompanante = ROL_COMBINABLE_POR_CODIGO[codigoAcompanante];

  const analisis = useMemo(
    () => (destacamento && acompanante ? analizarCombinacion({ destacamento, acompanante }) : null),
    [destacamento, acompanante]
  );

  const sesion = useMemo(
    () =>
      destacamento && acompanante
        ? construirUsuarioSimulado([destacamento, acompanante])
        : null,
    [destacamento, acompanante]
  );

  if (!analisis || !sesion) return null;

  const principal = ROL_COMBINABLE_POR_CODIGO[sesion.rolId];
  const combinationId = idCombinacion(codigoDestacamento, codigoAcompanante);
  const totalValidadas = countValidatedCombinationCapabilities(
    revisionGuardada,
    CAPACIDADES.map((capacidad) => capacidad.id)
  );

  const cabecera = [
    { id: 'validada', label: 'Correcta', width: 88 },
    { id: 'capacidad', label: 'Qué puede hacer' },
    ...(mostrarSueltos
      ? [
        { id: 'solo-dest', label: `Solo ${destacamento.nombre}`, width: 170 },
        { id: 'solo-acom', label: `Solo ${acompanante.nombre}`, width: 170 },
      ]
      : []),
    { id: 'combinado', label: 'Con los dos cargos', width: 170 },
    { id: 'solicita', label: 'Se lo pide a', width: 260 },
  ];

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <Box
          sx={{
            gap: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          }}
        >
          <TextField
            select
            fullWidth
            label="Cargo en su destacamento"
            value={codigoDestacamento}
            onChange={(event) => onCambiar(event.target.value, codigoAcompanante)}
          >
            {ROLES_DESTACAMENTO.map((rol) => (
              <MenuItem key={rol.codigo} value={rol.codigo}>
                {rol.nombre}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            fullWidth
            label="Segundo cargo"
            value={codigoAcompanante}
            onChange={(event) => onCambiar(codigoDestacamento, event.target.value)}
          >
            {NIVELES_ACOMPANANTES.flatMap((nivel) => {
              const roles = rolesDeNivel(nivel);

              if (!roles.length) return [];

              return [
                <ListSubheader key={nivel}>{ETIQUETA_NIVEL[nivel]}</ListSubheader>,
                ...roles.map((rol) => (
                  <MenuItem key={rol.codigo} value={rol.codigo}>
                    {rol.nombre}
                  </MenuItem>
                )),
              ];
            })}
          </TextField>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2.5 }}>
          <Tooltip title="Es el rol principal de navegación. Dentro de su propio destacamento, el cargo local conserva sus permisos.">
            <Label variant="soft" color="info">
              Entra como {principal?.nombre ?? sesion.rolId}
            </Label>
          </Tooltip>
          <Label variant="soft" color="default">
            {sesion.permisosRol.length} permisos sumados
          </Label>
          {sesion.restricciones.soloLectura && (
            <Label variant="soft" color="warning">
              Solo lectura
            </Label>
          )}
        </Stack>
      </Card>

      {analisis.avisos.length > 0 && (
        <Alert severity="warning" icon={<Iconify icon="solar:danger-triangle-bold" />}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Al juntar los dos cargos pierde {analisis.avisos.length}{' '}
            {analisis.avisos.length === 1 ? 'cosa que sí podía' : 'cosas que sí podía'} con uno de
            ellos por separado
          </Typography>
          <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
            {analisis.avisos.map((aviso) => (
              <li key={aviso.capacidad}>
                <Typography variant="body2">
                  <strong>{aviso.etiqueta}</strong> — como {aviso.pierde} era{' '}
                  {PRESENTACION[aviso.resultadoSolo]?.texto}, y con los dos cargos queda en{' '}
                  {PRESENTACION[aviso.resultadoCombinado]?.texto}.
                </Typography>
              </li>
            ))}
          </Stack>
        </Alert>
      )}

      {analisis.ganancias.length > 0 && (
        <Alert severity="error" icon={<Iconify icon="solar:shield-warning-bold" />}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Al juntar los dos cargos gana {analisis.ganancias.length}{' '}
            {analisis.ganancias.length === 1 ? 'cosa que no tenía' : 'cosas que no tenía'} ninguno de
            los dos por separado
          </Typography>
          <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
            {analisis.ganancias.map((gana) => (
              <li key={gana.capacidad}>
                <Typography variant="body2">
                  <strong>{gana.etiqueta}</strong> — queda en{' '}
                  {PRESENTACION[gana.resultadoCombinado]?.texto}.
                </Typography>
              </li>
            ))}
          </Stack>
        </Alert>
      )}

      <Card>
        <CardHeader
          title="Lo que puede hacer"
          subheader={`Cada fila es una pregunta real de la aplicación. ${totalValidadas} de ${CAPACIDADES.length} marcadas como correctas; se guardan automáticamente en Firebase.`}
          action={
            <FormControlLabel
              control={
                <Switch
                  checked={mostrarSueltos}
                  onChange={(event) => setMostrarSueltos(event.target.checked)}
                />
              }
              label="Comparar con cada cargo por separado"
            />
          }
        />

        <TableContainer sx={{ mt: 2 }}>
          <Scrollbar>
            <Table size="small" sx={{ minWidth: 960 }}>
              <TableHeadCustom headCells={cabecera} />
              <TableBody>
                {AREAS.map((area) => (
                  <Fragment key={area}>
                    <TableRow>
                      <TableCell colSpan={cabecera.length} sx={{ bgcolor: 'background.neutral' }}>
                        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                          {area}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    {CAPACIDADES.filter((capacidad) => capacidad.area === area).map((capacidad) => (
                      <TableRow key={capacidad.id} hover>
                        <TableCell padding="checkbox">
                          <span>
                            <Checkbox
                              checked={isCombinationCapabilityValidated(
                                revisionGuardada,
                                capacidad.id
                              )}
                              disabled={
                                cargandoRevisiones ||
                                guardandoCapacidades.has(
                                  `${combinationId}::${capacidad.id}`
                                )
                              }
                              inputProps={{
                                'aria-label': `Validar ${capacidad.etiqueta}`,
                              }}
                              onChange={(event) =>
                                onRevisarCapacidad(capacidad, event.target.checked)
                              }
                            />
                          </span>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{capacidad.etiqueta}</Typography>
                        </TableCell>

                        {mostrarSueltos && (
                          <>
                            <TableCell>
                              <ResultadoLabel valor={analisis.soloDestacamento[capacidad.id]} />
                            </TableCell>
                            <TableCell>
                              <ResultadoLabel valor={analisis.soloAcompanante[capacidad.id]} />
                            </TableCell>
                          </>
                        )}

                        <TableCell>
                          <ResultadoLabel valor={analisis.combinado[capacidad.id]} />
                        </TableCell>

                        <TableCell>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {analisis.combinado[capacidad.id] === RESULTADO.aprobacion
                              ? capacidad.solicitaA || 'Administrador Global'
                              : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Card>
    </Stack>
  );
}

// ----------------------------------------------------------------------

const CABECERA_CHECKLIST = [
  { id: 'revisado', label: '', width: 56 },
  { id: 'destacamento', label: 'Cargo en su destacamento', width: 260 },
  { id: 'acompanante', label: 'Segundo cargo', width: 260 },
  { id: 'nivel', label: 'Nivel', width: 150 },
  { id: 'entra', label: 'Entra como', width: 200 },
  { id: 'avisos', label: 'Qué revisar' },
  { id: 'abrir', label: '', width: 56 },
];

function Checklist({ guardadas, onRevisar, onAbrir }) {
  const [nivel, setNivel] = useState('todos');
  const [soloChoques, setSoloChoques] = useState(false);
  const [soloPendientes, setSoloPendientes] = useState(false);

  // Se calcula una sola vez: son 248 combinaciones por dos docenas de preguntas.
  const filas = useMemo(
    () =>
      COMBINACIONES.map((combinacion) => {
        const { avisos, ganancias } = analizarCombinacion(combinacion);
        const sesion = construirUsuarioSimulado([
          combinacion.destacamento,
          combinacion.acompanante,
        ]);

        return {
          ...combinacion,
          avisos,
          ganancias,
          entraComo: ROL_COMBINABLE_POR_CODIGO[sesion?.rolId]?.nombre ?? '',
        };
      }),
    []
  );

  const visibles = filas.filter((fila) => {
    if (nivel !== 'todos' && fila.nivelAcompanante !== nivel) return false;
    if (soloChoques && !fila.avisos.length && !fila.ganancias.length) return false;
    if (soloPendientes && guardadas[fila.id]?.revisado) return false;

    return true;
  });

  const revisadas = filas.filter((fila) => guardadas[fila.id]?.revisado).length;
  const conChoques = filas.filter(
    (fila) => fila.avisos.length > 0 || fila.ganancias.length > 0
  ).length;

  return (
    <Card>
      <CardHeader
        title={`${filas.length} combinaciones posibles`}
        subheader={`${revisadas} revisadas · ${conChoques} con algo que mirar`}
      />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ md: 'center' }}
        sx={{ p: 3, pb: 1 }}
      >
        <TextField
          select
          label="Nivel del segundo cargo"
          value={nivel}
          onChange={(event) => setNivel(event.target.value)}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="todos">Todos</MenuItem>
          {NIVELES_ACOMPANANTES.map((valor) => (
            <MenuItem key={valor} value={valor}>
              {ETIQUETA_NIVEL[valor]}
            </MenuItem>
          ))}
        </TextField>

        <FormControlLabel
          control={
            <Switch
              checked={soloChoques}
              onChange={(event) => setSoloChoques(event.target.checked)}
            />
          }
          label="Solo las que pierden algo"
        />

        <FormControlLabel
          control={
            <Switch
              checked={soloPendientes}
              onChange={(event) => setSoloPendientes(event.target.checked)}
            />
          }
          label="Solo las que faltan por revisar"
        />
      </Stack>

      <TableContainer>
        <Scrollbar>
          <Table size="small" sx={{ minWidth: 1100 }}>
            <TableHeadCustom headCells={CABECERA_CHECKLIST} />
            <TableBody>
              {visibles.map((fila) => (
                <TableRow key={fila.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={Boolean(guardadas[fila.id]?.revisado)}
                      onChange={(event) => onRevisar(fila, event.target.checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{fila.destacamento.nombre}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{fila.acompanante.nombre}</Typography>
                  </TableCell>
                  <TableCell>
                    <Label variant="soft" color="default">
                      {ETIQUETA_NIVEL[fila.nivelAcompanante]}
                    </Label>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {fila.entraComo}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {fila.avisos.length || fila.ganancias.length ? (
                      <Stack direction="row" spacing={1}>
                        {fila.avisos.length > 0 && (
                          <Tooltip
                            title={fila.avisos.map((aviso) => aviso.etiqueta).join(' · ')}
                            arrow
                          >
                            <Label variant="soft" color="warning">
                              Pierde {fila.avisos.length}
                            </Label>
                          </Tooltip>
                        )}
                        {fila.ganancias.length > 0 && (
                          <Tooltip
                            title={fila.ganancias.map((gana) => gana.etiqueta).join(' · ')}
                            arrow
                          >
                            <Label variant="soft" color="error">
                              Gana {fila.ganancias.length} de la nada
                            </Label>
                          </Tooltip>
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Nada que mirar
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Ver esta combinación en el simulador">
                      <IconButton size="small" onClick={() => onAbrir(fila)}>
                        <Iconify icon="solar:eye-bold" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}

              {!visibles.length && (
                <TableRow>
                  <TableCell colSpan={CABECERA_CHECKLIST.length} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Ninguna combinación cumple ese filtro.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>
    </Card>
  );
}

// ----------------------------------------------------------------------

const PRIMER_ACOMPANANTE = rolesDeNivel(NIVEL_COMBINACION.seccion)[0]?.codigo ?? '';

const rolValido = (codigo, deDestacamento) => {
  const rol = ROL_COMBINABLE_POR_CODIGO[codigo];

  if (!rol) return false;

  return deDestacamento
    ? rol.nivel === NIVEL_COMBINACION.destacamento
    : rol.nivel !== NIVEL_COMBINACION.destacamento;
};

export function AdminRoleCombinationsView() {
  const { user } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pestana, setPestana] = useState('simulador');
  const [guardadas, setGuardadas] = useState({});
  const [sembrando, setSembrando] = useState(false);
  const [guardandoCapacidades, setGuardandoCapacidades] = useState(() => new Set());
  const [cargandoRevisiones, setCargandoRevisiones] = useState(true);

  const cargar = useCallback(async () => {
    try {
      setGuardadas(await obtenerCombinacionesRoles());
    } catch (error) {
      console.error(error);
      // Sin catalogo guardado el simulador funciona igual: lo calcula.
      setGuardadas({});
    } finally {
      setCargandoRevisiones(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleSembrar = async (rehacer) => {
    setSembrando(true);

    try {
      const resultado = await sembrarCombinacionesRoles({ usuario: user, rehacer });

      toast.success(
        resultado.sembradas
          ? `${resultado.sembradas} combinaciones guardadas en la base de datos.`
          : 'El catálogo ya estaba completo.'
      );
      await cargar();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo guardar el catálogo.');
    } finally {
      setSembrando(false);
    }
  };

  // La combinación elegida vive en la dirección: así se puede enviar el enlace
  // de un caso concreto a quien tiene que revisarlo.
  const codigoDestacamento = rolValido(searchParams.get('dest'), true)
    ? searchParams.get('dest')
    : (ROLES_DESTACAMENTO[0]?.codigo ?? '');
  const codigoAcompanante = rolValido(searchParams.get('con'), false)
    ? searchParams.get('con')
    : PRIMER_ACOMPANANTE;

  const cambiarSeleccion = (dest, con) => {
    const parametros = new URLSearchParams(searchParams.toString());

    parametros.set('dest', dest);
    parametros.set('con', con);
    router.replace(`${pathname}?${parametros.toString()}`, { scroll: false });
  };

  const handleAbrir = (fila) => {
    cambiarSeleccion(fila.destacamento.codigo, fila.acompanante.codigo);
    setPestana('simulador');
  };

  const handleRevisar = async (fila, revisado) => {
    const anterior = guardadas[fila.id];

    // Se marca de inmediato: esperar al servidor para tachar una casilla hace
    // que revisar 248 filas sea insoportable.
    setGuardadas((previas) => ({
      ...previas,
      [fila.id]: { ...(previas[fila.id] ?? {}), id: fila.id, revisado },
    }));

    try {
      await guardarRevisionCombinacion({
        idCombinacion: fila.id,
        revisado,
        nota: anterior?.nota ?? '',
        anterior,
        usuario: user,
      });
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo guardar la revisión.');
      setGuardadas((previas) => ({ ...previas, [fila.id]: anterior }));
    }
  };

  const handleRevisarCapacidad = async (capacidad, validada) => {
    const combinationId = idCombinacion(codigoDestacamento, codigoAcompanante);
    const savingId = `${combinationId}::${capacidad.id}`;
    const documentAnterior = guardadas[combinationId] ?? { id: combinationId };
    const revisionAnterior = documentAnterior?.revisionesCapacidades?.[capacidad.id];
    const estabaValidada = isCombinationCapabilityValidated(documentAnterior, capacidad.id);

    setGuardandoCapacidades((previas) => new Set(previas).add(savingId));
    setGuardadas((previas) => ({
      ...previas,
      [combinationId]: {
        ...(previas[combinationId] ?? documentAnterior),
        revisionesCapacidades: mergeCombinationCapabilityReview(
          previas[combinationId] ?? documentAnterior,
          capacidad.id,
          { validada }
        ),
      },
    }));

    try {
      await guardarRevisionCapacidadCombinacion({
        idCombinacion: combinationId,
        idCapacidad: capacidad.id,
        validada,
        anterior: estabaValidada,
        usuario: user,
      });
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo guardar la validación de esta fila.');
      setGuardadas((previas) => {
        const documentActual = previas[combinationId] ?? documentAnterior;
        const revisionesCapacidades = { ...(documentActual.revisionesCapacidades ?? {}) };

        if (revisionAnterior === undefined) {
          delete revisionesCapacidades[capacidad.id];
        } else {
          revisionesCapacidades[capacidad.id] = revisionAnterior;
        }

        return {
          ...previas,
          [combinationId]: { ...documentActual, revisionesCapacidades },
        };
      });
    } finally {
      setGuardandoCapacidades((previas) => {
        const siguientes = new Set(previas);
        siguientes.delete(savingId);
        return siguientes;
      });
    }
  };

  return (
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title="Combinación de roles"
          subheader="Una persona puede tener un cargo en su destacamento y otro en su sección, su región, el Consejo Nacional o la tienda. Cuando eso pasa ejerce los dos: los permisos y el alcance se suman, y entra con el cargo de mayor nivel."
          action={
            <Stack spacing={1} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
              <Button
                color="inherit"
                variant="outlined"
                component={RouterLink}
                href={paths.dashboard.admin.roles}
                startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
              >
                Roles base
              </Button>

              <Button
                color="inherit"
                variant="outlined"
                loading={sembrando}
                startIcon={<Iconify icon="solar:database-bold" />}
                onClick={() => handleSembrar(false)}
              >
                Guardar catálogo
              </Button>

              <Tooltip title="Vuelve a calcular las combinaciones con lo que hace hoy la aplicación. Conserva lo que ya marcaste como revisado.">
                <Button
                  color="inherit"
                  variant="outlined"
                  loading={sembrando}
                  startIcon={<Iconify icon="solar:refresh-bold" />}
                  onClick={() => handleSembrar(true)}
                >
                  Rehacer desde el código
                </Button>
              </Tooltip>
            </Stack>
          }
        />

        <Tabs value={pestana} onChange={(evento, valor) => setPestana(valor)} sx={{ px: 3 }}>
          <Tab value="simulador" label="Simulador" />
          <Tab value="checklist" label="Checklist de combinaciones" />
        </Tabs>
      </Card>

      {pestana === 'simulador' ? (
        <Simulador
          codigoDestacamento={codigoDestacamento}
          codigoAcompanante={codigoAcompanante}
          onCambiar={cambiarSeleccion}
          revisionGuardada={
            guardadas[idCombinacion(codigoDestacamento, codigoAcompanante)] ?? {}
          }
          onRevisarCapacidad={handleRevisarCapacidad}
          guardandoCapacidades={guardandoCapacidades}
          cargandoRevisiones={cargandoRevisiones}
        />
      ) : (
        <Checklist guardadas={guardadas} onRevisar={handleRevisar} onAbrir={handleAbrir} />
      )}
    </Stack>
  );
}
