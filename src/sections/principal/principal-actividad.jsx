import { useState } from 'react';
import dynamic from 'next/dynamic';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { actividadParaPintar } from 'src/utils/everest/presentacion.mjs';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { CapaDeEsqueleto, useFondoCargado } from 'src/components/esqueleto-de-medios';

import { MarcaDeEjemplo } from './marca-de-ejemplo';
import { useTonosDeMarca } from './use-tonos-de-marca';
import { LapizDelDesigner } from './lapiz-del-designer';
import { CombosDelBanner, useCombosDelBanner } from './combos-del-banner';
import { FondoEnVideo, fondoDeTarjeta, useImagenDeTarjeta } from './imagen-de-tarjeta';
import {
  seMuestra,
  navyDelDiseno,
  colorDelDiseno,
  letraDelDiseno,
  radioDelDiseno,
  textoDelDiseno,
  valorDelDiseno,
  fondoDelDiseno,
} from './diseno-de-tarjeta';

// ----------------------------------------------------------------------
// LA PROXIMA ACTIVIDAD Y COMO VOY.
//
// Las dos responden a lo mismo —"¿que tengo por delante?"— desde dos lados: una
// es la fecha que viene, la otra lo que falta para el siguiente nivel. Por eso
// van juntas y en la misma fila.
//
// `diseno` (EXPLORA Designer) cambia colores, tamaños, textos fijos y que se
// enseña. Sin diseño publicado, cada pieza usa lo que llevaba escrito.
// ----------------------------------------------------------------------

// La imagen de esta tarjeta es UNA, la misma para todos, asi que va colgada de un
// identificador fijo y no de la actividad: cambiarla la cambia para la
// organizacion entera, que es lo que se quiere.
const ID_DE_LA_TARJETA = 'proxima-actividad';

// Los combos (y la tienda) solo se cargan al pulsar "Inscribirme".
const InscripcionActividadDialog = dynamic(
  () => import('./inscripcion-actividad-dialog').then((m) => m.InscripcionActividadDialog),
  { ssr: false }
);

// El banner lee los combos de la tienda tanto en /principal como en la vista
// previa del Designer, para que ambos enseñen la misma composición.
export function PrincipalProximaActividad(props) {
  return props.conInscripcion ? (
    <ActividadConCombos {...props} />
  ) : (
    <TarjetaDeActividad {...props} />
  );
}

function ActividadConCombos(props) {
  const combos = useCombosDelBanner(actividadParaPintar(props.actividad));

  return <TarjetaDeActividad {...props} combos={combos} />;
}

function TarjetaDeActividad({
  actividad: recibida,
  diseno,
  puedeEditar = false,
  conInscripcion = false,
  combos = [],
}) {
  const conCombos = combos.length > 0;
  const [inscribiendo, setInscribiendo] = useState(false);
  const tonos = useTonosDeMarca();
  const { ORO, AZUL } = tonos;
  // Con un fondo elegido en el Designer, el velo de la foto toma ese color.
  const NAVY = navyDelDiseno(tonos.NAVY, diseno);
  // Esta tarjeta admite tambien un video corto, que corre en bucle como un GIF.
  const tarjeta = useImagenDeTarjeta(ID_DE_LA_TARJETA, {
    aceptaVideo: true,
  });

  // LO QUE SE PUBLICA DESDE EXPLORA DESIGNER (fase 4), SI LO HAY. Con fecha de
  // inicio, las fechas y los dias que faltan se calculan hoy, al pintar. Con
  // fondo propio, manda sobre la foto de siempre. Sin nada de eso —el valor de
  // fabrica— la tarjeta se pinta exactamente como antes.
  const actividad = actividadParaPintar(recibida);
  const foto = actividad.fondo ? actividad.fondo.url : tarjeta.foto;
  const esVideo = actividad.fondo ? actividad.fondo.tipo === 'video' : tarjeta.esVideo;
  // Esqueleto mientras no se sabe si hay fondo o mientras la foto baja. El video
  // lleva el suyo propio (la onda del `main` sobre el `<video>`).
  const fotoLista = useFondoCargado(foto, { esVideo });
  const cargandoFondo = (!actividad.fondo && tarjeta.buscando) || !fotoLista;
  const colorTexto = diseno?.colorTexto ?? 'rgba(255,255,255,.88)';
  const letraDelTexto = letraDelDiseno(diseno, { tamano: 'tamanoTexto' });

  if (conCombos) {
    return (
      <BannerDeActividadConCombos
        actividad={actividad}
        diseno={diseno}
        puedeEditar={puedeEditar}
        conInscripcion={conInscripcion}
        combos={combos}
        foto={foto}
        esVideo={esVideo}
        cargandoFondo={cargandoFondo}
        tonos={tonos}
        navy={NAVY}
        colorTexto={colorTexto}
        letraDelTexto={letraDelTexto}
        inscribiendo={inscribiendo}
        setInscribiendo={setInscribiendo}
      />
    );
  }

  return (
    <Card
      data-everest-bloque="proxima-actividad"
      sx={{
        px: { xs: 2, sm: 2.5, md: 4, lg: 2, xl: 4 },
        py: { xs: 2, sm: 2.5, md: 5, lg: 2, xl: 5 },
        // El banner conserva su 21:9 en escritorio. En tableta, las dos
        // columnas se apilan y necesitan su altura natural cuando hay combos.
        aspectRatio: { sm: conCombos ? 'auto' : '16 / 9', md: '21 / 9' },
        '@media (min-width: 900px) and (max-width: 959.95px)': {
          px: 3,
          py: 2.5,
        },
        color: '#FFFFFF',
        display: 'grid',
        position: 'relative',
        // Con combos, dos columnas: la actividad a la izquierda y sus combos a
        // la derecha (en el teléfono, uno debajo del otro).
        gap: { xs: 2, md: 3, lg: 2, xl: 3 },
        gridTemplateColumns: {
          xs: '1fr',
          md: conCombos ? 'minmax(0, 1.5fr) minmax(0, 1fr)' : '1fr',
          lg: conCombos ? 'minmax(0, 1.15fr) minmax(0, 1fr)' : '1fr',
          xl: conCombos ? 'minmax(0, 1.5fr) minmax(0, 1fr)' : '1fr',
        },
        // El espacio sobrante de la columna izquierda se reparte entre sus
        // bloques; rowGap asegura una separación mínima al estrecharse.
        ...fondoDeTarjeta({ foto, esVideo, navy: NAVY, varAlpha }),
        // Sin foto, el fondo elegido en el Designer (con dos tonos, degradado).
        ...(!foto && fondoDelDiseno(diseno, { angulo: 160 })),
        ...radioDelDiseno(diseno),
        // La capa del esqueleto va con `zIndex: -1`: encima del fondo de la
        // tarjeta y debajo del texto, que se lee mientras tanto.
        isolation: 'isolate',
      }}
    >
      {foto && esVideo && <FondoEnVideo src={foto} navy={NAVY} varAlpha={varAlpha} />}
      {!(foto && esVideo) && <CapaDeEsqueleto visible={cargandoFondo} sx={{ zIndex: -1 }} />}

      {/* LA COLUMNA DE LA ACTIVIDAD. El reparto del aire sigue siendo el mismo
          (`space-between` + `rowGap`), ahora dentro de su columna. */}
      <Box
        sx={{
          rowGap: { xs: 1.5, md: 1 },
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* AIRE ENTRE LAS CUATRO COSAS QUE HAY QUE LEER. Iban pegadas —medio paso
          entre una y otra— y la tarjeta se leia como un bloque de texto. Los
          margenes crecen aqui dentro y el contenedor no se mueve: la proporcion
          16:9 y el relleno son los mismos; el reparto lo hace el `space-between`
          del contenedor. */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify
            icon={valorDelDiseno(diseno, 'iconoEtiqueta', 'custom:calendar-agenda-outline')}
            width={20}
            sx={{ color: diseno?.colorAcento ?? ORO.claro, width: { lg: 16, xl: 20 } }}
          />
          <Typography
            variant="overline"
            sx={{
              color: diseno?.colorTexto ?? NAVY.texto,
              fontSize: { md: 14, lg: 11, xl: 14 },
              letterSpacing: 0.7,
            }}
          >
            {textoDelDiseno(diseno, 'etiqueta', 'Próxima actividad')}
          </Typography>

          {puedeEditar && (
            <Box sx={{ ml: 'auto', display: 'flex' }}>
              <LapizDelDesigner idBloque={ID_DE_LA_TARJETA} sobreOscuro />
            </Box>
          )}
        </Stack>

        <Typography
          variant="h6"
          sx={{
            color: diseno?.colorTitulo ?? '#FFFFFF',
            fontSize: { xs: 22, sm: 25, md: 30, lg: 20, xl: 30 },
            lineHeight: 1.13,
            ...letraDelDiseno(diseno, { tamano: 'tamanoTitulo', peso: 'pesoTitulo' }),
          }}
        >
          {actividad.titulo}
        </Typography>

        {(seMuestra(diseno, 'mostrarLugar') || seMuestra(diseno, 'mostrarFechas')) && (
          <Stack spacing={0.5}>
            {seMuestra(diseno, 'mostrarLugar') && (
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Iconify
                  icon="solar:flag-bold"
                  width={20}
                  sx={{
                    color: diseno?.colorAcento ?? NAVY.texto,
                    flex: 'none',
                    width: { lg: 16, xl: 20 },
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    color: colorTexto,
                    fontSize: { md: 16, lg: 12, xl: 16 },
                    lineHeight: 1.35,
                    ...letraDelTexto,
                  }}
                >
                  {actividad.lugar}
                </Typography>
              </Stack>
            )}

            {seMuestra(diseno, 'mostrarFechas') && (
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Iconify
                  icon="solar:calendar-date-bold"
                  width={20}
                  sx={{
                    color: diseno?.colorAcento ?? NAVY.texto,
                    flex: 'none',
                    width: { lg: 16, xl: 20 },
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    color: colorTexto,
                    fontSize: { md: 16, lg: 12, xl: 16 },
                    lineHeight: 1.35,
                    ...letraDelTexto,
                  }}
                >
                  {actividad.fechas}
                </Typography>
              </Stack>
            )}
          </Stack>
        )}

        {/* La cuenta atrás se lee como una cifra, con la etiqueta encima. */}
        {seMuestra(diseno, 'mostrarCuenta') && (
          <Box
            sx={{
              px: { xs: 1.25, md: 1.75, lg: 1.25, xl: 1.75 },
              py: { xs: 0.5, md: 1, lg: 0.5, xl: 1 },
              borderRadius: 1.5,
              alignSelf: 'flex-start',
              bgcolor: NAVY.abierto,
              border: `solid 1px ${NAVY.linea}`,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: diseno?.colorTexto ?? NAVY.texto,
                display: 'block',
                fontSize: { md: 14, lg: 11, xl: 14 },
                lineHeight: 1.2,
              }}
            >
              {textoDelDiseno(diseno, 'textoFaltan', conCombos ? 'Evento en' : 'Faltan')}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: diseno?.colorTitulo ?? '#FFFFFF',
                fontSize: { md: 25, lg: 18, xl: 25 },
                lineHeight: 1.2,
                fontWeight: 700,
              }}
            >
              {actividad.diasQueFaltan} {textoDelDiseno(diseno, 'textoDias', 'días')}
            </Typography>
          </Box>
        )}

        {/* EL ESTADO, ABAJO A LA IZQUIERDA, EN LA MISMA VERTICAL QUE TODO LO DEMAS.
          Estaba arriba a la derecha, en la unica esquina que no comparte linea
          con nada: el ojo tenia que salirse de la columna de la izquierda —donde
          estan el titulo, el lugar, la fecha y la cuenta atras— para leerlo y
          volver. Abajo cierra esa misma columna, y de paso empareja con el boton
          en la fila del pie, que antes iba solo. */}
        {(seMuestra(diseno, 'mostrarEstado') || seMuestra(diseno, 'mostrarBoton')) && (
          <Stack direction="row" alignItems="center" spacing={1}>
            {/* RELLENO, NO TRANSLUCIDO. En `soft` el verde va con transparencia y
              debajo hay una fotografia: el color se mezclaba con lo que cayera
              detras y el sello salia apagado, y distinto en cada imagen. Relleno es
              el mismo verde siempre, se ponga la foto que se ponga. */}
            {seMuestra(diseno, 'mostrarEstado') && (
              <Label
                variant="filled"
                color="success"
                startIcon={<Iconify icon="solar:check-circle-bold" width={20} />}
                // LA MISMA ALTURA QUE EL BOTON DE AL LADO. La etiqueta trae 24px fijos y
                // el boton pequeño 30: juntos en la fila del pie, el sello se veia un
                // escalon mas bajo. Se estira a la altura de la fila en vez de escribir
                // un numero que habria que cambiar si el boton cambia de tamaño.
                sx={{
                  height: 'auto',
                  alignSelf: 'stretch',
                  px: { xs: 1.25, md: 1.75, lg: 1.25, xl: 1.75 },
                  py: { md: 1, lg: 0.5, xl: 1 },
                  fontSize: { md: 16, lg: 12, xl: 16 },
                  borderRadius: 1.5,
                  ...colorDelDiseno(diseno, 'colorEstado', 'bgcolor'),
                }}
              >
                {actividad.estado}
              </Label>
            )}

            {seMuestra(diseno, 'mostrarBoton') && !conCombos && (
              <Button
                // Con inscripción, el botón abre los combos del campamento (y si la
                // tienda no tiene combos para esta actividad, lleva a su enlace).
                {...(conInscripcion
                  ? { onClick: () => setInscribiendo(true) }
                  : {
                    component: RouterLink,
                    href: actividad.boton?.destino ?? paths.dashboard.calendar,
                  })}
                size="small"
                variant="contained"
                endIcon={<Iconify icon="solar:double-alt-arrow-right-bold-duotone" />}
                sx={{
                  ml: 'auto',
                  bgcolor: diseno?.colorBoton ?? AZUL.principal,
                  '&:hover': { bgcolor: diseno?.colorBoton ?? AZUL.encima },
                  ...colorDelDiseno(diseno, 'colorTextoBoton'),
                }}
              >
                {actividad.boton?.texto ?? '¡Inscrbirme ahora!'}
              </Button>
            )}
          </Stack>
        )}
      </Box>

      {/* LOS COMBOS, A LA DERECHA. Cada fila y "Ver combos" abren "Inscribirme". */}
      {conCombos && (
        <Stack spacing={{ xs: 2, lg: 1, xl: 2 }} sx={{ minWidth: 0, justifyContent: 'center' }}>
          <CombosDelBanner
            combos={combos}
            acento={diseno?.colorAcento ?? ORO.claro}
            onAbrir={() => setInscribiendo(true)}
          />

          {seMuestra(diseno, 'mostrarBoton') && (
            <Button
              onClick={() => setInscribiendo(true)}
              size="medium"
              variant="contained"
              color="primary"
              endIcon={<Iconify icon="eva:arrow-ios-forward-fill" />}
              sx={{
                alignSelf: 'flex-end',
                px: { md: 2.5, lg: 1.5, xl: 2.5 },
                py: { md: 1, lg: 0.5, xl: 1 },
                borderRadius: 1.5,
                fontSize: { md: 15, lg: 12, xl: 15 },
                color: '#FFFFFF',
                bgcolor: AZUL.principal,
                '&:hover': { bgcolor: AZUL.encima },
              }}
            >
              Ver combos
            </Button>
          )}
        </Stack>
      )}

      {conInscripcion && inscribiendo && (
        <InscripcionActividadDialog
          abierto={inscribiendo}
          onCerrar={() => setInscribiendo(false)}
          actividad={actividad}
          destinoSinCombos={actividad.boton?.destino ?? paths.dashboard.calendar}
        />
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

function BannerDeActividadConCombos({
  actividad,
  diseno,
  puedeEditar,
  conInscripcion,
  combos,
  foto,
  esVideo,
  cargandoFondo,
  tonos,
  navy,
  colorTexto,
  letraDelTexto,
  inscribiendo,
  setInscribiendo,
}) {
  const { ORO, AZUL } = tonos;
  const abrirCombos = () => setInscribiendo(true);
  const mostrarLugar = seMuestra(diseno, 'mostrarLugar');
  const mostrarFechas = seMuestra(diseno, 'mostrarFechas');

  return (
    <Card
      data-everest-bloque="proxima-actividad"
      sx={{
        p: 0,
        aspectRatio: { md: '19 / 9' },
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
        ...fondoDeTarjeta({ foto, esVideo, navy, varAlpha, veloLigero: true }),
        ...(!foto && fondoDelDiseno(diseno, { angulo: 160 })),
        ...radioDelDiseno(diseno),
      }}
    >
      {foto && esVideo && <FondoEnVideo src={foto} navy={navy} varAlpha={varAlpha} veloLigero />}
      {!(foto && esVideo) && <CapaDeEsqueleto visible={cargandoFondo} sx={{ zIndex: -1 }} />}

      <Box
        sx={{
          px: { xs: 2, sm: 3, md: 4, lg: 3, xl: 4 },
          pt: { xs: 3, md: 6, lg: 3, xl: 6 },
          pb: { xs: 3, md: 2.5, lg: 1.5, xl: 2.5 },
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: { xs: 2, md: 1.5, lg: 1, xl: 1.5 },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 1 }}>
          <Iconify
            icon={valorDelDiseno(diseno, 'iconoEtiqueta', 'custom:calendar-agenda-outline')}
            width={20}
            sx={{ color: diseno?.colorAcento ?? ORO.claro }}
          />
          <Typography
            variant="overline"
            sx={{
              color: diseno?.colorTexto ?? navy.texto,
              fontSize: { md: 12, lg: 10, xl: 12 },
              letterSpacing: 0.7,
            }}
          >
            {textoDelDiseno(diseno, 'etiqueta', 'Próxima actividad')}
          </Typography>
          {puedeEditar && (
            <Box sx={{ ml: 'auto', display: 'flex' }}>
              <LapizDelDesigner idBloque={ID_DE_LA_TARJETA} sobreOscuro />
            </Box>
          )}
        </Stack>

        <Typography
          variant="h6"
          sx={{
            maxWidth: { xs: 1, md: 540, lg: 440, xl: 620 },
            color: diseno?.colorTitulo ?? '#FFFFFF',
            fontSize: { xs: 24, sm: 28, md: 32, lg: 23, xl: 36 },
            lineHeight: 1.12,
            ...letraDelDiseno(diseno, { tamano: 'tamanoTitulo', peso: 'pesoTitulo' }),
          }}
        >
          {actividad.titulo}
        </Typography>

        {(mostrarLugar || mostrarFechas) && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'center' }}
            spacing={{ xs: 0.5, sm: 1.5 }}
            sx={{ color: colorTexto }}
          >
            {mostrarLugar && (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Iconify
                  icon="solar:map-point-linear"
                  width={21}
                  sx={{ color: diseno?.colorAcento ?? navy.texto }}
                />
                <Typography
                  variant="body2"
                  sx={{ fontSize: { md: 14, lg: 11, xl: 15 }, ...letraDelTexto }}
                >
                  {actividad.lugar}
                </Typography>
              </Stack>
            )}
            {mostrarLugar && mostrarFechas && (
              <Box
                sx={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  bgcolor: 'currentColor',
                  display: { xs: 'none', sm: 'block' },
                }}
              />
            )}
            {mostrarFechas && (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Iconify
                  icon="solar:calendar-date-bold"
                  width={21}
                  sx={{ color: diseno?.colorAcento ?? navy.texto }}
                />
                <Typography
                  variant="body2"
                  sx={{ fontSize: { md: 14, lg: 11, xl: 15 }, ...letraDelTexto }}
                >
                  {actividad.fechas}
                </Typography>
              </Stack>
            )}
          </Stack>
        )}

        {(seMuestra(diseno, 'mostrarCuenta') || seMuestra(diseno, 'mostrarEstado')) && (
          <Stack
            direction="row"
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
            gap={{ xs: 1, md: 1.5 }}
          >
            {seMuestra(diseno, 'mostrarCuenta') && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                  px: { xs: 1.25, md: 1.5 },
                  py: { xs: 0.75, md: 1 },
                  borderRadius: 2,
                  bgcolor: navy.abierto,
                  border: `solid 1px ${navy.linea}`,
                }}
              >
                <Iconify icon="solar:calendar-date-bold" width={22} sx={{ color: navy.texto }} />
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: colorTexto,
                      fontSize: { md: 11, lg: 10, xl: 11 },
                      lineHeight: 1.1,
                    }}
                  >
                    {textoDelDiseno(diseno, 'textoFaltan', 'Evento en')}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: diseno?.colorTitulo ?? '#FFFFFF',
                      fontSize: { md: 20, lg: 16, xl: 20 },
                      lineHeight: 1.2,
                      fontWeight: 700,
                    }}
                  >
                    {actividad.diasQueFaltan} {textoDelDiseno(diseno, 'textoDias', 'días')}
                  </Typography>
                </Box>
              </Stack>
            )}
            {seMuestra(diseno, 'mostrarEstado') && (
              <Label
                variant="filled"
                color="success"
                startIcon={<Iconify icon="solar:check-circle-bold" width={20} />}
                sx={{
                  height: { xs: 36, md: 38, lg: 32, xl: 38 },
                  px: { xs: 1.5, md: 2, lg: 1.5, xl: 2 },
                  borderRadius: 99,
                  fontSize: { md: 14, lg: 11, xl: 14 },
                  ...colorDelDiseno(diseno, 'colorEstado', 'bgcolor'),
                }}
              >
                {actividad.estado}
              </Label>
            )}
          </Stack>
        )}
      </Box>

      <Box
        sx={{
          flex: { md: '0 0 18%' },
          px: { xs: 2, sm: 3, md: 3, lg: 2, xl: 3 },
          py: { xs: 1.25, md: 0.75, lg: 0.5, xl: 0.75 },
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(3, minmax(0, 1fr))',
            md: `minmax(0, 1.1fr) repeat(${combos.length}, minmax(0, 1fr)) auto`,
          },
          alignItems: 'center',
          rowGap: { xs: 1, sm: 1.5, md: 0 },
          backgroundImage: `linear-gradient(180deg, ${varAlpha(navy.canal, 0.30)}, ${varAlpha(navy.canal, 0.46)})`,
          borderTop: `1px solid ${varAlpha('255 255 255', 0.18)}`,
          backdropFilter: 'blur(6px)',
        }}
      >
        <Box
          sx={{
            gridColumn: { sm: '1 / -1', md: 'auto' },
            pl: { md: 1.5 },
            borderLeft: { md: `3px solid ${AZUL.principal}` },
          }}
        >
          <Typography
            sx={{
              color: navy.texto,
              fontSize: { xs: 16, md: 17, lg: 14, xl: 18 },
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            Elige tu combo
          </Typography>
        </Box>
        <CombosDelBanner
          combos={combos}
          acento={diseno?.colorAcento ?? ORO.claro}
          onAbrir={abrirCombos}
        />
        {seMuestra(diseno, 'mostrarBoton') && (
          <Button
            onClick={abrirCombos}
            variant="contained"
            color="primary"
            endIcon={<Iconify icon="eva:arrow-ios-forward-fill" />}
            sx={{
              gridColumn: { xs: '1 / -1', md: 'auto' },
              justifySelf: { xs: 'stretch', sm: 'end' },
              ml: { md: 2 },
              px: { md: 2.5, lg: 1.5, xl: 2.5 },
              py: { md: 1, lg: 0.75, xl: 1 },
              borderRadius: 99,
              whiteSpace: 'nowrap',
              fontSize: { md: 12, lg: 11, xl: 13 },
              bgcolor: AZUL.principal,
              '&:hover': { bgcolor: AZUL.encima },
            }}
          >
            Ver combos
          </Button>
        )}
      </Box>

      {conInscripcion && inscribiendo && (
        <InscripcionActividadDialog
          abierto={inscribiendo}
          onCerrar={() => setInscribiendo(false)}
          actividad={actividad}
          destinoSinCombos={actividad.boton?.destino ?? paths.dashboard.calendar}
        />
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

export function PrincipalMiProgreso({ progreso, diseno, esEjemplo, puedeEditar = false }) {
  const { ACENTOS } = useTonosDeMarca();

  return (
    <Card
      data-everest-bloque="mi-progreso"
      sx={{
        p: 2.5,
        height: 1,
        display: 'flex',
        flexDirection: 'column',
        ...fondoDelDiseno(diseno),
        ...radioDelDiseno(diseno),
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Iconify
          icon={valorDelDiseno(diseno, 'iconoTitulo', 'solar:medal-ribbon-bold')}
          width={20}
          sx={{ color: diseno?.colorAcento ?? 'text.secondary' }}
        />
        <Typography variant="overline" sx={{ color: diseno?.colorTexto ?? 'text.secondary' }}>
          {textoDelDiseno(diseno, 'titulo', 'Mi progreso')}
        </Typography>
        {esEjemplo && <MarcaDeEjemplo sx={{ ml: 'auto' }} />}
        {puedeEditar && (
          <LapizDelDesigner idBloque="mi-progreso" sx={{ ml: esEjemplo ? 0 : 'auto' }} />
        )}
      </Stack>

      <Typography
        variant="subtitle1"
        sx={{
          ...colorDelDiseno(diseno, 'colorTitulo'),
          ...letraDelDiseno(diseno, { tamano: 'tamanoTitulo', peso: 'pesoTitulo' }),
        }}
      >
        {progreso.nivel}
      </Typography>

      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1, mb: 0.5 }}>
        <LinearProgress
          variant="determinate"
          value={progreso.porcentaje}
          sx={{
            flex: '1 1 auto',
            height: 8,
            '& .MuiLinearProgress-bar': { bgcolor: diseno?.colorBarra ?? ACENTOS.verde.fondo },
          }}
        />
        <Typography variant="subtitle2" sx={colorDelDiseno(diseno, 'colorTitulo')}>
          {progreso.porcentaje}%
        </Typography>
      </Stack>

      <Typography
        variant="caption"
        sx={{
          color: diseno?.colorTexto ?? 'text.secondary',
          mb: 2,
          ...letraDelDiseno(diseno, { tamano: 'tamanoTexto' }),
        }}
      >
        {progreso.hechas} / {progreso.total}{' '}
        {textoDelDiseno(diseno, 'textoActividades', 'actividades')}
      </Typography>

      {seMuestra(diseno, 'mostrarAreas') && (
        <Stack spacing={1.25} sx={{ flex: '1 1 auto' }}>
          {progreso.areas.map((area) => {
            const acento = ACENTOS[area.acento];
            const completado = area.avance >= 100;

            return (
              <Stack key={area.nombre} direction="row" alignItems="center" spacing={1.25}>
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    flex: 'none',
                    borderRadius: 1,
                    display: 'grid',
                    color: acento.fondo,
                    placeItems: 'center',
                    bgcolor: acento.velo,
                  }}
                >
                  <Iconify icon="solar:medal-star-bold" width={16} />
                </Box>

                {/* EL NOMBRE ENTERO, AUNQUE SE PARTA EN DOS LINEAS. Con `noWrap`
                    salia "Primeros auxili..." y "Alas de ...": la etiqueta de la
                    derecha crece con su texto y se comia la columna del nombre, que
                    es lo unico que identifica la fila. Un nombre cortado no dice
                    cual es el area; una linea de mas, si. */}
                <Typography
                  variant="body2"
                  sx={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    lineHeight: 1.3,
                    ...colorDelDiseno(diseno, 'colorTexto'),
                    ...letraDelDiseno(diseno, { tamano: 'tamanoTexto' }),
                  }}
                >
                  {area.nombre}
                </Typography>

                {/* El porcentaje SOLO cuando falta algo. En lo ya completado no
                    aporta —siempre diria 100— y le quitaba sitio al nombre. */}
                <Label
                  variant="soft"
                  color={completado ? 'success' : 'warning'}
                  sx={{ flex: 'none' }}
                >
                  {completado ? area.estado : `${area.estado} (${area.avance}%)`}
                </Label>
              </Stack>
            );
          })}
        </Stack>
      )}

      {seMuestra(diseno, 'mostrarBoton') && (
        <Button
          component={RouterLink}
          href={valorDelDiseno(diseno, 'destinoBoton', paths.dashboard.certificates)}
          size="small"
          color="inherit"
          endIcon={<Iconify icon="solar:double-alt-arrow-right-bold-duotone" />}
          sx={{ mt: 2, alignSelf: 'flex-end', ...colorDelDiseno(diseno, 'colorAcento') }}
        >
          {textoDelDiseno(diseno, 'textoBoton', 'Ver mi progreso')}
        </Button>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

/**
 * La tira de historias.
 *
 * Los circulos son marcadores de sitio: no hay historias de verdad todavia. Van
 * en gris con la inicial del tema y NO se pueden pulsar, porque un circulo que
 * parece una foto y no abre nada se intenta pulsar tres veces antes de rendirse.
 */
export function PrincipalHistorias({ historias, diseno, esEjemplo, puedeEditar = false }) {
  const { AZUL } = useTonosDeMarca();
  const circulo = diseno?.tamanoCirculo ?? 56;
  // La columna crece con el circulo: con 72 fijos, un circulo de 90 se salia.
  const ancho = Math.max(72, circulo + 16);

  return (
    <Card
      data-everest-bloque="historias"
      sx={{ p: 2.5, ...fondoDelDiseno(diseno), ...radioDelDiseno(diseno) }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Iconify
          icon={valorDelDiseno(diseno, 'iconoTitulo', 'solar:gallery-wide-bold')}
          width={20}
          sx={{ color: diseno?.colorAcento ?? 'text.secondary' }}
        />
        <Typography
          variant="overline"
          sx={{
            color: diseno?.colorTitulo ?? 'text.secondary',
            ...letraDelDiseno(diseno, { tamano: 'tamanoTitulo', peso: 'pesoTitulo' }),
          }}
        >
          {textoDelDiseno(diseno, 'titulo', 'Historias')}
        </Typography>
        {esEjemplo && <MarcaDeEjemplo sx={{ ml: 'auto' }} />}
        {puedeEditar && (
          <LapizDelDesigner idBloque="historias" sx={{ ml: esEjemplo ? 0 : 'auto' }} />
        )}
      </Stack>

      <Box sx={{ overflowX: 'auto', pb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ width: 'max-content' }}>
          {seMuestra(diseno, 'mostrarTuHistoria') && (
            <Stack spacing={0.75} alignItems="center" sx={{ width: ancho }}>
              <Box
                sx={{
                  width: circulo,
                  height: circulo,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  color: diseno?.colorAcento ?? AZUL.principal,
                  bgcolor: AZUL.velo,
                  border: (theme) => `dashed 2px ${theme.vars.palette.divider}`,
                }}
              >
                <Iconify icon="solar:add-circle-bold" width={22} />
              </Box>
              <Typography
                variant="caption"
                sx={{ color: diseno?.colorTexto ?? 'text.secondary' }}
                noWrap
              >
                {textoDelDiseno(diseno, 'textoTuHistoria', 'Tu historia')}
              </Typography>
            </Stack>
          )}

          {historias.map((historia) => (
            <Stack key={historia.clave} spacing={0.75} alignItems="center" sx={{ width: ancho }}>
              <Avatar
                sx={{
                  width: circulo,
                  height: circulo,
                  bgcolor: 'background.neutral',
                  color: 'text.disabled',
                  border: (theme) => `solid 2px ${theme.vars.palette.divider}`,
                }}
              >
                {historia.titulo.charAt(0)}
              </Avatar>
              <Typography
                variant="caption"
                sx={{
                  color: diseno?.colorTexto ?? 'text.secondary',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  ...letraDelDiseno(diseno, { tamano: 'tamanoTexto' }),
                }}
              >
                {historia.titulo}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Card>
  );
}
