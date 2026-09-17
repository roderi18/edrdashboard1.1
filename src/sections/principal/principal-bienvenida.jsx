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
import { LapizDelDesigner } from './lapiz-del-designer';
import { fondoDeTarjeta, useImagenDeTarjeta } from './imagen-de-tarjeta';
import {
  seMuestra,
  conNombre,
  navyDelDiseno,
  letraDelDiseno,
  radioDelDiseno,
  textoDelDiseno,
  fondoDelDiseno,
} from './diseno-de-tarjeta';

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
//
// `diseno` (EVEREST Designer) cambia colores, tamaños, textos fijos y que se
// enseña. Sin diseño publicado, cada pieza usa lo que llevaba escrito.
// ----------------------------------------------------------------------

function Cifra({ icono, valor, etiqueta, diseno }) {
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
          color: diseno?.colorAcento ?? '#FFFFFF',
          bgcolor: NAVY.abierto,
        }}
      >
        <Iconify icon={icono} width={18} />
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ color: diseno?.colorTitulo ?? '#FFFFFF', lineHeight: 1.2 }}>
          {valor}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: diseno?.colorTexto ?? NAVY.texto,
            ...letraDelDiseno(diseno, { tamano: 'tamanoTexto' }),
          }}
          noWrap
        >
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
  diseno,
  esEjemplo,
  puedeEditar = false,
}) {
  const tonos = useTonosDeMarca();
  const { ORO, AZUL } = tonos;
  // Con un fondo elegido en el Designer, el velo de la foto toma ese color.
  const NAVY = navyDelDiseno(tonos.NAVY, diseno);
  // `foto` es la del MIEMBRO —su avatar—; esta es la del fondo del banner.
  const banner = useImagenDeTarjeta(ID_DEL_BANNER);
  // El fondo publicado desde EVEREST Designer, si lo hay, manda sobre el de
  // siempre. Sin el —el valor de fabrica— se usa el de siempre.
  const fondo = resumen.fondo ? resumen.fondo.url : banner.foto;

  const primerNombre =
    String(nombre || '')
      .trim()
      .split(' ')[0] || 'Explorador';
  const ubicacion = seMuestra(diseno, 'mostrarUbicacion')
    ? [destacamento, region].filter(Boolean).join(' · ')
    : '';
  const lema = seMuestra(diseno, 'mostrarLema') ? resumen.lema : '';
  const conCifras = seMuestra(diseno, 'mostrarCifras');
  const conNivel = seMuestra(diseno, 'mostrarNivel');

  return (
    <Card
      data-everest-bloque="bienvenida"
      sx={{
        p: { xs: 2.5, md: 3 },
        color: '#FFFFFF',
        position: 'relative',
        // Con foto, el velo se abre hacia la derecha; sin ella, el degradado de
        // marca de siempre —que va al reves, aclarandose, para dejar el texto
        // sobre la parte mas oscura—, o el fondo elegido en el Designer.
        ...(fondo
          ? fondoDeTarjeta({ foto: fondo, navy: NAVY, varAlpha })
          : diseno?.colorFondo || diseno?.colorFondo2
            ? fondoDelDiseno(diseno, { angulo: 100 })
            : {
                backgroundImage: `linear-gradient(100deg, ${NAVY.fondo} 0%, ${NAVY.claro} 62%, ${AZUL.oscuro} 100%)`,
              }),
        ...radioDelDiseno(diseno),
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ top: 12, right: 12, position: 'absolute' }}
      >
        {esEjemplo && <MarcaDeEjemplo sobreOscuro />}

        {puedeEditar && <LapizDelDesigner idBloque="bienvenida" sobreOscuro />}
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
          {seMuestra(diseno, 'mostrarFoto') && (
            <Avatar
              src={foto}
              alt={nombre}
              sx={{ width: 72, height: 72, flex: 'none', border: `solid 2px ${NAVY.linea}` }}
            />
          )}

          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h5"
              sx={{
                color: diseno?.colorTitulo ?? '#FFFFFF',
                ...letraDelDiseno(diseno, { tamano: 'tamanoTitulo', peso: 'pesoTitulo' }),
              }}
            >
              {conNombre(textoDelDiseno(diseno, 'saludo', '¡Bienvenido, {nombre}!'), primerNombre)}
            </Typography>

            {ubicacion && (
              <Typography
                variant="body2"
                sx={{
                  color: diseno?.colorTexto ?? NAVY.texto,
                  mt: 0.25,
                  ...letraDelDiseno(diseno, { tamano: 'tamanoTexto' }),
                }}
              >
                {ubicacion}
              </Typography>
            )}

            {lema && (
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  fontStyle: 'italic',
                  color: diseno?.colorLema ?? 'rgba(255,255,255,.72)',
                  ...letraDelDiseno(diseno, { tamano: 'tamanoTexto' }),
                }}
              >
                “{lema}”
              </Typography>
            )}
          </Box>
        </Stack>

        {(conCifras || conNivel) && (
          <Stack
            direction="row"
            spacing={{ xs: 2, md: 3 }}
            alignItems="center"
            sx={{ flexWrap: 'wrap', gap: 2 }}
          >
            {conCifras &&
              resumen.cifras.map((cifra) => (
                <Cifra
                  key={cifra.clave}
                  icono={cifra.icono}
                  valor={cifra.valor}
                  etiqueta={cifra.etiqueta}
                  diseno={diseno}
                />
              ))}

            {/* EL NIVEL VA APARTE Y EN ORO. No es una cifra mas: es el sitio al que
                se llega, y el oro es el color con el que la organizacion marca lo
                que se gana. */}
            {conNivel && (
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 168 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    flex: 'none',
                    borderRadius: 1,
                    display: 'grid',
                    placeItems: 'center',
                    color: diseno?.colorAcento ?? ORO.principal,
                    bgcolor: 'rgba(201, 162, 39, .16)',
                  }}
                >
                  <Iconify icon="solar:cup-star-bold" width={18} />
                </Box>

                <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: diseno?.colorTitulo ?? '#FFFFFF', lineHeight: 1.2 }}
                  >
                    {textoDelDiseno(diseno, 'textoNivel', 'Nivel')} {resumen.nivel.numero}
                  </Typography>
                  <Typography variant="caption" sx={{ color: diseno?.colorTexto ?? NAVY.texto }}>
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
                        '& .MuiLinearProgress-bar': { bgcolor: diseno?.colorBarra ?? ORO.claro },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: diseno?.colorTitulo ?? '#FFFFFF', fontWeight: 600 }}
                    >
                      {resumen.nivel.porcentaje}%
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            )}
          </Stack>
        )}
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
 *
 * Con diseño, los colores elegidos mandan sobre el acento de cada uno, y se puede
 * cambiar el numero de columnas en escritorio.
 */
export function PrincipalAccesos({ accesos, diseno, puedeEditar = false }) {
  const { ACENTOS } = useTonosDeMarca();
  const columnas = diseno?.columnas ? Number(diseno.columnas) : 4;

  return (
    <Box data-everest-bloque="accesos-rapidos" sx={{ position: 'relative' }}>
      {/* El lapiz, flotando sobre la esquina: una fila propia moveria los accesos
          hacia abajo, y solo lo ve el Administrador Global. */}
      {puedeEditar && (
        <LapizDelDesigner
          idBloque="accesos-rapidos"
          sx={{
            top: -14,
            right: -8,
            zIndex: 2,
            position: 'absolute',
            bgcolor: 'background.paper',
            boxShadow: 2,
          }}
        />
      )}

      <Box
        sx={{
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: `repeat(${columnas}, 1fr)` },
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
                bgcolor: diseno?.colorFondo ?? acento.velo,
                boxShadow: 'none',
                border: `solid 1px ${acento.fondo}1F`,
                transition: (theme) => theme.transitions.create(['transform', 'box-shadow']),
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: (theme) => theme.shadows[8],
                },
                ...radioDelDiseno(diseno),
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  flex: 'none',
                  borderRadius: 1.25,
                  display: 'grid',
                  color: diseno?.colorIcono ?? '#FFFFFF',
                  placeItems: 'center',
                  bgcolor: diseno?.colorAcento ?? acento.fondo,
                }}
              >
                <Iconify icon={acceso.icono} width={22} />
              </Box>

              <Typography
                variant="subtitle2"
                sx={{
                  flex: '1 1 auto',
                  color: diseno?.colorTitulo ?? acento.tinta,
                  lineHeight: 1.25,
                  ...letraDelDiseno(diseno, { tamano: 'tamanoTitulo', peso: 'pesoTitulo' }),
                }}
              >
                {acceso.titulo}
              </Typography>

              {seMuestra(diseno, 'mostrarFlecha') && (
                <Iconify
                  icon="solar:double-alt-arrow-right-bold-duotone"
                  width={18}
                  sx={{ flex: 'none', color: diseno?.colorTitulo ?? acento.tinta, opacity: 0.72 }}
                />
              )}
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
