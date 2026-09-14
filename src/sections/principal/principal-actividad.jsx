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

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { MarcaDeEjemplo } from './marca-de-ejemplo';
import { useTonosDeMarca } from './use-tonos-de-marca';
import { LapizDeImagen, fondoDeTarjeta, useImagenDeTarjeta } from './imagen-de-tarjeta';

// ----------------------------------------------------------------------
// LA PROXIMA ACTIVIDAD Y COMO VOY.
//
// Las dos responden a lo mismo —"¿que tengo por delante?"— desde dos lados: una
// es la fecha que viene, la otra lo que falta para el siguiente nivel. Por eso
// van juntas y en la misma fila.
// ----------------------------------------------------------------------

// La imagen de esta tarjeta es UNA, la misma para todos, asi que va colgada de un
// identificador fijo y no de la actividad: cambiarla la cambia para la
// organizacion entera, que es lo que se quiere.
const ID_DE_LA_TARJETA = 'proxima-actividad';

export function PrincipalProximaActividad({ actividad, puedeEditar = false }) {
  const { NAVY, ORO, AZUL } = useTonosDeMarca();
  const { foto, subiendo, elegirFoto } = useImagenDeTarjeta(ID_DE_LA_TARJETA);

  return (
    <Card
      sx={{
        p: 2,
        // 16:9, NO LA ALTURA DE LA VECINA. Llevaba `height: 1`, asi que se
        // estiraba hasta igualar a "Mi progreso" y le sobraban 150 pixeles de
        // vacio entre la cuenta atras y el pie. Con una proporcion fija la
        // tarjeta mide lo que tiene que medir y se encoge con el ancho.
        aspectRatio: '16 / 9',
        color: '#FFFFFF',
        display: 'flex',
        position: 'relative',
        flexDirection: 'column',
        // EL AIRE SE REPARTE, NO SE ESCRIBE. Con un margen fijo debajo de cada
        // cosa la tarjeta se desbordaba: a 392px de ancho el 16:9 deja 220px de
        // alto y el contenido ya los ocupaba enteros, asi que los margenes nuevos
        // se comian el relleno de abajo y el pie tocaba el borde.
        //
        // `space-between` reparte lo que sobre —en una tarjeta ancha sobra
        // bastante— y `rowGap` es el minimo que se respeta cuando no sobra nada.
        // El contenedor no cambia: misma proporcion y mismo relleno.
        rowGap: 0.5,
        justifyContent: 'space-between',
        ...fondoDeTarjeta({ foto, navy: NAVY, varAlpha }),
      }}
    >
      {/* AIRE ENTRE LAS CUATRO COSAS QUE HAY QUE LEER. Iban pegadas —medio paso
          entre una y otra— y la tarjeta se leia como un bloque de texto. Los
          margenes crecen aqui dentro y el contenedor no se mueve: la proporcion
          16:9 y el relleno son los mismos; el reparto lo hace el `space-between`
          del contenedor. */}
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Iconify icon="custom:calendar-agenda-outline" width={17} sx={{ color: ORO.claro }} />
        <Typography variant="overline" sx={{ color: NAVY.texto }}>
          Próxima actividad
        </Typography>

        {puedeEditar && (
          <Box sx={{ ml: 'auto', display: 'flex' }}>
            <LapizDeImagen tieneFoto={Boolean(foto)} subiendo={subiendo} onElegir={elegirFoto} />
          </Box>
        )}
      </Stack>

      {/* En `h6` y no en `h5`: a 392 pixeles de ancho el titulo se parte en dos
          lineas, y con el cuerpo mas grande esas dos lineas no cabian en la
          proporcion 16:9. */}
      <Typography variant="h6" sx={{ color: '#FFFFFF', lineHeight: 1.25 }}>
        {actividad.titulo}
      </Typography>

      <Stack spacing={0.25}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Iconify icon="solar:flag-bold" width={16} sx={{ color: NAVY.texto, flex: 'none' }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.88)', lineHeight: 1.35 }}>
            {actividad.lugar}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Iconify
            icon="solar:calendar-date-bold"
            width={16}
            sx={{ color: NAVY.texto, flex: 'none' }}
          />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.88)', lineHeight: 1.35 }}>
            {actividad.fechas}
          </Typography>
        </Stack>
      </Stack>

      {/* LA CUENTA ATRAS, EL "FALTAN" ENCIMA Y EL NUMERO DEBAJO. Es el unico dato
          de la tarjeta que cambia solo y el que decide si hay que hacer algo hoy;
          apilado se lee como una cifra y no como una frase. Apretado de relleno
          para que las dos alturas quepan en la proporcion 16:9. */}
      <Box
        sx={{
          px: 1.25,
          py: 0.25,
          borderRadius: 1.25,
          alignSelf: 'flex-start',
          bgcolor: NAVY.abierto,
          border: `solid 1px ${NAVY.linea}`,
        }}
      >
        <Typography variant="caption" sx={{ color: NAVY.texto, display: 'block', lineHeight: 1.2 }}>
          Faltan
        </Typography>
        <Typography variant="h5" sx={{ color: '#FFFFFF', lineHeight: 1.2 }}>
          {actividad.diasQueFaltan} días
        </Typography>
      </Box>

      {/* EL ESTADO, ABAJO A LA IZQUIERDA, EN LA MISMA VERTICAL QUE TODO LO DEMAS.
          Estaba arriba a la derecha, en la unica esquina que no comparte linea
          con nada: el ojo tenia que salirse de la columna de la izquierda —donde
          estan el titulo, el lugar, la fecha y la cuenta atras— para leerlo y
          volver. Abajo cierra esa misma columna, y de paso empareja con el boton
          en la fila del pie, que antes iba solo. */}
      <Stack direction="row" alignItems="center" spacing={1}>
        {/* RELLENO, NO TRANSLUCIDO. En `soft` el verde va con transparencia y
            debajo hay una fotografia: el color se mezclaba con lo que cayera
            detras y el sello salia apagado, y distinto en cada imagen. Relleno es
            el mismo verde siempre, se ponga la foto que se ponga. */}
        <Label
          variant="filled"
          color="success"
          startIcon={<Iconify icon="solar:check-circle-bold" />}
        >
          {actividad.estado}
        </Label>

        <Button
          component={RouterLink}
          href={paths.dashboard.calendar}
          size="small"
          variant="contained"
          endIcon={<Iconify icon="solar:double-alt-arrow-right-bold-duotone" />}
          sx={{ ml: 'auto', bgcolor: AZUL.principal, '&:hover': { bgcolor: AZUL.encima } }}
        >
          Ver actividad
        </Button>
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function PrincipalMiProgreso({ progreso, esEjemplo }) {
  const { ACENTOS } = useTonosDeMarca();

  return (
    <Card sx={{ p: 2.5, height: 1, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Iconify icon="solar:medal-ribbon-bold" width={20} sx={{ color: 'text.secondary' }} />
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Mi progreso
        </Typography>
        {esEjemplo && <MarcaDeEjemplo sx={{ ml: 'auto' }} />}
      </Stack>

      <Typography variant="subtitle1">{progreso.nivel}</Typography>

      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1, mb: 0.5 }}>
        <LinearProgress
          variant="determinate"
          value={progreso.porcentaje}
          sx={{
            flex: '1 1 auto',
            height: 8,
            '& .MuiLinearProgress-bar': { bgcolor: ACENTOS.verde.fondo },
          }}
        />
        <Typography variant="subtitle2">{progreso.porcentaje}%</Typography>
      </Stack>

      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2 }}>
        {progreso.hechas} / {progreso.total} actividades
      </Typography>

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
              <Typography variant="body2" sx={{ flex: '1 1 auto', minWidth: 0, lineHeight: 1.3 }}>
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

      <Button
        component={RouterLink}
        href={paths.dashboard.certificates}
        size="small"
        color="inherit"
        endIcon={<Iconify icon="solar:double-alt-arrow-right-bold-duotone" />}
        sx={{ mt: 2, alignSelf: 'flex-end' }}
      >
        Ver mi progreso
      </Button>
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
export function PrincipalHistorias({ historias, esEjemplo }) {
  const { AZUL } = useTonosDeMarca();

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Iconify icon="solar:gallery-wide-bold" width={20} sx={{ color: 'text.secondary' }} />
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Historias
        </Typography>
        {esEjemplo && <MarcaDeEjemplo sx={{ ml: 'auto' }} />}
      </Stack>

      <Box sx={{ overflowX: 'auto', pb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ width: 'max-content' }}>
          <Stack spacing={0.75} alignItems="center" sx={{ width: 72 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: AZUL.principal,
                bgcolor: AZUL.velo,
                border: (theme) => `dashed 2px ${theme.vars.palette.divider}`,
              }}
            >
              <Iconify icon="solar:add-circle-bold" width={22} />
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
              Tu historia
            </Typography>
          </Stack>

          {historias.map((historia) => (
            <Stack key={historia.clave} spacing={0.75} alignItems="center" sx={{ width: 72 }}>
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: 'background.neutral',
                  color: 'text.disabled',
                  border: (theme) => `solid 2px ${theme.vars.palette.divider}`,
                }}
              >
                {historia.titulo.charAt(0)}
              </Avatar>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', textAlign: 'center', lineHeight: 1.2 }}
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
