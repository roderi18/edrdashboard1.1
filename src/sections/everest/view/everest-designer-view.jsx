'use client';

import Tab from '@mui/material/Tab';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, usePathname, useSearchParams } from 'src/routes/hooks';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { ESTADOS_DEL_BLOQUE } from 'src/utils/everest/estado-del-bloque.mjs';

import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { EDITORES_DE_BLOQUE } from '../editores';
import { EverestCintas } from '../everest-cintas';
import { EverestMedallas } from '../everest-medallas';
import { EverestVistaPrevia } from '../everest-vista-previa';
import { EditorDeDiseno } from '../editores/editor-de-diseno';
import { useEverestDesigner } from '../hooks/use-everest-designer';
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
// TRES ESPACIOS: "Portada" (los bloques de /principal), "Cintas" y "Medallas" (los
// catalogos de insignias del perfil). El espacio va en la direccion (`?seccion=cintas`) para que
// se pueda enlazar y para que los lapices de la portada sigan cayendo en Portada.
// ----------------------------------------------------------------------

const SECCIONES = Object.freeze({ portada: 'portada', cintas: 'cintas', medallas: 'medallas' });

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
  const seccion = [SECCIONES.cintas, SECCIONES.medallas].includes(searchParams.get('seccion'))
    ? searchParams.get('seccion')
    : SECCIONES.portada;

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

  const { estadoSeleccionado, idSeleccionado } = designer;

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
    <DashboardContent maxWidth="xl">
      {ENCABEZADO}

      <Tabs value={seccion} onChange={(evento, nueva) => cambiarSeccion(nueva)} sx={{ mb: 3 }}>
        <Tab value={SECCIONES.portada} label="Portada" />
        <Tab value={SECCIONES.cintas} label="Cintas" />
        <Tab value={SECCIONES.medallas} label="Medallas" />
      </Tabs>

      {seccion === SECCIONES.cintas && <EverestCintas />}
      {seccion === SECCIONES.medallas && <EverestMedallas />}
      {seccion === SECCIONES.portada && (
        <Stack spacing={3}>
          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" useFlexGap>
            {designer.volver && (
              <Button
                component={RouterLink}
                href={designer.volver}
                color="inherit"
                startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
              >
                Volver
              </Button>
            )}

            <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1 }}>
              Los cambios se guardan como borrador y no se ven en la portada hasta publicarlos.
            </Typography>

            <Button
              color="inherit"
              startIcon={<Iconify icon="solar:restart-bold" />}
              onClick={designer.recargar}
              disabled={designer.cargando}
            >
              Recargar
            </Button>
          </Stack>

          {designer.error && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={designer.recargar}>
                  Reintentar
                </Button>
              }
            >
              No se pudo leer o guardar la portada. Si es la primera vez, comprueba que las reglas
              de Firestore estén publicadas.
            </Alert>
          )}

          {designer.cargando && !designer.estados.length ? (
            <Stack alignItems="center" sx={{ py: 8 }}>
              <CircularProgress />
            </Stack>
          ) : (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4, lg: 3 }}>
                <EverestListaDeBloques
                  estados={designer.estados}
                  idSeleccionado={designer.idSeleccionado}
                  onSeleccionar={designer.seleccionar}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 8, lg: 6 }}>
                {estadoSeleccionado?.estado === ESTADOS_DEL_BLOQUE.externo ? (
                  <Alert severity="info">
                    La vista previa de este encabezado está en la propia tienda.
                  </Alert>
                ) : (
                  <EverestVistaPrevia
                    idBloque={designer.idSeleccionado}
                    contenido={estadoSeleccionado?.contenidoDeLaVistaPrevia}
                    diseno={estadoSeleccionado?.disenoDeLaVistaPrevia}
                  />
                )}
              </Grid>

              <Grid size={{ xs: 12, lg: 3 }}>
                <EverestPanelDelBloque
                  estado={estadoSeleccionado}
                  editor={editor}
                  editorDeDiseno={editorDeDiseno}
                  analiticas={designer.analiticas.bloques[idSeleccionado]}
                  guardando={Boolean(designer.guardando[designer.idSeleccionado])}
                  accion={designer.accion}
                  onPublicar={designer.publicar}
                  onDescartarBorrador={designer.descartarBorrador}
                  onVolverAlOriginal={designer.volverAlOriginal}
                />

                <EverestVersionesDelBloque
                  estado={estadoSeleccionado}
                  versiones={designer.versiones}
                  onAbrir={designer.abrirVersion}
                  onReintentar={designer.recargarVersiones}
                  sx={{ mt: 3 }}
                />

                <EverestCampanasDelBloque
                  estado={estadoSeleccionado}
                  campanas={designer.campanasDelBloque}
                  analiticas={designer.analiticas}
                  accion={designer.accion}
                  onProgramar={designer.programar}
                  onQuitar={designer.quitarCampana}
                  onAbrir={designer.abrirCampana}
                  sx={{ mt: 3 }}
                />
              </Grid>
            </Grid>
          )}
        </Stack>
      )}
    </DashboardContent>
  );
}
