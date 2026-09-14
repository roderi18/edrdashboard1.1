'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LA PALETA QUE ESTA PUESTA.
//
// Nacio como banco de pruebas —para ver a que quedaria el panel con el azul antes
// de decidirlo— y esa decision ya se tomo: la paleta vive en
// `src/theme/theme-config.js` y esta pantalla la LEE del tema, no la propone.
//
// Sirve para tres cosas concretas:
//
//   - Ver las once familias con sus cinco paradas y el contraste de cada tono.
//   - Probar un cambio ANTES de escribirlo: se toca una muestra y toda la pagina
//     de abajo —los componentes de prueba— se repinta al momento. Eso no toca el
//     tema; es un ensayo que vive en este navegador.
//   - Copiar el bloque listo para pegar en `theme-config.js` cuando el ensayo
//     convence.
//
// "Restaurar" vuelve a lo que dice el tema ahora mismo.
// ----------------------------------------------------------------------

const CLAVE_GUARDADO = 'paleta-er-v1';

const PARADAS = ['lighter', 'light', 'main', 'dark', 'darker'];

// Metadatos de cada familia: a que grupo pertenece y para que sirve. Los COLORES
// no estan aqui —salen del tema, ver `desdeElTema`—: escribirlos dos veces era
// garantizar que un dia dijeran cosas distintas.
const FAMILIAS = {
  primary: { grupo: 'marca', rol: 'Acento principal · botones, enlaces, estado activo' },
  secondary: { grupo: 'marca', rol: 'Acompaña · formación, capacitación' },
  navy: { grupo: 'marca', rol: 'Marca · barra lateral, portada, cabecera' },
  oro: { grupo: 'marca', rol: 'Marca · escudo, nivel, detalle institucional' },
  info: { grupo: 'semantico', rol: 'Dato · avisos neutros' },
  success: { grupo: 'semantico', rol: 'Correcto · completado, registrado' },
  warning: { grupo: 'semantico', rol: 'Atención · pendiente, por confirmar' },
  error: { grupo: 'semantico', rol: 'Error · rechazado, eliminar' },
  grey: { grupo: 'neutro', rol: 'Texto, bordes, superficies · sesgo azul' },
  fondoClaro: { grupo: 'neutro', rol: 'background en modo claro' },
  fondoOscuro: { grupo: 'neutro', rol: 'background en modo oscuro' },
};

/** Las familias del catalogo que son una rampa normal de cinco paradas. */
const FAMILIAS_DEL_TEMA = ['primary', 'secondary', 'info', 'success', 'warning', 'error'];

/**
 * La paleta tal y como esta puesta AHORA.
 *
 * Se lee de `theme.vars.palette`, que es lo que la aplicacion usa de verdad: si
 * alguien cambia `theme-config.js` o elige otro preset en el engranaje, esta
 * pantalla lo refleja sin tocarla.
 *
 * Los fondos se sacan de los dos esquemas de color —claro y oscuro— porque un
 * fondo no existe fuera de su modo: preguntarle al tema "cual es el papel" solo
 * tiene respuesta si se dice en cual de los dos.
 */
const desdeElTema = (theme) => {
  const { palette } = theme.vars;
  const claro = theme.colorSchemes?.light?.palette ?? palette;
  const oscuro = theme.colorSchemes?.dark?.palette ?? palette;
  const rampa = (familia) => ({
    lighter: familia.lighter,
    light: familia.light,
    main: familia.main,
    dark: familia.dark,
    darker: familia.darker,
  });

  const paletaViva = {};

  FAMILIAS_DEL_TEMA.forEach((nombre) => {
    paletaViva[nombre] = { ...FAMILIAS[nombre], paradas: rampa(palette[nombre]) };
  });

  paletaViva.navy = {
    ...FAMILIAS.navy,
    paradas: {
      lighter: palette.brand.navyLighter,
      light: palette.brand.navyLight,
      main: palette.brand.navy,
      dark: palette.brand.navyDark,
      darker: palette.brand.navyDarker,
    },
  };

  paletaViva.oro = {
    ...FAMILIAS.oro,
    paradas: {
      lighter: palette.brand.oroLighter,
      light: palette.brand.oroLight,
      main: palette.brand.oro,
      dark: palette.brand.oroDark,
      darker: palette.brand.oroDarker,
    },
  };

  paletaViva.grey = {
    ...FAMILIAS.grey,
    paradas: {
      100: palette.grey[100],
      300: palette.grey[300],
      500: palette.grey[500],
      700: palette.grey[700],
      900: palette.grey[900],
    },
  };

  // Tres paradas y no cinco: son los tres fondos que el tema define de verdad.
  // Rellenar hasta cinco habria sido inventarse dos.
  paletaViva.fondoClaro = {
    ...FAMILIAS.fondoClaro,
    paradas: {
      paper: claro.background.paper,
      default: claro.background.default,
      neutral: claro.background.neutral,
    },
  };

  paletaViva.fondoOscuro = {
    ...FAMILIAS.fondoOscuro,
    paradas: {
      paper: oscuro.background.paper,
      default: oscuro.background.default,
      neutral: oscuro.background.neutral,
    },
  };

  return paletaViva;
};

const GRUPOS = [
  {
    id: 'marca',
    titulo: 'Marca',
    nota:
      'El azul manda y el morado acompaña. El navy y el oro del escudo van aparte, fuera de las seis ' +
      'familias semánticas: son mobiliario de marca —barra lateral, portada, escudo—, no estados que ' +
      'el color tenga que distinguir.',
  },
  {
    id: 'semantico',
    titulo: 'Semánticos',
    nota:
      'Estos cuatro dicen algo: correcto, atención, error, dato. No son decoración y no se reparten ' +
      'por gusto. Van separados del acento a propósito.',
  },
  {
    id: 'neutro',
    titulo: 'Neutros y fondos',
    nota:
      'El gris lleva un sesgo azul leve para que se asiente con el primario; un gris puro al lado del ' +
      'azul se ve sucio. Los fondos oscuros son navy, no gris neutro: es lo que ya hace la barra lateral.',
  },
];

// ----------------------------------------------------------------------
// Contraste. `contrastText` es un campo del tema que MUI se cree sin comprobar:
// si se declara mal, quedan botones ilegibles y nada avisa.
// ----------------------------------------------------------------------

const aCanales = (hex) => {
  const limpio = String(hex || '').replace('#', '');

  return [0, 2, 4].map((inicio) => parseInt(limpio.slice(inicio, inicio + 2), 16) || 0);
};

const luminancia = (hex) => {
  const [r, g, b] = aCanales(hex).map((valor) => {
    const canal = valor / 255;

    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const razonDeContraste = (unColor, otroColor) => {
  const a = luminancia(unColor);
  const b = luminancia(otroColor);

  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** El texto que hay que declarar encima de ese tono. */
const textoSobre = (hex) =>
  razonDeContraste(hex, '#FFFFFF') >= razonDeContraste(hex, '#1C252E') ? '#FFFFFF' : '#1C252E';

// ----------------------------------------------------------------------

function RampaDeColor({ familia, datos, onCambiar, onCopiar }) {
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2">{familia}</Typography>

        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {datos.rol}
        </Typography>
      </Stack>

      {/* Tantas columnas como paradas tenga: los fondos son tres, no cinco. */}
      <Box
        sx={{
          gap: 1,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: `repeat(${Object.keys(datos.paradas).length}, 1fr)`,
          },
        }}
      >
        {Object.entries(datos.paradas).map(([parada, valor]) => {
          const encima = textoSobre(valor);

          return (
            <Stack key={parada} spacing={0.75} sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  height: 64,
                  borderRadius: 1,
                  display: 'grid',
                  position: 'relative',
                  placeItems: 'center',
                  bgcolor: valor,
                  border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
                }}
              >
                <Typography variant="caption" sx={{ color: encima, fontWeight: 700 }}>
                  AA {razonDeContraste(valor, encima).toFixed(1)}
                </Typography>

                {/* El selector nativo va encima e invisible: se pulsa la muestra
                    entera, que es el objetivo grande y obvio. */}
                <Box
                  component="input"
                  type="color"
                  value={valor}
                  aria-label={`${familia} ${parada}`}
                  onChange={(event) => onCambiar(familia, parada, event.target.value.toUpperCase())}
                  sx={{
                    top: 0,
                    left: 0,
                    width: 1,
                    height: 1,
                    opacity: 0,
                    border: 'none',
                    cursor: 'pointer',
                    position: 'absolute',
                  }}
                />
              </Box>

              <Stack direction="row" alignItems="baseline" spacing={0.5}>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {parada}
                </Typography>

                <Tooltip title="Copiar">
                  <Box
                    component="button"
                    type="button"
                    onClick={() => onCopiar(valor, `Copiado ${valor}`)}
                    sx={{
                      p: 0,
                      ml: 'auto',
                      border: 'none',
                      bgcolor: 'transparent',
                      cursor: 'pointer',
                      color: 'text.primary',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                    }}
                  >
                    {valor}
                  </Box>
                </Tooltip>
              </Stack>
            </Stack>
          );
        })}
      </Box>
    </Card>
  );
}

// ----------------------------------------------------------------------

/**
 * Los mismos componentes con la misma paleta, en los dos fondos.
 *
 * Se enseñan los dos A LA VEZ y no con un interruptor: el fallo de una paleta
 * casi nunca esta en un tono suelto, esta en que un tono funciona sobre un fondo
 * y se apaga en el otro, y con un interruptor eso no se ve —hay que acordarse de
 * como era el anterior—.
 */
function LienzoDePrueba({ paleta, claro }) {
  const fondo = claro ? paleta.fondoClaro.paradas : paleta.fondoOscuro.paradas;
  const superficie = claro ? fondo.lighter : fondo.light;
  const linea = claro ? fondo.dark : fondo.darker;
  const tinta = claro ? paleta.grey.paradas.darker : '#EAF1FA';
  const suave = claro ? paleta.grey.paradas.dark : paleta.grey.paradas.main;

  // En oscuro el tono que se lee es el claro de la familia; en claro, el oscuro.
  const tono = (familia) => (claro ? familia.dark : familia.light);
  const velo = (familia) => (claro ? familia.lighter : familia.darker);

  const acceso = (nombre, familia) => (
    <Stack
      key={nombre}
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ p: 1.25, borderRadius: 1.25, bgcolor: velo(familia), color: tono(familia) }}
    >
      <Box sx={{ width: 28, height: 28, flex: 'none', borderRadius: 1, bgcolor: familia.main }} />
      <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
        {nombre}
      </Typography>
    </Stack>
  );

  const etiqueta = (texto, familia) => (
    <Box
      key={texto}
      sx={{
        px: 1,
        py: 0.25,
        borderRadius: 0.75,
        typography: 'caption',
        fontWeight: 600,
        bgcolor: velo(familia),
        color: tono(familia),
      }}
    >
      {texto}
    </Box>
  );

  const boton = (texto, relleno, borde) => (
    <Box
      key={texto}
      sx={{
        px: 1.75,
        py: 0.75,
        borderRadius: 1,
        typography: 'caption',
        fontWeight: 600,
        ...(relleno
          ? { bgcolor: relleno, color: textoSobre(relleno) }
          : { border: `solid 1px ${borde}`, color: tinta }),
      }}
    >
      {texto}
    </Box>
  );

  return (
    <Card variant="outlined" sx={{ p: 2, bgcolor: superficie, borderColor: linea }}>
      <Stack spacing={1.75}>
        <Typography variant="overline" sx={{ color: suave }}>
          {claro ? 'Modo claro' : 'Modo oscuro'}
        </Typography>

        <Stack spacing={0.5} sx={{ p: 1, borderRadius: 1, bgcolor: paleta.navy.paradas.main }}>
          {[
            { nombre: 'Inicio', activo: true },
            { nombre: 'Niveles Organizacionales', activo: false },
            { nombre: 'Tienda Virtual', activo: false },
          ].map((item) => (
            <Stack
              key={item.nombre}
              direction="row"
              alignItems="center"
              spacing={1.25}
              sx={{
                px: 1.25,
                py: 1,
                borderRadius: 0.875,
                ...(item.activo
                  ? { bgcolor: paleta.primary.paradas.main, color: '#FFFFFF' }
                  : { color: '#9FB3D1' }),
              }}
            >
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: 0.5,
                  bgcolor: item.activo ? 'rgba(255,255,255,.55)' : '#3C557F',
                }}
              />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {item.nombre}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Box sx={{ gap: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {acceso('Registrar actividad', paleta.primary.paradas)}
          {acceso('Próxima actividad', paleta.success.paradas)}
          {acceso('Mis insignias', paleta.warning.paradas)}
          {acceso('Capacitación', paleta.secondary.paradas)}
        </Box>

        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          {etiqueta('Completado', paleta.success.paradas)}
          {etiqueta('Pendiente', paleta.warning.paradas)}
          {etiqueta('Rechazado', paleta.error.paradas)}
          {etiqueta('Registrado', paleta.primary.paradas)}
          {etiqueta('Borrador', paleta.info.paradas)}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {boton('Guardar', paleta.primary.paradas.main)}
          {boton('Cancelar', null, claro ? fondo.dark : paleta.grey.paradas.dark)}
          {boton('Eliminar', paleta.error.paradas.main)}
        </Stack>

        <Box sx={{ pt: 1.25, borderTop: `solid 1px ${linea}` }}>
          <Typography variant="subtitle2" sx={{ color: tinta }}>
            Campamento Regional 2026
          </Typography>
          <Typography variant="caption" sx={{ color: suave }}>
            San José de los Llanos · Faltan 13 días
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

const RECOMENDACIONES = [
  {
    grado: 'Choca',
    color: 'error',
    titulo: 'El cian de `info` deja de distinguirse',
    cuerpo: [
      'Hoy info es #00B8D9. Con el primario en verde se leía como otra cosa; con el primario en azul pasa a ser «azul un poco más claro» y el ojo deja de separarlos. Peor aún: ese cian ya se coló dos veces donde tocaba el color de la casa, y eso fue con un primario que no se le parecía en nada.',
      'Propuesta: llevar info al verde azulado #0E9384, que se aleja del azul sin irse al verde de success. Si no, la alternativa honesta es quitar info de circulación y usar primary donde hoy se usa.',
    ],
  },
  {
    grado: 'Choca',
    color: 'error',
    titulo: 'El oro del escudo no puede ser `secondary`',
    cuerpo: [
      'Es tentador, porque el oro es la mitad de la identidad. Pero #C9A227 y el ámbar de warning #F59E0B son el mismo color para cualquiera que no los tenga uno al lado del otro. Un aviso de atención dejaría de leerse como aviso.',
      'El oro va como token de marca aparte —escudo, portada, barra lateral, el «Nivel 4» de la cabecera— y secondary se queda con el morado, que además ya está en los accesos rápidos («Capacitación»).',
    ],
  },
  {
    grado: 'Cuidado',
    color: 'warning',
    titulo: 'Los fondos oscuros actuales son grises, y la barra lateral es navy',
    cuerpo: [
      'El tema oscuro usa hoy #1C252E y #141A21, que son grises neutros. Junto al navy de la barra lateral se ven apagados y sucios, como dos oscuros distintos peleando.',
      'Los fondos propuestos llevan el mismo sesgo azul que la barra: el panel deja de parecer dos aplicaciones pegadas.',
    ],
  },
  {
    grado: 'Cuidado',
    color: 'warning',
    titulo: '`contrastText` es un campo, no un detalle',
    cuerpo: [
      'Cada muestra de arriba dice AA en blanco o en negro: es el texto que hay que declarar encima de ese tono. El oro y el ámbar piden texto oscuro (#1C252E); el resto lo piden blanco. Ponerlo al revés deja botones ilegibles que el tema no avisa, porque MUI se fía de lo que se declare.',
    ],
  },
  {
    grado: 'Antes de tocar',
    color: 'default',
    titulo: 'Un solo sitio, y los iconos aparte',
    cuerpo: [
      'Todo esto vive en src/theme/theme-config.js. Cambiarlo ahí lo cambia en las cuatro pantallas de la tienda, en las etiquetas de estado y en los organigramas de una vez; no hay hex sueltos que perseguir salvo los que se hayan colado.',
      'Los iconos dibujados a mano del paquete usan currentColor, así que heredan el color nuevo sin tocarlos. Lo que sí conviene repasar son los parches en webp: son imágenes con su propio color y no se van a mover con el tema.',
    ],
  },
];

// ----------------------------------------------------------------------

export function AdminPaletteView() {
  const theme = useTheme();
  const [paleta, setPaleta] = useState(() => desdeElTema(theme));

  // Lo guardado se lee DESPUES del primer pintado, no durante: en el servidor no
  // hay `localStorage`, y leerlo al construir el estado dejaba el HTML del
  // servidor distinto del primero del navegador.
  useEffect(() => {
    try {
      const crudo = window.localStorage.getItem(CLAVE_GUARDADO);

      if (!crudo) return;

      const guardado = JSON.parse(crudo);

      setPaleta((anterior) => {
        const siguiente = { ...anterior };

        Object.entries(guardado).forEach(([familia, paradas]) => {
          if (!siguiente[familia]) return;

          siguiente[familia] = {
            ...siguiente[familia],
            paradas: { ...siguiente[familia].paradas, ...paradas },
          };
        });

        return siguiente;
      });
    } catch {
      // Navegador sin almacenamiento o dato corrupto: se sigue con la propuesta.
    }
  }, []);

  const guardar = useCallback((siguiente) => {
    try {
      const plano = {};

      Object.entries(siguiente).forEach(([familia, datos]) => {
        plano[familia] = datos.paradas;
      });

      window.localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(plano));
    } catch {
      // Si no se puede guardar, la pantalla sigue sirviendo igual.
    }
  }, []);

  const handleCambiar = useCallback(
    (familia, parada, valor) => {
      setPaleta((anterior) => {
        const siguiente = {
          ...anterior,
          [familia]: {
            ...anterior[familia],
            paradas: { ...anterior[familia].paradas, [parada]: valor },
          },
        };

        guardar(siguiente);

        return siguiente;
      });
    },
    [guardar]
  );

  const handleCopiar = useCallback((texto, mensaje) => {
    navigator.clipboard.writeText(texto).then(
      () => toast.success(mensaje),
      () => toast.error('No se pudo copiar: selecciona el texto a mano.')
    );
  }, []);

  const handleRestaurar = useCallback(() => {
    const delTema = desdeElTema(theme);

    setPaleta(delTema);
    guardar(delTema);
    toast.success('Propuesta restaurada');
  }, [guardar, theme]);

  const bloqueDelTema = useMemo(() => {
    const familias = ['primary', 'secondary', 'info', 'success', 'warning', 'error'];
    let salida = 'palette: {\n';

    familias.forEach((familia) => {
      const paradas = paleta[familia].paradas;

      salida += `  ${familia}: {\n`;
      PARADAS.forEach((parada) => {
        salida += `    ${parada}: '${paradas[parada]}',\n`;
      });
      salida += `    contrastText: '${textoSobre(paradas.main)}',\n`;
      salida += '  },\n';
    });

    const grises = paleta.grey.paradas;

    salida += '  grey: {\n';
    salida += `    100: '${grises.lighter}', 300: '${grises.light}', 500: '${grises.main}',\n`;
    salida += `    700: '${grises.dark}', 900: '${grises.darker}',\n`;
    salida += '  },\n';
    salida += '},\n\n';
    salida += '// Fuera de las seis familias: mobiliario de marca, no estados.\n';
    salida += 'brand: {\n';
    salida += `  navy: '${paleta.navy.paradas.main}',\n`;
    salida += `  oro: '${paleta.oro.paradas.main}',\n`;
    salida += '},\n';

    return salida;
  }, [paleta]);

  return (
    <Stack spacing={4}>
      <Card sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ maxWidth: 620 }}>
            <Typography variant="h5">Paleta en pruebas</Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              El azul como color principal. <strong>Nada de esto está aplicado</strong>: el panel
              sigue con la paleta de siempre hasta que alguien copie el bloque del final a{' '}
              <Box component="code" sx={{ fontFamily: 'monospace' }}>
                src/theme/theme-config.js
              </Box>
              . Lo que toques se guarda solo en este navegador.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<Iconify icon="solar:copy-bold" />}
              onClick={() => handleCopiar(bloqueDelTema, 'Paleta copiada')}
            >
              Copiar paleta
            </Button>

            <Button
              variant="outlined"
              color="inherit"
              startIcon={<Iconify icon="solar:restart-bold" />}
              onClick={handleRestaurar}
            >
              Restaurar
            </Button>
          </Stack>
        </Stack>
      </Card>

      {GRUPOS.map((grupo) => (
        <Stack key={grupo.id} spacing={1.5}>
          <Box>
            <Typography variant="h6">{grupo.titulo}</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', maxWidth: 720 }}>
              {grupo.nota}
            </Typography>
          </Box>

          {Object.entries(paleta)
            .filter(([, datos]) => datos.grupo === grupo.id)
            .map(([familia, datos]) => (
              <RampaDeColor
                key={familia}
                familia={familia}
                datos={datos}
                onCambiar={handleCambiar}
                onCopiar={handleCopiar}
              />
            ))}
        </Stack>
      ))}

      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6">Cómo se ve</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', maxWidth: 720 }}>
            Los mismos componentes con la misma paleta, en los dos fondos a la vez. El fallo de una
            paleta casi nunca está en un tono suelto: está en que funciona sobre un fondo y se apaga
            en el otro.
          </Typography>
        </Box>

        <Box
          sx={{
            gap: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          }}
        >
          <LienzoDePrueba paleta={paleta} claro />
          <LienzoDePrueba paleta={paleta} claro={false} />
        </Box>
      </Stack>

      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6">Recomendaciones</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', maxWidth: 720 }}>
            Lo que cambiar el primario a azul arrastra consigo, ordenado por lo que rompe si no se
            atiende.
          </Typography>
        </Box>

        <Card variant="outlined">
          {RECOMENDACIONES.map((consejo, indice) => (
            <Box key={consejo.titulo}>
              {indice > 0 && <Divider />}

              <Box
                sx={{
                  p: 2.5,
                  gap: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '110px 1fr' },
                }}
              >
                <Typography
                  variant="overline"
                  sx={{
                    color: consejo.color === 'default' ? 'text.disabled' : `${consejo.color}.main`,
                  }}
                >
                  {consejo.grado}
                </Typography>

                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 0.75 }}>
                    {consejo.titulo}
                  </Typography>

                  {consejo.cuerpo.map((parrafo) => (
                    <Typography
                      key={parrafo.slice(0, 40)}
                      variant="body2"
                      sx={{ color: 'text.secondary', maxWidth: 760, '& + &': { mt: 1 } }}
                    >
                      {parrafo}
                    </Typography>
                  ))}
                </Box>
              </Box>
            </Box>
          ))}
        </Card>
      </Stack>

      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6">Para pegar</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', maxWidth: 720 }}>
            Refleja lo que esté editado arriba, con el{' '}
            <Box component="code" sx={{ fontFamily: 'monospace' }}>
              contrastText
            </Box>{' '}
            ya resuelto por contraste.
          </Typography>
        </Box>

        <Card
          variant="outlined"
          sx={{
            p: 2,
            overflowX: 'auto',
            bgcolor: 'background.neutral',
          }}
        >
          <Box
            component="pre"
            sx={{
              m: 0,
              typography: 'caption',
              fontFamily: 'monospace',
              lineHeight: 1.7,
              whiteSpace: 'pre',
            }}
          >
            {bloqueDelTema}
          </Box>
        </Card>
      </Stack>
    </Stack>
  );
}
