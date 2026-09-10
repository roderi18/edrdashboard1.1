'use client';

import { varAlpha } from 'minimal-shared/utils';
import { useState, useEffect, useCallback } from 'react';
import { usePopover, useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { canManageStoreProducts } from 'src/utils/member-access';
import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';
import { disenoDesdeEncabezado } from 'src/utils/store-header-design.mjs';

import {
  registrarClicEncabezado,
  obtenerAnaliticasEncabezado,
  registrarImpresionesEncabezado,
} from 'src/services/store-header-analytics-service';
import {
  DISPOSICION_FRANJA,
  DESTINOS_REVERSION,
  DISPOSICION_CLASICA,
  obtenerEncabezadoTienda,
  guardarEncabezadoTienda,
  revertirEncabezadoTienda,
  ENCABEZADO_TIENDA_POR_DEFECTO,
} from 'src/services/store-settings-service';

import { Logo } from 'src/components/logo';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';
import { HeaderVisualEditor, HeaderVisualCanvas } from 'src/components/header-visual-editor';

import { useAuthContext } from 'src/auth/hooks';

import { StoreHeaderPhoto } from './store-header-photo';

// ----------------------------------------------------------------------
// LA PORTADA DE LA TIENDA.
//
// SIN FOTOGRAFIA NO HAY HUECO QUE LLENAR: el fondo es el degradado del propio
// tema, asi que la portada cambia de color con el modo claro y el oscuro sin
// tener dos imagenes. Es lo que se ve mientras nadie suba una.
//
// Cuando la hay, va DEBAJO de un velo oscuro. Una foto a pelo obliga a elegir
// entre que se lea el titulo o que se vea la imagen; el velo deja las dos cosas
// y no depende de como sea la foto que suban.
//
// El titulo, el subtitulo y la foto los pone el Administrador Global; el resto
// —el escudo y las dos etiquetas— es identidad fija de la organizacion.
// ----------------------------------------------------------------------

export function StoreHeader({ sx }) {
  const { user } = useAuthContext();
  const dialogo = useBoolean();

  // QUIEN TOCA LA PORTADA. El Administrador Global manda sobre todo, pero la
  // tienda la lleva el Administrador de Tienda: es quien pone las ofertas y a
  // quien le urge cambiar el rotulo, y tenerlo que pedir por arriba cada vez
  // convertia una promocion de un dia en un tramite.
  const puedeEditar = isAdminGlobal(user) || canManageStoreProducts(user);

  const [encabezado, setEncabezado] = useState(ENCABEZADO_TIENDA_POR_DEFECTO);
  const [borrador, setBorrador] = useState(ENCABEZADO_TIENDA_POR_DEFECTO);
  const [guardando, setGuardando] = useState(false);

  // La foto recien encuadrada aun no esta en Storage: viaja como archivo hasta
  // que se guarda el encabezado. Asi cancelar el dialogo no deja subidas
  // huerfanas ocupando sitio.
  const [fotoNueva, setFotoNueva] = useState(null);

  useEffect(() => {
    let cancelado = false;

    obtenerEncabezadoTienda().then((textos) => {
      if (!cancelado) setEncabezado(textos);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  const esFranja = encabezado.disposicion === DISPOSICION_FRANJA;
  const disenoActivo = !!encabezado.disenoAvanzado?.activo;

  // El editor avanzado se abre SOBRE el encabezado, no dentro del dialogo: se
  // coloca mirando el resultado real, con el ancho real.
  const [editandoDiseno, setEditandoDiseno] = useState(false);

  // REVERTIR SE PREGUNTA ANTES DE HACERLO. Es el unico boton del dialogo que
  // tira trabajo a la basura, y en una portada que ven todos los que entran no
  // puede depender de no haber pulsado mal.
  const menuDeReversion = usePopover();
  const [porRevertir, setPorRevertir] = useState(null);

  // Lo contado hasta ahora. Solo se pide cuando se va a editar: al cliente no
  // le sirve de nada y las reglas no se lo dejarian leer de todos modos.
  const [analiticas, setAnaliticas] = useState({});

  const handleAbrir = useCallback(() => {
    setBorrador(encabezado);
    setFotoNueva(null);
    dialogo.onTrue();
  }, [encabezado, dialogo]);

  const handleCerrar = useCallback(() => {
    setFotoNueva(null);
    dialogo.onFalse();
  }, [dialogo]);

  const handleCambiarFoto = useCallback((archivo, url) => {
    setFotoNueva(archivo);
    setBorrador((actual) => ({ ...actual, fotoUrl: url }));
  }, []);

  // AL ENTRAR EN AVANZADOS NO SE EMPIEZA EN BLANCO. Se colocan el escudo y los
  // mismos textos que se estaban viendo, en las posiciones que ya ocupaban: se
  // viene a mover lo que hay, no a escribirlo otra vez. Si ya habia un diseño
  // guardado, ese manda.
  const disenoDePartida = disenoActivo
    ? encabezado.disenoAvanzado
    : disenoDesdeEncabezado(encabezado);

  const handleAbrirAvanzados = useCallback(() => {
    dialogo.onFalse();
    setEditandoDiseno(true);
    obtenerAnaliticasEncabezado()
      .then(setAnaliticas)
      .catch(() => setAnaliticas({}));
  }, [dialogo]);

  // El editor coloca; donde se guardan los archivos lo sabe la tienda.
  const handleSubirImagenDelDiseno = useCallback(async (archivo) => {
    try {
      const subida = await uploadOptimizedImage({
        file: archivo,
        preset: 'general',
        storagePath: `tienda/encabezado-elemento-${Date.now()}.webp`,
        metadata: { modulo: 'tienda', tipo: 'encabezado-elemento' },
      });

      return subida.downloadUrl;
    } catch (error) {
      toast.error(error?.message || 'No se pudo subir la imagen.');

      return '';
    }
  }, []);

  // Guardar el diseño no toca los textos ni la foto: se manda el encabezado tal
  // y como esta con el diseño nuevo encima.
  const handleGuardarDiseno = useCallback(
    async (diseno) => {
      setGuardando(true);

      try {
        const guardado = await guardarEncabezadoTienda(
          { ...encabezado, disenoAvanzado: { ...diseno, activo: true } },
          user
        );

        setEncabezado(guardado);
        setEditandoDiseno(false);
        toast.success('Diseño del encabezado actualizado.');
      } catch (error) {
        toast.error(error?.message || 'No se pudo guardar el diseño.');
      } finally {
        setGuardando(false);
      }
    },
    [encabezado, user]
  );

  const handleRevertir = useCallback(async () => {
    if (!porRevertir) return;

    setGuardando(true);

    try {
      const guardado = await revertirEncabezadoTienda(porRevertir, user);

      setEncabezado(guardado);
      setBorrador(guardado);
      setPorRevertir(null);
      toast.success('Encabezado de la tienda revertido.');
    } catch (error) {
      toast.error(error?.message || 'No se pudo revertir el encabezado.');
    } finally {
      setGuardando(false);
    }
  }, [porRevertir, user]);

  const handleGuardar = useCallback(async () => {
    setGuardando(true);

    try {
      // La foto sube AQUI, no al encuadrarla: si el dialogo se cierra sin
      // guardar, no queda nada en Storage que nadie vaya a mirar.
      const fotoUrl = fotoNueva
        ? (
            await uploadOptimizedImage({
              file: fotoNueva,
              preset: 'general',
              storagePath: `tienda/encabezado-${Date.now()}.webp`,
              metadata: { modulo: 'tienda', tipo: 'encabezado' },
            })
          ).downloadUrl
        : borrador.fotoUrl;

      const guardado = await guardarEncabezadoTienda({ ...borrador, fotoUrl }, user);

      setEncabezado(guardado);
      setFotoNueva(null);
      dialogo.onFalse();
      toast.success('Encabezado de la tienda actualizado.');
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar el encabezado.');
    } finally {
      setGuardando(false);
    }
  }, [borrador, fotoNueva, user, dialogo]);

  // MIENTRAS SE EDITA, EL EDITOR OCUPA EL SITIO DEL ENCABEZADO. Es la unica
  // forma de colocar sobre el ancho de verdad; en un dialogo se coloca sobre
  // uno mas estrecho y despues nada cae donde se dejo.
  if (editandoDiseno) {
    return (
      <Box sx={sx}>
        <HeaderVisualEditor
          diseno={disenoDePartida}
          fotoUrl={encabezado.fotoUrl}
          guardando={guardando}
          onGuardar={handleGuardarDiseno}
          onCancelar={() => setEditandoDiseno(false)}
          onSubirImagen={handleSubirImagenDelDiseno}
          analiticas={analiticas}
        />
      </Box>
    );
  }

  // CON DISEnO LIBRE, EL LIENZO MANDA. Los textos de la disposicion clasica no
  // se pierden —siguen guardados—, pero no se pintan encima: quien coloco los
  // suyos ya decidio que va y donde.
  // EL LIENZO, CUANDO HAY DISEnO LIBRE. Antes esto era un `return` propio y con
  // el se iba el dialogo del lapiz: al guardar un diseño, el lapiz alternaba un
  // estado que ya no pintaba nadie y parecia que no abria. Ahora es solo el
  // cuerpo, y el dialogo vive fuera de las tres formas del encabezado.
  const renderPortadaConDiseno = () => (
    <Box sx={[{ position: 'relative' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <HeaderVisualCanvas
        diseno={encabezado.disenoAvanzado}
        fotoUrl={encabezado.fotoUrl}
        onImpresion={registrarImpresionesEncabezado}
        onClicElemento={registrarClicEncabezado}
        sx={{ borderRadius: 2 }}
      />

      {puedeEditar && (
        <IconButton
          aria-label="Editar encabezado de la tienda"
          onClick={handleAbrir}
          sx={{ top: 8, right: 8, position: 'absolute', color: 'common.white' }}
        >
          <Iconify icon="solar:pen-bold" />
        </IconButton>
      )}
    </Box>
  );

  const renderPortadaSimple = () => (
    <Card
      sx={[
        (theme) => ({
          p: { xs: 2.5, md: 4 },
          color: 'common.white',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundImage: encabezado.fotoUrl
            ? `linear-gradient(135deg, ${varAlpha(theme.vars.palette.common.blackChannel, 0.72)} 0%, ${varAlpha(theme.vars.palette.common.blackChannel, 0.48)} 100%), url(${encabezado.fotoUrl})`
            : `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.dark} 100%)`,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Stack direction="row" spacing={{ xs: 2, md: 3 }} alignItems="center" sx={{ minWidth: 0 }}>
        <Box
          sx={{
            p: 1,
            flexShrink: 0,
            borderRadius: 2,
            display: { xs: 'none', sm: 'flex' },
            bgcolor: 'common.white',
          }}
        >
          <Logo disabled sx={{ width: 48, height: 48 }} />
        </Box>

        {esFranja ? (
          /* LA FRANJA DEL ROTULO IMPRESO: a la izquierda el titulo con el pais
               debajo, una raya vertical, y el lema a la derecha. En el movil la
               raya sobra —no hay dos columnas que separar—, asi que los dos
               bloques se apilan y la raya se va. */
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 1, md: 3 }}
            alignItems={{ md: 'center' }}
            sx={{ minWidth: 0, flexGrow: 1 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="overline"
                sx={{ display: 'block', opacity: 0.72, letterSpacing: 1.2 }}
              >
                Tienda oficial
              </Typography>

              <Typography variant="h4" sx={{ mt: 0.25 }}>
                {encabezado.titulo}
              </Typography>

              <Typography
                variant="overline"
                sx={{ display: 'block', mt: 0.25, opacity: 0.72, letterSpacing: 1.2 }}
              >
                {encabezado.pieTitulo}
              </Typography>
            </Box>

            <Divider
              flexItem
              orientation="vertical"
              sx={{
                borderColor: 'currentColor',
                opacity: 0.32,
                display: { xs: 'none', md: 'block' },
              }}
            />

            <Typography variant="body1" sx={{ minWidth: 0, opacity: 0.8, fontStyle: 'italic' }}>
              {encabezado.subtitulo}
            </Typography>
          </Stack>
        ) : (
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography
              variant="overline"
              sx={{ display: 'block', opacity: 0.72, letterSpacing: 1.2 }}
            >
              Tienda oficial
            </Typography>

            <Typography variant="h4" sx={{ mt: 0.25 }}>
              {encabezado.titulo}
            </Typography>

            {/* El subtitulo baja de linea en el movil: al lado del titulo se
                  parte en tres renglones y la portada se come media pantalla. */}
            <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.8, fontStyle: 'italic' }}>
              {encabezado.subtitulo}
            </Typography>
          </Box>
        )}

        {puedeEditar && (
          <IconButton
            aria-label="Editar encabezado de la tienda"
            onClick={handleAbrir}
            sx={{ color: 'common.white', flexShrink: 0, alignSelf: 'flex-start' }}
          >
            <Iconify icon="solar:pen-bold" />
          </IconButton>
        )}
      </Stack>
    </Card>
  );

  return (
    <>
      {disenoActivo ? renderPortadaConDiseno() : renderPortadaSimple()}

      {/* MAS ANCHO QUE ALTO, COMO LO QUE SE EDITA. La portada es una franja
          apaisada: en el dialogo estrecho el recuadro de la foto salia del
          tamano de un sello y no se veia lo que se estaba encuadrando. */}
      <Dialog fullWidth maxWidth="md" open={dialogo.value} onClose={handleCerrar}>
        <DialogTitle>Encabezado de la tienda</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <StoreHeaderPhoto
              vistaPrevia={borrador.fotoUrl}
              onCambiar={handleCambiarFoto}
              deshabilitado={guardando}
            />

            <TextField
              fullWidth
              label="Título"
              value={borrador.titulo}
              onChange={(event) =>
                setBorrador((actual) => ({ ...actual, titulo: event.target.value }))
              }
              helperText={`En blanco vuelve a "${ENCABEZADO_TIENDA_POR_DEFECTO.titulo}".`}
            />

            <TextField
              select
              fullWidth
              label="Disposición"
              value={borrador.disposicion}
              onChange={(event) =>
                setBorrador((actual) => ({ ...actual, disposicion: event.target.value }))
              }
              helperText="Cómo se colocan los textos sobre la portada."
            >
              <MenuItem value={DISPOSICION_CLASICA}>Clásica: el lema debajo del título</MenuItem>
              <MenuItem value={DISPOSICION_FRANJA}>
                Franja: título y lema separados por una raya
              </MenuItem>
            </TextField>

            {/* Solo se lee en la franja: en la clasica no hay donde ponerlo, y
                un campo que no se ve en ningun sitio confunde mas que ayuda. */}
            {borrador.disposicion === DISPOSICION_FRANJA && (
              <TextField
                fullWidth
                label="Texto bajo el título"
                value={borrador.pieTitulo}
                onChange={(event) =>
                  setBorrador((actual) => ({ ...actual, pieTitulo: event.target.value }))
                }
                helperText={`En blanco vuelve a "${ENCABEZADO_TIENDA_POR_DEFECTO.pieTitulo}".`}
              />
            )}

            <TextField
              fullWidth
              label="Subtítulo"
              value={borrador.subtitulo}
              onChange={(event) =>
                setBorrador((actual) => ({ ...actual, subtitulo: event.target.value }))
              }
              helperText={`En blanco vuelve a "${ENCABEZADO_TIENDA_POR_DEFECTO.subtitulo}".`}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          {/* AVANZADOS NO ES OTRO FORMULARIO: cierra este dialogo y deja el
              encabezado editable en su propio sitio. */}
          <Button
            variant="contained"
            onClick={handleAbrirAvanzados}
            startIcon={<Iconify icon="solar:pallete-2-bold" />}
            sx={{
              mr: 'auto',
              color: 'common.white',
              // MULTICOLOR, Y A PROPOSITO. Es el unico boton del dialogo que no
              // guarda ni cancela: abre otra cosa. Con el mismo aspecto que los
              // de al lado se pulsaba por error creyendo que era "Guardar".
              //
              // El degradado se queda quieto —nada de colores girando— porque
              // esto vive junto a un editor que ya ofrece parpadeo, y dos cosas
              // moviendose a la vez en la misma pantalla cansan.
              backgroundImage: (theme) =>
                `linear-gradient(135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.info.main} 30%, ${theme.vars.palette.secondary.main} 55%, ${theme.vars.palette.warning.main} 78%, ${theme.vars.palette.error.main} 100%)`,
              backgroundSize: '200% 100%',
              transition: (theme) => theme.transitions.create(['background-position']),
              '&:hover': { backgroundPosition: '100% 0' },
            }}
          >
            Avanzados
          </Button>

          {/* UN ICONO Y DOS SALIDAS. Escrito con todas sus letras, "volver" ocupaba
              media fila de botones y aun asi solo ofrecia una de las dos formas
              de deshacer. */}
          <Button
            color="inherit"
            onClick={menuDeReversion.onOpen}
            disabled={guardando}
            startIcon={<Iconify icon="solar:history-bold" />}
            // LA FLECHITA DICE QUE HAY MAS DEBAJO. Sin ella, un boton llamado
            // "Reversar" parece que reversa al pulsarlo, y esto abre dos
            // opciones antes de tocar nada.
            endIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={16} />}
          >
            Reversar
          </Button>

          <Button color="inherit" onClick={handleCerrar}>
            Cancelar
          </Button>

          <Button variant="contained" onClick={handleGuardar} loading={guardando}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <CustomPopover
        open={menuDeReversion.open}
        anchorEl={menuDeReversion.anchorEl}
        onClose={menuDeReversion.onClose}
      >
        <MenuList>
          <MenuItem
            disabled={!encabezado.anterior}
            onClick={() => {
              menuDeReversion.onClose();
              setPorRevertir(DESTINOS_REVERSION.anterior);
            }}
          >
            <Iconify icon="solar:undo-left-round-bold" />
            Volver al diseño anterior
          </MenuItem>

          <MenuItem
            onClick={() => {
              menuDeReversion.onClose();
              setPorRevertir(DESTINOS_REVERSION.fabrica);
            }}
          >
            <Iconify icon="solar:restart-bold" />
            Diseño de fábrica
          </MenuItem>
        </MenuList>
      </CustomPopover>

      <ConfirmDialog
        open={!!porRevertir}
        onClose={() => setPorRevertir(null)}
        title="Revertir el encabezado"
        content={
          porRevertir === DESTINOS_REVERSION.fabrica
            ? 'La portada vuelve al título y al lema de fábrica, y se apaga el diseño libre. La fotografía se conserva.'
            : 'La portada vuelve a como estaba antes del último cambio guardado.'
        }
        action={
          <Button variant="contained" color="warning" loading={guardando} onClick={handleRevertir}>
            Revertir
          </Button>
        }
      />
    </>
  );
}
