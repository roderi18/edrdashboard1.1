import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';

import { MarcaDeEjemplo } from './marca-de-ejemplo';
import { useTonosDeMarca } from './use-tonos-de-marca';
import { LapizDeImagen, fondoDeTarjeta, useImagenDeTarjeta } from './imagen-de-tarjeta';

// ----------------------------------------------------------------------
// LA BIENVENIDA: QUIEN ERES Y COMO VAS.
//
// Es lo primero que se ve al entrar, asi que lleva lo unico que no se puede
// buscar en ningun menu: tu nombre, donde sirves y cuanto llevas andado.
//
// El fondo es navy de marca y no una superficie del tema: en modo claro y en
// oscuro se ve igual, como el escudo. Por eso todo lo que va encima trae su
// color escrito —blanco, oro— en vez de heredarlo; sobre un fondo fijo, heredar
// del tema es justo lo que lo rompe al cambiar de modo.
// ----------------------------------------------------------------------

function Cifra({ icono, valor, etiqueta }) {
  const { NAVY } = useTonosDeMarca();

  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          flex: 'none',
          borderRadius: 1,
          display: 'grid',
          placeItems: 'center',
          color: '#FFFFFF',
          bgcolor: NAVY.abierto,
        }}
      >
        <Iconify icon={icono} width={18} />
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ color: '#FFFFFF', lineHeight: 1.2 }}>
          {valor}
        </Typography>
        <Typography variant="caption" sx={{ color: NAVY.texto }} noWrap>
          {etiqueta}
        </Typography>
      </Box>
    </Stack>
  );
}

// El banner de bienvenida lleva su propia imagen, distinta de la de la proxima
// actividad: son dos sitios y dos fotos.
const ID_DEL_BANNER = 'bienvenida';

export function PrincipalBienvenida({
  nombre,
  destacamento,
  region,
  foto,
  resumen,
  esEjemplo,
  puedeEditar = false,
}) {
  const { NAVY, ORO, AZUL } = useTonosDeMarca();
  // `foto` es la del MIEMBRO —su avatar—; esta es la del fondo del banner.
  const banner = useImagenDeTarjeta(ID_DEL_BANNER);
  const { subiendo, elegirFoto } = banner;
  // El fondo publicado desde EVEREST Designer, si lo hay, manda sobre el de
  // siempre. Sin el —el valor de fabrica— se usa el de siempre.
  const fondo = resumen.fondo ? resumen.fondo.url : banner.foto;

  const primerNombre =
    String(nombre || '')
      .trim()
      .split(' ')[0] || 'Explorador';
  const ubicacion = [destacamento, region].filter(Boolean).join(' · ');

  return (
    <Card
      sx={{
        p: { xs: 2.5, md: 3 },
        color: '#FFFFFF',
        position: 'relative',
        // Con foto, el velo se abre hacia la derecha; sin ella, el degradado de
        // marca de siempre —que va al reves, aclarandose, para dejar el texto
        // sobre la parte mas oscura—.
        ...(fondo
          ? fondoDeTarjeta({ foto: fondo, navy: NAVY, varAlpha })
          : {
              backgroundImage: `linear-gradient(100deg, ${NAVY.fondo} 0%, ${NAVY.claro} 62%, ${AZUL.oscuro} 100%)`,
            }),
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ top: 12, right: 12, position: 'absolute' }}
      >
        {esEjemplo && <MarcaDeEjemplo sobreOscuro />}

        {puedeEditar && (
          <LapizDeImagen tieneFoto={Boolean(fondo)} subiendo={subiendo} onElegir={elegirFoto} />
        )}
      </Stack>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 2.5, md: 3 }}
        alignItems={{ md: 'center' }}
        divider={
          <Divider
            orientation="vertical"
            flexItem
            sx={{ borderColor: NAVY.linea, display: { xs: 'none', md: 'block' } }}
          />
        }
      >
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          // SIN CRECER. Con `flex: 1 1 auto` este bloque se comia todo el ancho
          // sobrante y empujaba las cifras hasta el borde derecho, a medio metro
          // de la frase que las explica. Ahora ocupa lo que mide y las cifras se
          // quedan pegadas a el; el hueco sobrante va al final, que es donde no
          // molesta.
          sx={{ minWidth: 0, flex: '0 1 auto' }}
        >
          <Avatar
            src={foto}
            alt={nombre}
            sx={{ width: 72, height: 72, flex: 'none', border: `solid 2px ${NAVY.linea}` }}
          />

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" sx={{ color: '#FFFFFF' }}>
              ¡Bienvenido, {primerNombre}!
            </Typography>

            {ubicacion && (
              <Typography variant="body2" sx={{ color: NAVY.texto, mt: 0.25 }}>
                {ubicacion}
              </Typography>
            )}

            <Typography
              variant="body2"
              sx={{ mt: 1, fontStyle: 'italic', color: 'rgba(255,255,255,.72)' }}
            >
              “{resumen.lema}”
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={{ xs: 2, md: 3 }}
          alignItems="center"
          sx={{ flexWrap: 'wrap', gap: 2 }}
        >
          {resumen.cifras.map((cifra) => (
            <Cifra
              key={cifra.clave}
              icono={cifra.icono}
              valor={cifra.valor}
              etiqueta={cifra.etiqueta}
            />
          ))}

          {/* EL NIVEL VA APARTE Y EN ORO. No es una cifra mas: es el sitio al que
              se llega, y el oro es el color con el que la organizacion marca lo
              que se gana. */}
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 168 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                flex: 'none',
                borderRadius: 1,
                display: 'grid',
                placeItems: 'center',
                color: ORO.principal,
                bgcolor: 'rgba(201, 162, 39, .16)',
              }}
            >
              <Iconify icon="solar:cup-star-bold" width={18} />
            </Box>

            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ color: '#FFFFFF', lineHeight: 1.2 }}>
                Nivel {resumen.nivel.numero}
              </Typography>
              <Typography variant="caption" sx={{ color: NAVY.texto }}>
                {resumen.nivel.nombre}
              </Typography>

              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={resumen.nivel.porcentaje}
                  sx={{
                    flex: '1 1 auto',
                    height: 6,
                    bgcolor: NAVY.abierto,
                    '& .MuiLinearProgress-bar': { bgcolor: ORO.claro },
                  }}
                />
                <Typography variant="caption" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                  {resumen.nivel.porcentaje}%
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

/**
 * Los cuatro accesos rapidos.
 *
 * Cada uno es un ENLACE de verdad —no un adorno—: llevan al calendario, a los
 * certificados y a los documentos. El de Capacitacion apunta a documentos
 * mientras esa pantalla no exista, que es lo mas cerca que hay hoy.
 */
export function PrincipalAccesos({ accesos }) {
  const { ACENTOS } = useTonosDeMarca();

  return (
    <Box
      sx={{
        gap: 2,
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
      }}
    >
      {accesos.map((acceso) => {
        const acento = ACENTOS[acceso.acento];

        return (
          <Card
            key={acceso.clave}
            component={RouterLink}
            href={acceso.href}
            sx={{
              p: 2,
              gap: 1.5,
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              bgcolor: acento.velo,
              boxShadow: 'none',
              border: `solid 1px ${acento.fondo}1F`,
              transition: (theme) => theme.transitions.create(['transform', 'box-shadow']),
              '&:hover': { transform: 'translateY(-2px)', boxShadow: (theme) => theme.shadows[8] },
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                flex: 'none',
                borderRadius: 1.25,
                display: 'grid',
                color: '#FFFFFF',
                placeItems: 'center',
                bgcolor: acento.fondo,
              }}
            >
              <Iconify icon={acceso.icono} width={22} />
            </Box>

            <Typography
              variant="subtitle2"
              sx={{ flex: '1 1 auto', color: acento.tinta, lineHeight: 1.25 }}
            >
              {acceso.titulo}
            </Typography>

            <Iconify
              icon="solar:double-alt-arrow-right-bold-duotone"
              width={18}
              sx={{ flex: 'none', color: acento.tinta, opacity: 0.72 }}
            />
          </Card>
        );
      })}
    </Box>
  );
}
