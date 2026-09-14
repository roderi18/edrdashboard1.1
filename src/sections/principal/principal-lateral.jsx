import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { MarcaDeEjemplo } from './marca-de-ejemplo';
import { useTonosDeMarca } from './use-tonos-de-marca';

// ----------------------------------------------------------------------
// LA COLUMNA DE LA DERECHA: LO QUE PASA ALREDEDOR.
//
// El centro es lo tuyo —tu actividad, tu progreso, tu muro—; esta columna es la
// organizacion. Va en tarjetas separadas y no en una sola lista porque son tres
// cosas distintas: lo que viene, a quien reconocen, y lo que manda la Direccion.
// ----------------------------------------------------------------------

function CabeceraDePanel({ icono, titulo, enlace, textoEnlace, esEjemplo }) {
  const { ORO } = useTonosDeMarca();

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
      <Iconify icon={icono} width={20} sx={{ color: ORO.principal, flex: 'none' }} />

      <Typography variant="subtitle2" sx={{ flex: '1 1 auto', minWidth: 0 }} noWrap>
        {titulo}
      </Typography>

      {esEjemplo && <MarcaDeEjemplo />}

      {enlace && (
        <Button
          component={RouterLink}
          href={enlace}
          size="small"
          color="inherit"
          sx={{ flex: 'none', px: 0.75 }}
          endIcon={<Iconify icon="solar:double-alt-arrow-right-bold-duotone" width={16} />}
        >
          {textoEnlace}
        </Button>
      )}
    </Stack>
  );
}

// ----------------------------------------------------------------------

export function PrincipalEventos({ eventos, esEjemplo }) {
  return (
    <Card sx={{ p: 2.5 }}>
      <CabeceraDePanel
        icono="solar:cup-star-bold"
        titulo="Próximos eventos"
        enlace={paths.dashboard.calendar}
        textoEnlace="Ver calendario"
        esEjemplo={esEjemplo}
      />

      <Stack divider={<Divider sx={{ my: 1.5 }} />}>
        {eventos.map((evento) => (
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
                bgcolor: 'background.neutral',
              }}
            >
              <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                {evento.dia}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', letterSpacing: '.06em' }}
              >
                {evento.mes}
              </Typography>
            </Box>

            <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
              <Typography variant="subtitle2" sx={{ lineHeight: 1.3 }}>
                {evento.titulo}
              </Typography>

              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                <Iconify
                  icon="solar:flag-bold"
                  width={13}
                  sx={{ color: 'text.disabled', flex: 'none' }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                  {evento.lugar}
                </Typography>
              </Stack>

              <Label variant="soft" color={evento.color} sx={{ mt: 0.75 }}>
                {evento.estado}
              </Label>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function PrincipalDestacado({ destacado, esEjemplo }) {
  const { NAVY, ORO, AZUL } = useTonosDeMarca();

  return (
    <Card sx={{ p: 2.5, border: (theme) => `solid 1px ${theme.vars.palette.warning.light}3D` }}>
      <CabeceraDePanel
        icono="solar:medal-ribbon-star-bold"
        titulo="Destacamento destacado de la semana"
        esEjemplo={esEjemplo}
      />

      <Box
        sx={{
          p: 2,
          borderRadius: 1.5,
          color: '#FFFFFF',
          backgroundImage: `linear-gradient(140deg, ${NAVY.claro} 0%, ${NAVY.fondo} 100%)`,
        }}
      >
        <Typography variant="subtitle1" sx={{ color: '#FFFFFF' }}>
          {destacado.nombre}
        </Typography>

        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.75 }}
        >
          <Typography variant="caption" sx={{ color: NAVY.texto }}>
            {destacado.region}
          </Typography>
          <Typography variant="caption" sx={{ color: NAVY.texto }}>
            · {destacado.miembros} miembros
          </Typography>

          <Stack direction="row" spacing={0.25} alignItems="center">
            <Iconify icon="solar:cup-star-bold" width={14} sx={{ color: ORO.claro }} />
            <Typography variant="caption" sx={{ color: ORO.claro, fontWeight: 600 }}>
              {destacado.valoracion}
            </Typography>
          </Stack>
        </Stack>

        <Button
          component={RouterLink}
          href={paths.dashboard.level.dest.root}
          size="small"
          variant="contained"
          sx={{ mt: 2, bgcolor: AZUL.principal, '&:hover': { bgcolor: AZUL.encima } }}
          endIcon={<Iconify icon="solar:double-alt-arrow-right-bold-duotone" />}
        >
          Ver historia
        </Button>
      </Box>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function PrincipalComunicados({ comunicados, esEjemplo }) {
  const { AZUL } = useTonosDeMarca();

  return (
    <Card sx={{ p: 2.5 }}>
      <CabeceraDePanel
        icono="solar:bell-bing-bold"
        titulo="Comunicados oficiales"
        enlace={paths.dashboard.fileManager}
        textoEnlace="Ver todos"
        esEjemplo={esEjemplo}
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
                color: AZUL.principal,
                bgcolor: AZUL.velo,
              }}
            >
              <Iconify icon="solar:file-text-bold" width={18} />
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {comunicado.origen}
              </Typography>
              <Typography variant="subtitle2" sx={{ lineHeight: 1.3 }}>
                {comunicado.titulo}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {comunicado.fecha}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

/** El cierre de la columna. Es el lema, no un anuncio: no lleva boton. */
export function PrincipalLema() {
  const { NAVY, ORO, AZUL } = useTonosDeMarca();

  return (
    <Card
      sx={{
        p: 3,
        color: '#FFFFFF',
        textAlign: 'left',
        backgroundImage: `linear-gradient(140deg, ${NAVY.fondo} 0%, ${AZUL.oscuro} 100%)`,
      }}
    >
      <Iconify icon="solar:shield-check-bold" width={28} sx={{ color: ORO.claro, mb: 1 }} />

      <Typography variant="h6" sx={{ color: '#FFFFFF', lineHeight: 1.35 }}>
        Más que una organización,
        <br />
        una familia.
      </Typography>

      <Typography variant="caption" sx={{ color: NAVY.texto, mt: 1, display: 'block' }}>
        Servir · Liderar · Transformar
      </Typography>
    </Card>
  );
}
