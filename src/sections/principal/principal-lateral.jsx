import { Fragment } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { eventosVigentes } from 'src/utils/everest/presentacion.mjs';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { MarcaDeEjemplo } from './marca-de-ejemplo';
import { LEMA_DE_FABRICA } from './fabrica-de-portada';
import { useTonosDeMarca } from './use-tonos-de-marca';
import { LapizDelDesigner } from './lapiz-del-designer';
import {
  seMuestra,
  colorDelDiseno,
  letraDelDiseno,
  radioDelDiseno,
  textoDelDiseno,
  valorDelDiseno,
  fondoDelDiseno,
} from './diseno-de-tarjeta';

// ----------------------------------------------------------------------
// LA COLUMNA DE LA DERECHA: LO QUE PASA ALREDEDOR.
//
// El centro es lo tuyo —tu actividad, tu progreso, tu muro—; esta columna es la
// organizacion. Va en tarjetas separadas y no en una sola lista porque son tres
// cosas distintas: lo que viene, a quien reconocen, y lo que manda la Direccion.
//
// `diseno` (EVEREST Designer) cambia colores, tamaños, textos fijos y que se
// enseña. Sin diseño publicado, cada pieza usa lo que llevaba escrito.
// ----------------------------------------------------------------------

function CabeceraDePanel({
  icono,
  titulo,
  enlace,
  textoEnlace,
  esEjemplo,
  diseno,
  idBloque,
  puedeEditar = false,
}) {
  const { ORO } = useTonosDeMarca();

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
      <Iconify
        icon={valorDelDiseno(diseno, 'iconoTitulo', icono)}
        width={20}
        sx={{ color: diseno?.colorAcento ?? ORO.principal, flex: 'none' }}
      />

      <Typography
        variant="subtitle2"
        sx={{
          flex: '1 1 auto',
          minWidth: 0,
          ...colorDelDiseno(diseno, 'colorTitulo'),
          ...letraDelDiseno(diseno, { tamano: 'tamanoTitulo', peso: 'pesoTitulo' }),
        }}
        noWrap
      >
        {textoDelDiseno(diseno, 'titulo', titulo)}
      </Typography>

      {esEjemplo && <MarcaDeEjemplo />}

      {enlace && seMuestra(diseno, 'mostrarEnlace') && (
        <Button
          component={RouterLink}
          href={valorDelDiseno(diseno, 'destinoEnlace', enlace)}
          size="small"
          color="inherit"
          sx={{ flex: 'none', px: 0.75, ...colorDelDiseno(diseno, 'colorAcento') }}
          endIcon={<Iconify icon="solar:double-alt-arrow-right-bold-duotone" width={16} />}
        >
          {textoDelDiseno(diseno, 'textoEnlace', textoEnlace)}
        </Button>
      )}

      {puedeEditar && <LapizDelDesigner idBloque={idBloque} sx={{ flex: 'none' }} />}
    </Stack>
  );
}

/** El marco de cada tarjeta de la columna: fondo y esquinas del diseño, si los hay. */
const marcoDeTarjeta = (diseno) => ({ ...fondoDelDiseno(diseno), ...radioDelDiseno(diseno) });

// ----------------------------------------------------------------------

export function PrincipalEventos({ eventos, diseno, esEjemplo, puedeEditar = false }) {
  return (
    <Card data-everest-bloque="proximos-eventos" sx={{ p: 2.5, ...marcoDeTarjeta(diseno) }}>
      <CabeceraDePanel
        icono="solar:cup-star-bold"
        titulo="Próximos eventos"
        enlace={paths.dashboard.calendar}
        textoEnlace="Ver calendario"
        esEjemplo={esEjemplo}
        diseno={diseno}
        idBloque="proximos-eventos"
        puedeEditar={puedeEditar}
      />

      <Stack divider={<Divider sx={{ my: 1.5 }} />}>
        {/* Los que ya pasaron se dejan de enseñar solos, si traen fecha. */}
        {eventosVigentes(eventos).map((evento) => (
          <Stack key={evento.clave} direction="row" spacing={1.5} alignItems="flex-start">
            {/* EL DIA Y EL MES, COMO UNA HOJA DE CALENDARIO. Se busca por fecha
                antes que por nombre: quien mira esto quiere saber cuando, no que. */}
            <Box
              sx={{
                py: 0.75,
                width: 46,
                flex: 'none',
                borderRadius: 1,
                textAlign: 'center',
                bgcolor: diseno?.colorFecha ?? 'background.neutral',
              }}
            >
              <Typography
                variant="h6"
                sx={{ lineHeight: 1.1, ...colorDelDiseno(diseno, 'colorTitulo') }}
              >
                {evento.dia}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: diseno?.colorTexto ?? 'text.secondary', letterSpacing: '.06em' }}
              >
                {evento.mes}
              </Typography>
            </Box>

            <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
              <Typography
                variant="subtitle2"
                sx={{
                  lineHeight: 1.3,
                  ...colorDelDiseno(diseno, 'colorTitulo'),
                  ...letraDelDiseno(diseno, { tamano: 'tamanoTexto' }),
                }}
              >
                {evento.titulo}
              </Typography>

              {seMuestra(diseno, 'mostrarLugar') && (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                  <Iconify
                    icon="solar:flag-bold"
                    width={13}
                    sx={{ color: diseno?.colorAcento ?? 'text.disabled', flex: 'none' }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ color: diseno?.colorTexto ?? 'text.secondary' }}
                    noWrap
                  >
                    {evento.lugar}
                  </Typography>
                </Stack>
              )}

              {seMuestra(diseno, 'mostrarEstado') && (
                <Label variant="soft" color={evento.color} sx={{ mt: 0.75 }}>
                  {evento.estado}
                </Label>
              )}
            </Box>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function PrincipalDestacado({ destacado, diseno, esEjemplo, puedeEditar = false }) {
  const { NAVY, ORO, AZUL } = useTonosDeMarca();

  return (
    <Card
      data-everest-bloque="destacamento-destacado"
      sx={{
        p: 2.5,
        border: (theme) => `solid 1px ${theme.vars.palette.warning.light}3D`,
        ...marcoDeTarjeta(diseno),
      }}
    >
      <CabeceraDePanel
        icono="solar:medal-ribbon-star-bold"
        titulo="Destacamento destacado de la semana"
        esEjemplo={esEjemplo}
        diseno={diseno}
        idBloque="destacamento-destacado"
        puedeEditar={puedeEditar}
      />

      <Box
        sx={{
          p: 2,
          borderRadius: 1.5,
          color: '#FFFFFF',
          backgroundImage: `linear-gradient(140deg, ${NAVY.claro} 0%, ${NAVY.fondo} 100%)`,
          ...fondoDelDiseno(diseno, { campo: 'colorCaja', campo2: 'colorCaja2' }),
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            color: '#FFFFFF',
            ...letraDelDiseno(diseno, { tamano: 'tamanoTexto' }),
          }}
        >
          {destacado.nombre}
        </Typography>

        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.75 }}
        >
          <Typography variant="caption" sx={{ color: diseno?.colorTexto ?? NAVY.texto }}>
            {destacado.region}
          </Typography>
          <Typography variant="caption" sx={{ color: diseno?.colorTexto ?? NAVY.texto }}>
            · {destacado.miembros} {textoDelDiseno(diseno, 'textoMiembros', 'miembros')}
          </Typography>

          {seMuestra(diseno, 'mostrarValoracion') && (
            <Stack direction="row" spacing={0.25} alignItems="center">
              <Iconify
                icon="solar:cup-star-bold"
                width={14}
                sx={{ color: diseno?.colorAcento ?? ORO.claro }}
              />
              <Typography
                variant="caption"
                sx={{ color: diseno?.colorAcento ?? ORO.claro, fontWeight: 600 }}
              >
                {destacado.valoracion}
              </Typography>
            </Stack>
          )}
        </Stack>

        {seMuestra(diseno, 'mostrarBoton') && (
          <Button
            component={RouterLink}
            href={valorDelDiseno(diseno, 'destinoBoton', paths.dashboard.level.dest.root)}
            size="small"
            variant="contained"
            sx={{
              mt: 2,
              bgcolor: diseno?.colorBoton ?? AZUL.principal,
              '&:hover': { bgcolor: diseno?.colorBoton ?? AZUL.encima },
            }}
            endIcon={<Iconify icon="solar:double-alt-arrow-right-bold-duotone" />}
          >
            {textoDelDiseno(diseno, 'textoBoton', 'Ver historia')}
          </Button>
        )}
      </Box>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function PrincipalComunicados({ comunicados, diseno, esEjemplo, puedeEditar = false }) {
  const { AZUL } = useTonosDeMarca();

  return (
    <Card data-everest-bloque="comunicados" sx={{ p: 2.5, ...marcoDeTarjeta(diseno) }}>
      <CabeceraDePanel
        icono="solar:bell-bing-bold"
        titulo="Comunicados oficiales"
        enlace={paths.dashboard.fileManager}
        textoEnlace="Ver todos"
        esEjemplo={esEjemplo}
        diseno={diseno}
        idBloque="comunicados"
        puedeEditar={puedeEditar}
      />

      <Stack spacing={1.5}>
        {comunicados.map((comunicado) => (
          <Stack key={comunicado.clave} direction="row" spacing={1.5} alignItems="flex-start">
            <Box
              sx={{
                width: 36,
                height: 36,
                flex: 'none',
                borderRadius: 1,
                display: 'grid',
                placeItems: 'center',
                color: diseno?.colorAcento ?? AZUL.principal,
                bgcolor: AZUL.velo,
              }}
            >
              <Iconify
                icon={valorDelDiseno(diseno, 'iconoElemento', 'solar:file-text-bold')}
                width={18}
              />
            </Box>

            <Box sx={{ minWidth: 0 }}>
              {seMuestra(diseno, 'mostrarOrigen') && (
                <Typography
                  variant="caption"
                  sx={{ color: diseno?.colorTexto ?? 'text.secondary' }}
                >
                  {comunicado.origen}
                </Typography>
              )}
              <Typography
                variant="subtitle2"
                sx={{
                  lineHeight: 1.3,
                  ...colorDelDiseno(diseno, 'colorTitulo'),
                  ...letraDelDiseno(diseno, { tamano: 'tamanoTexto' }),
                }}
              >
                {comunicado.titulo}
              </Typography>
              {seMuestra(diseno, 'mostrarFecha') && (
                <Typography variant="caption" sx={{ color: diseno?.colorTexto ?? 'text.disabled' }}>
                  {comunicado.fecha}
                </Typography>
              )}
            </Box>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

/**
 * El cierre de la columna. Es el lema, no un anuncio: no lleva boton.
 *
 * Sus textos llegan de fuera —de lo publicado en EVEREST Designer o, si no hay
 * nada, de `LEMA_DE_FABRICA`— en lugar de ir escritos aqui. El salto de linea del
 * titulo se guarda como `\n` y se pinta con el mismo `<br />` de siempre.
 */
export function PrincipalLema({ lema = LEMA_DE_FABRICA, diseno, puedeEditar = false }) {
  const { NAVY, ORO, AZUL } = useTonosDeMarca();
  const lineasDelTitulo = String(lema?.titulo ?? '').split('\n');

  return (
    <Card
      data-everest-bloque="lema"
      sx={{
        p: 3,
        color: '#FFFFFF',
        textAlign: diseno?.alineacion ?? 'left',
        position: 'relative',
        backgroundImage: `linear-gradient(140deg, ${NAVY.fondo} 0%, ${AZUL.oscuro} 100%)`,
        ...marcoDeTarjeta(diseno),
      }}
    >
      {puedeEditar && (
        <LapizDelDesigner
          idBloque="lema"
          sobreOscuro
          sx={{ top: 12, right: 12, position: 'absolute' }}
        />
      )}

      {seMuestra(diseno, 'mostrarIcono') && (
        <Iconify
          icon={valorDelDiseno(diseno, 'icono', 'solar:shield-check-bold')}
          width={28}
          sx={{ color: diseno?.colorAcento ?? ORO.claro, mb: 1 }}
        />
      )}

      <Typography
        variant="h6"
        sx={{
          color: diseno?.colorTitulo ?? '#FFFFFF',
          lineHeight: 1.35,
          ...letraDelDiseno(diseno, { tamano: 'tamanoTitulo', peso: 'pesoTitulo' }),
        }}
      >
        {lineasDelTitulo.map((linea, indice) => (
          <Fragment key={indice}>
            {indice > 0 && <br />}
            {linea}
          </Fragment>
        ))}
      </Typography>

      {!!lema?.pie && (
        <Typography
          variant="caption"
          sx={{
            color: diseno?.colorTexto ?? NAVY.texto,
            mt: 1,
            display: 'block',
            ...letraDelDiseno(diseno, { tamano: 'tamanoTexto' }),
          }}
        >
          {lema.pie}
        </Typography>
      )}
    </Card>
  );
}
