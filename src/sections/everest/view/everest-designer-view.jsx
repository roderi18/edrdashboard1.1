'use client';

import { useState, useEffect } from 'react';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, usePathname, useSearchParams } from 'src/routes/hooks';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { ESTADOS_DEL_BLOQUE } from 'src/utils/everest/estado-del-bloque.mjs';

import { DashboardContent } from 'src/layouts/dashboard';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EditorCargando } from 'src/components/pantalla-cargando';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { EverestPines } from '../everest-pines';
import { EDITORES_DE_BLOQUE } from '../editores';
import { EverestCintas } from '../everest-cintas';
import { EverestPaleta } from '../everest-paleta';
import { EverestTarjeta } from '../everest-tarjeta';
import { EverestMedallas } from '../everest-medallas';
import { EverestVistaPrevia } from '../everest-vista-previa';
import { EditorDeDiseno } from '../editores/editor-de-diseno';
import { useEverestDesigner } from '../hooks/use-everest-designer';
import { EditorVisualUniversal } from '../editor-visual-universal';
import { EverestPanelDelBloque } from '../everest-panel-del-bloque';
import { EverestListaDeBloques } from '../everest-lista-de-bloques';
import { EverestCampanasDelBloque } from '../everest-campanas-del-bloque';
import { EverestVersionesDelBloque } from '../everest-versiones-del-bloque';

// ----------------------------------------------------------------------
// EXPLORA DESIGNER.
//
// Donde se cambia la portada sin tocar codigo. Tres zonas: los bloques a la
// izquierda con su estado, la vista previa en el centro —con los componentes de
// verdad, en celular o escritorio— y a la derecha el bloque abierto con sus
// acciones.
//
// NADA DE LO QUE SE HACE AQUI SE VE EN LA PORTADA HASTA PULSAR PUBLICAR. Editar
// guarda un borrador que solo ve quien edita; publicar es un paso aparte, por
// bloque, y queda en Historial (ver `PROJECT_GUIDELINES.md` §4.2).
//
// ES UNA PANTALLA PROPIA DEL MENU, debajo de "Administradores", y no una pestaña
// de Administracion: por eso lleva su propio encabezado y su propio marco.
//
// SEIS ESPACIOS: "Portada" (los bloques de /principal), "Cintas", "Medallas" y "Pines" (los
// catalogos de insignias del perfil), "Paleta" (los colores de la aplicacion) y "Tarjeta"
// (la tarjeta editable: foto con recorte, textos, letra y tamaño). El espacio va
// en la direccion (`?seccion=cintas`) para que se pueda enlazar y para que los lapices de la
// portada sigan cayendo en Portada.
//
// La Paleta estaba en Administracion (`/dashboard/admin/paleta`, que ahora redirige aqui): es
// diseño, no administracion, y es del mismo Administrador Global que usa el Designer.
// ----------------------------------------------------------------------

const SECCIONES = Object.freeze({
  portada: 'portada',
  cintas: 'cintas',
  medallas: 'medallas',
  pines: 'pines',
  paleta: 'paleta',
  tarjeta: 'tarjeta',
});

const ENCABEZADO = (
  <CustomBreadcrumbs
    heading="EXPLORA Designer"
    links={[{ name: 'Panel', href: paths.dashboard.root }, { name: 'EXPLORA Designer' }]}
    sx={{ mb: 3 }}
  />
);

export function EverestDesignerView() {
  const { user } = useAuthContext();
  const designer = useEverestDesigner();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seccion = [
    SECCIONES.cintas,
    SECCIONES.medallas,
    SECCIONES.pines,
    SECCIONES.paleta,
    SECCIONES.tarjeta,
  ].includes(searchParams.get('seccion'))
    ? searchParams.get('seccion')
    : SECCIONES.portada;
  const [mostrarBloques, setMostrarBloques] = useState(true);
  const [mostrarInspector, setMostrarInspector] = useState(true);
  const [herramienta, setHerramienta] = useState('visual');
  const [seleccionado, setSeleccionado] = useState(null);
  const [historial, setHistorial] = useState({ pasado: [], futuro: [] });
  const { estadoSeleccionado, idSeleccionado } = designer;

  useEffect(() => {
    setSeleccionado(null);
    setHistorial({ pasado: [], futuro: [] });
  }, [idSeleccionado]);

  useEffect(() => {
    const consulta = window.matchMedia('(max-width: 899px)');
    const alCambiar = (evento) => {
      if (evento.matches) {
        setMostrarBloques(false);
        setMostrarInspector(false);
      } else {
        setMostrarBloques(true);
        setMostrarInspector(true);
      }
    };
    alCambiar(consulta);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  useEffect(() => {
    if (!isAdminGlobal(user)) return undefined;
    const anteriorBody = document.body.style.overflow;
    const anteriorHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anteriorBody;
      document.documentElement.style.overflow = anteriorHtml;
    };
  }, [user]);

  const cambiarSeccion = (nueva) => {
    const parametros = new URLSearchParams(searchParams.toString());

    if (nueva === SECCIONES.portada) parametros.delete('seccion');
    else parametros.set('seccion', nueva);

    const consulta = parametros.toString();

    router.replace(consulta ? `${pathname}?${consulta}` : pathname);
  };

  // En su primera version es solo del Administrador Global. El menu no se lo
  // enseña a nadie mas, pero la direccion se puede escribir a mano.
  if (!isAdminGlobal(user)) {
    return (
      <DashboardContent maxWidth="xl">
        {ENCABEZADO}
        <Alert severity="error">
          EXPLORA Designer es, por ahora, solo para el Administrador Global.
        </Alert>
      </DashboardContent>
    );
  }

  // EL EDITOR DEL BLOQUE ABIERTO, SI TIENE. Parte del borrador si hay uno, y si
  // no, de lo que esta en vivo. Cada cambio pasa por `cambiarContenido`: se ve al
  // momento en la vista previa y se guarda solo como borrador, nunca en la
  // portada. La `key` lo reinicia al cambiar de bloque.
  const Editor = EDITORES_DE_BLOQUE[idSeleccionado];
  const contenidoAEditar =
    estadoSeleccionado?.borrador?.contenido ?? estadoSeleccionado?.enVivo?.contenido;
  // El diseño, igual: el del borrador si hay uno, y si no, el que esta en vivo.
  const disenoAEditar = estadoSeleccionado?.borrador
    ? estadoSeleccionado.borrador.diseno
    : estadoSeleccionado?.enVivo?.diseno;
  const disenoActual = disenoAEditar ?? {};

  const cambiarVisual = (nuevo) => {
    setHistorial((actual) => ({
      pasado: [...actual.pasado.slice(-29), disenoActual],
      futuro: [],
    }));
    designer.cambiarDiseno(idSeleccionado, nuevo);
  };

  const deshacer = () => {
    const anterior = historial.pasado.at(-1);
    if (!anterior) return;
    setHistorial((actual) => ({
      pasado: actual.pasado.slice(0, -1),
      futuro: [...actual.futuro, disenoActual],
    }));
    designer.cambiarDiseno(idSeleccionado, anterior);
  };

  const rehacer = () => {
    const siguiente = historial.futuro.at(-1);
    if (!siguiente) return;
    setHistorial((actual) => ({
      pasado: [...actual.pasado, disenoActual],
      futuro: actual.futuro.slice(0, -1),
    }));
    designer.cambiarDiseno(idSeleccionado, siguiente);
  };

  const moverEnLienzo = (movimiento) => {
    if (!movimiento || !Number.isFinite(movimiento.dx) || !Number.isFinite(movimiento.dy)) return;
    if (movimiento.tipo === 'capa') {
      cambiarVisual({
        ...disenoActual,
        capasVisuales: (disenoActual.capasVisuales ?? []).map((capa) =>
          capa.id === movimiento.id
            ? movimiento.accion === 'redimensionar'
              ? {
                  ...capa,
                  width: Math.max(
                    1,
                    Math.min(
                      100,
                      Math.round((capa.width + (movimiento.dx / movimiento.ancho) * 100) * 10) / 10
                    )
                  ),
                  height: Math.max(
                    1,
                    Math.min(
                      100,
                      Math.round((capa.height + (movimiento.dy / movimiento.alto) * 100) * 10) / 10
                    )
                  ),
                }
              : {
                  ...capa,
                  x: Math.max(
                    0,
                    Math.min(
                      100,
                      Math.round((capa.x + (movimiento.dx / movimiento.ancho) * 100) * 10) / 10
                    )
                  ),
                  y: Math.max(
                    0,
                    Math.min(
                      100,
                      Math.round((capa.y + (movimiento.dy / movimiento.alto) * 100) * 10) / 10
                    )
                  ),
                }
            : capa
        ),
      });
    } else if (/^(?:0|[1-9]\d{0,3})$/.test(String(movimiento.id))) {
      const anterior = disenoActual.elementosVisuales?.[movimiento.id] ?? {};
      cambiarVisual({
        ...disenoActual,
        elementosVisuales: {
          ...(disenoActual.elementosVisuales ?? {}),
          [movimiento.id]: {
            ...anterior,
            x: Math.max(-1000, Math.min(1000, (anterior.x ?? 0) + movimiento.dx)),
            y: Math.max(-1000, Math.min(1000, (anterior.y ?? 0) + movimiento.dy)),
          },
        },
      });
    }
  };

  const editor =
    Editor && contenidoAEditar != null ? (
      <Editor
        key={idSeleccionado}
        idBloque={idSeleccionado}
        contenido={contenidoAEditar}
        onCambiar={(contenido) => designer.cambiarContenido(idSeleccionado, contenido)}
      />
    ) : null;
  const editorDeDiseno = estadoSeleccionado?.enVivo ? (
    <EditorDeDiseno
      key={`diseno-${idSeleccionado}`}
      idBloque={idSeleccionado}
      diseno={disenoAEditar ?? {}}
      onCambiar={(diseno) => designer.cambiarDiseno(idSeleccionado, diseno)}
    />
  ) : null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (theme) => theme.zIndex.drawer + 20,
        bgcolor: 'background.default',
        display: 'grid',
        gridTemplateRows: { xs: '96px minmax(0, 1fr) 28px', md: '60px minmax(0, 1fr) 28px' },
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={{ xs: 0.5, md: 1.5 }}
        sx={{
          px: 2,
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          minWidth: 0,
        }}
      >
        {designer.volver && (
          <IconButton component={RouterLink} href={designer.volver} aria-label="Volver">
            <Iconify icon="eva:arrow-ios-back-fill" width={20} />
          </IconButton>
        )}
        <Typography
          variant="subtitle1"
          noWrap
          sx={{ fontWeight: 800, flexShrink: 0, display: { xs: 'none', md: 'block' } }}
        >
          EXPLORA Designer
        </Typography>
        {seccion === SECCIONES.portada && (
          <>
            <IconButton
              size="small"
              aria-label="Bloques"
              onClick={() => {
                setMostrarBloques(!mostrarBloques);
                setMostrarInspector(false);
              }}
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            >
              <Iconify icon="solar:list-bold" width={19} />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Propiedades"
              onClick={() => {
                setMostrarInspector(!mostrarInspector);
                setMostrarBloques(false);
              }}
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            >
              <Iconify icon="solar:settings-bold" width={19} />
            </IconButton>
          </>
        )}
        <Tabs
          value={seccion}
          onChange={(evento, nueva) => cambiarSeccion(nueva)}
          sx={{
            minHeight: { xs: 38, md: 48 },
            ml: { xs: 0, md: 2 },
            flex: { xs: '0 0 100%', md: 1 },
            minWidth: 0,
            order: { xs: 2, md: 0 },
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab value={SECCIONES.portada} label="Portada" />
          <Tab value={SECCIONES.cintas} label="Cintas" />
          <Tab value={SECCIONES.medallas} label="Medallas" />
          <Tab value={SECCIONES.pines} label="Pines" />
          <Tab value={SECCIONES.paleta} label="Paleta" />
          <Tab value={SECCIONES.tarjeta} label="Tarjeta" />
        </Tabs>
        {seccion === SECCIONES.portada && (
          <>
            <IconButton
              size="small"
              aria-label="Deshacer"
              disabled={!historial.pasado.length}
              onClick={deshacer}
            >
              <Iconify icon="eva:arrow-ios-back-fill" width={20} />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Rehacer"
              disabled={!historial.futuro.length}
              onClick={rehacer}
            >
              <Iconify icon="eva:arrow-ios-forward-fill" width={20} />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Recargar"
              disabled={designer.cargando}
              onClick={designer.recargar}
            >
              <Iconify icon="solar:restart-bold" width={20} />
            </IconButton>
            <Button
              size="small"
              variant="contained"
              disabled={!estadoSeleccionado?.borrador?.valido || Boolean(designer.accion)}
              loading={designer.accion === 'publicar'}
              onClick={async () => {
                try {
                  await designer.publicar(idSeleccionado);
                  toast.success('Diseño publicado.');
                } catch (error) {
                  toast.error(error?.message || 'No se pudo publicar.');
                }
              }}
              sx={{ flexShrink: 0 }}
            >
              Publicar
            </Button>
          </>
        )}
      </Stack>

      {seccion === SECCIONES.portada ? (
        <Box
          sx={{
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: `${mostrarBloques ? '238px' : '52px'} minmax(0, 1fr) ${mostrarInspector ? '390px' : '52px'}`,
            },
            gap: 0,
          }}
        >
          <Box
            sx={{
              minHeight: 0,
              overflowY: 'auto',
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              display: { xs: mostrarBloques ? 'block' : 'none', md: 'block' },
              position: { xs: 'fixed', md: 'static' },
              top: { xs: 96, md: 'auto' },
              bottom: { xs: 28, md: 'auto' },
              left: 0,
              width: { xs: 'min(300px, 90vw)', md: 'auto' },
              zIndex: (theme) => theme.zIndex.drawer + 21,
            }}
          >
            <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 1, minHeight: 48 }}>
              {mostrarBloques && (
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                  Bloques
                </Typography>
              )}
              <IconButton
                size="small"
                aria-label={mostrarBloques ? 'Ocultar bloques' : 'Mostrar bloques'}
                onClick={() => setMostrarBloques(!mostrarBloques)}
              >
                <Iconify
                  icon={mostrarBloques ? 'eva:arrow-ios-back-fill' : 'eva:arrow-ios-forward-fill'}
                  width={18}
                />
              </IconButton>
            </Stack>
            {mostrarBloques && (
              <EverestListaDeBloques
                estados={designer.estados}
                idSeleccionado={idSeleccionado}
                onSeleccionar={designer.seleccionar}
                sx={{ borderRadius: 0, boxShadow: 'none' }}
              />
            )}
          </Box>

          <Box
            sx={{ minWidth: 0, minHeight: 0, p: { xs: 1, md: 2 }, bgcolor: 'background.neutral' }}
          >
            {designer.error && (
              <Alert severity="error" sx={{ mb: 1 }}>
                No se pudo leer o guardar el diseño.{' '}
                <Button size="small" onClick={designer.recargar}>
                  Reintentar
                </Button>
              </Alert>
            )}
            {designer.cargando && !designer.estados.length ? (
              <EditorCargando />
            ) : estadoSeleccionado?.estado === ESTADOS_DEL_BLOQUE.externo ? (
              <Alert severity="info">
                Este encabezado se edita en la tienda.{' '}
                <Button component={RouterLink} href={paths.dashboard.product.root}>
                  Abrir tienda
                </Button>
              </Alert>
            ) : (
              <EverestVistaPrevia
                idBloque={idSeleccionado}
                contenido={estadoSeleccionado?.contenidoDeLaVistaPrevia}
                diseno={estadoSeleccionado?.disenoDeLaVistaPrevia}
                seleccionado={seleccionado}
                onSeleccionar={setSeleccionado}
                onMover={moverEnLienzo}
              />
            )}
          </Box>

          <Box
            sx={{
              minHeight: 0,
              overflow: 'hidden',
              borderLeft: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              display: { xs: mostrarInspector ? 'flex' : 'none', md: 'flex' },
              flexDirection: 'column',
              position: { xs: 'fixed', md: 'static' },
              top: { xs: 96, md: 'auto' },
              bottom: { xs: 28, md: 'auto' },
              right: 0,
              width: { xs: 'min(390px, 95vw)', md: 'auto' },
              zIndex: (theme) => theme.zIndex.drawer + 21,
            }}
          >
            <Stack direction="row" alignItems="center" sx={{ px: 1, minHeight: 48 }}>
              <IconButton
                size="small"
                aria-label={mostrarInspector ? 'Ocultar propiedades' : 'Mostrar propiedades'}
                onClick={() => setMostrarInspector(!mostrarInspector)}
              >
                <Iconify
                  icon={mostrarInspector ? 'eva:arrow-ios-forward-fill' : 'eva:arrow-ios-back-fill'}
                  width={18}
                />
              </IconButton>
              {mostrarInspector && (
                <Typography variant="subtitle2" sx={{ ml: 1 }}>
                  Propiedades
                </Typography>
              )}
            </Stack>
            {mostrarInspector && (
              <>
                <Tabs
                  value={herramienta}
                  onChange={(evento, nuevo) => setHerramienta(nuevo)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ minHeight: 42, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Tab value="visual" label="Visual" sx={{ minHeight: 42, minWidth: 72 }} />
                  <Tab value="datos" label="Contenido" sx={{ minHeight: 42, minWidth: 90 }} />
                  <Tab value="versiones" label="Versiones" sx={{ minHeight: 42, minWidth: 84 }} />
                  <Tab value="campanas" label="Campañas" sx={{ minHeight: 42, minWidth: 85 }} />
                </Tabs>
                <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  {herramienta === 'visual' &&
                    estadoSeleccionado?.estado !== ESTADOS_DEL_BLOQUE.externo && (
                      <EditorVisualUniversal
                        idBloque={idSeleccionado}
                        diseno={disenoActual}
                        seleccionado={seleccionado}
                        onSeleccionar={setSeleccionado}
                        onCambiar={cambiarVisual}
                      />
                    )}
                  {herramienta === 'datos' && (
                    <EverestPanelDelBloque
                      estado={estadoSeleccionado}
                      editor={editor}
                      editorDeDiseno={editorDeDiseno}
                      analiticas={designer.analiticas.bloques[idSeleccionado]}
                      guardando={Boolean(designer.guardando[idSeleccionado])}
                      accion={designer.accion}
                      onPublicar={designer.publicar}
                      onDescartarBorrador={designer.descartarBorrador}
                      onVolverAlOriginal={designer.volverAlOriginal}
                      sx={{ borderRadius: 0, boxShadow: 'none' }}
                    />
                  )}
                  {herramienta === 'versiones' && (
                    <EverestVersionesDelBloque
                      estado={estadoSeleccionado}
                      versiones={designer.versiones}
                      onAbrir={designer.abrirVersion}
                      onReintentar={designer.recargarVersiones}
                      sx={{ borderRadius: 0, boxShadow: 'none' }}
                    />
                  )}
                  {herramienta === 'campanas' && (
                    <EverestCampanasDelBloque
                      estado={estadoSeleccionado}
                      campanas={designer.campanasDelBloque}
                      analiticas={designer.analiticas}
                      accion={designer.accion}
                      onProgramar={designer.programar}
                      onQuitar={designer.quitarCampana}
                      onAbrir={designer.abrirCampana}
                      sx={{ borderRadius: 0, boxShadow: 'none' }}
                    />
                  )}
                </Box>
              </>
            )}
          </Box>
        </Box>
      ) : (
        <Box sx={{ overflowY: 'auto', p: 3, maxWidth: 1400, width: 1, mx: 'auto' }}>
          {seccion === SECCIONES.cintas && <EverestCintas />}
          {seccion === SECCIONES.medallas && <EverestMedallas />}
          {seccion === SECCIONES.pines && <EverestPines />}
          {seccion === SECCIONES.paleta && <EverestPaleta />}
          {seccion === SECCIONES.tarjeta && <EverestTarjeta />}
        </Box>
      )}

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {designer.guardando[idSeleccionado]
            ? 'Guardando borrador…'
            : estadoSeleccionado?.borrador
              ? 'Borrador · cambios sin publicar'
              : 'Diseño en vivo'}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Los cambios se guardan como borrador hasta publicar.
        </Typography>
      </Stack>
    </Box>
  );
}
