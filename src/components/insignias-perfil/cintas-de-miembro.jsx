'use client';

import { onSnapshot } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { keyframes } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { isAdminGlobal } from 'src/utils/org-level-access';
import {
  digitosDeVeces,
  CINTAS_POR_FILA,
  normalizarVeces,
  obtenerCintaPerfil,
  MAXIMO_VECES_CINTA,
  EFECTOS_BORDE_CINTA,
  EFECTOS_NUMERO_CINTA,
  disponerCintasEnFilas,
  configuracionPorCinta,
  normalizarEfectoBorde,
  normalizarEfectoNumero,
  CATALOGO_CINTAS_PERFIL,
} from 'src/utils/cintas-perfil.mjs';

import { referenciaDeCintas } from 'src/services/cintas-miembros-apply';
import { guardarCintasDeMiembro } from 'src/services/cintas-miembros-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const destelloDorado = keyframes`
  0%, 55%, 100% { background-position: 160% 0; }
  78% { background-position: -60% 0; }
`;

const destelloDelBorde = keyframes`
  0%, 58%, 100% { background-position: 165% 0; }
  80% { background-position: -65% 0; }
`;

const olaDelBorde = keyframes`
  0% { background-position: -80% 50%; }
  100% { background-position: 180% 50%; }
`;

const pulsoDelBorde = keyframes`
  0%, 100% { opacity: 0.18; }
  50% { opacity: 0.72; }
`;

const centelleoDelBorde = keyframes`
  0%, 100% { background-position: -35% 50%, 135% 50%; opacity: 0.15; }
  35% { opacity: 0.75; }
  65% { background-position: 135% 50%, -35% 50%; opacity: 0.4; }
`;

const estrellaDorada = keyframes`
  0% { opacity: 0; transform: scale(0.25) rotate(0deg); }
  35% { opacity: 0.85; transform: scale(1) rotate(35deg); }
  100% { opacity: 0; transform: scale(0.15) rotate(90deg); }
`;

const auraDorada = keyframes`
  0%, 100% { filter: drop-shadow(0 0 1px rgba(255, 230, 130, 0.3)); }
  50% { filter: drop-shadow(0 0 4px rgba(255, 210, 70, 0.72)); }
`;

const centelleoDelNumero = keyframes`
  0%, 35%, 100% { opacity: 0; transform: scale(0.25) rotate(0deg); }
  45% { opacity: 0.82; transform: scale(0.9) rotate(40deg); }
  55% { opacity: 0; transform: scale(0.2) rotate(75deg); }
`;

const CINTAS_CON_BORDE_DORADO = new Set(['3', '5', '6', '7', '12a']);

const OPCIONES_BORDE = [
  [EFECTOS_BORDE_CINTA.BARRIDO, 'Barrido actual'],
  [EFECTOS_BORDE_CINTA.OLA, 'Ola lenta'],
  [EFECTOS_BORDE_CINTA.PULSO, 'Pulso suave'],
  [EFECTOS_BORDE_CINTA.CENTELLEO, 'Centelleo doble'],
  [EFECTOS_BORDE_CINTA.NINGUNO, 'Sin efecto'],
];

const OPCIONES_NUMERO = [
  [EFECTOS_NUMERO_CINTA.BARRIDO, 'Barrido actual'],
  [EFECTOS_NUMERO_CINTA.DESTELLO, 'Destello de estrella'],
  [EFECTOS_NUMERO_CINTA.AURA, 'Aura dorada'],
  [EFECTOS_NUMERO_CINTA.CENTELLEO, 'Centelleo doble'],
  [EFECTOS_NUMERO_CINTA.NINGUNO, 'Sin efecto'],
];

const mascaraDelBorde = {
  WebkitMaskImage:
    'linear-gradient(#000 0 0), linear-gradient(#000 0 0), linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
  maskImage:
    'linear-gradient(#000 0 0), linear-gradient(#000 0 0), linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
  WebkitMaskSize: '100% 16%, 100% 16%, 6% 68%, 6% 68%',
  maskSize: '100% 16%, 100% 16%, 6% 68%, 6% 68%',
  WebkitMaskPosition: 'top, bottom, left center, right center',
  maskPosition: 'top, bottom, left center, right center',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
};

const estiloDelBorde = (efecto) => {
  switch (normalizarEfectoBorde(efecto)) {
    case EFECTOS_BORDE_CINTA.OLA:
      return {
        backgroundImage:
          'radial-gradient(ellipse at center, rgba(255, 250, 214, 0.72) 0%, rgba(255, 205, 72, 0.34) 38%, transparent 70%)',
        backgroundSize: '52% 220%',
        backgroundRepeat: 'no-repeat',
        animation: `${olaDelBorde} 9s linear infinite`,
      };
    case EFECTOS_BORDE_CINTA.PULSO:
      return {
        backgroundColor: 'rgba(255, 215, 92, 0.5)',
        animation: `${pulsoDelBorde} 3.8s ease-in-out infinite`,
      };
    case EFECTOS_BORDE_CINTA.CENTELLEO:
      return {
        backgroundImage:
          'radial-gradient(circle, rgba(255, 252, 221, 0.85) 0%, transparent 62%), radial-gradient(circle, rgba(255, 211, 80, 0.65) 0%, transparent 62%)',
        backgroundSize: '22% 150%, 18% 130%',
        backgroundRepeat: 'no-repeat',
        animation: `${centelleoDelBorde} 6.5s ease-in-out infinite`,
      };
    case EFECTOS_BORDE_CINTA.NINGUNO:
      return { display: 'none' };
    default:
      return {
        backgroundImage:
          'linear-gradient(110deg, transparent 42%, rgba(255, 249, 202, 0.7) 50%, transparent 58%)',
        backgroundSize: '270% 100%',
        backgroundPosition: '165% 0',
        animation: `${destelloDelBorde} 4.8s ease-in-out infinite`,
      };
  }
};

// ----------------------------------------------------------------------

// Igual que el menú lateral: la cuenta administrativa de siempre llega con
// `role: 'admin'` y no con el cargo.
const esAdministradorGlobal = (user) =>
  isAdminGlobal(user) ||
  String(user?.role ?? user?.rol ?? '')
    .trim()
    .toLowerCase() === 'admin';

// Cintas del perfil de un miembro, leídas de `cintas_miembros/{idMiembros}` y
// dispuestas con la regla de `src/utils/cintas-perfil.mjs`. El Administrador
// Global ve un lápiz para ponerlas a mano mientras no estén conectadas a awards.
// `espacioHorizontal` / `espacioVertical`: separación entre cintas (unidades del
// tema: 1 = 8px). En 0 van pegadas, como en el manual.
export function CintasDeMiembro({
  idMiembros,
  sx,
  maxWidth = 300,
  espacioHorizontal = 0.3,
  espacioVertical = 0.3,
}) {
  const { user } = useAuthContext();
  const puedeEditar = esAdministradorGlobal(user);
  const id = String(Number(idMiembros) || '');

  const [asignadas, setAsignadas] = useState([]);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!id) return undefined;

    return onSnapshot(
      referenciaDeCintas(id),
      (instantanea) => setAsignadas(instantanea.data()?.cintas ?? []),
      // Sin permiso o sin red el perfil sigue pintándose, solo que sin cintas.
      (error) => console.error('[cintas] no se pudieron leer', error)
    );
  }, [id]);

  const filas = useMemo(() => disponerCintasEnFilas(asignadas), [asignadas]);
  const configuraciones = useMemo(() => configuracionPorCinta(asignadas), [asignadas]);

  if (!id || (!filas.length && !puedeEditar)) return null;

  return (
    <Box
      sx={[
        {
          mx: 'auto',
          width: 1,
          maxWidth,
          display: 'flex',
          flexDirection: 'column',
          rowGap: espacioVertical,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {filas.map((fila) => (
        <Box
          key={fila.join('-')}
          sx={{ display: 'flex', justifyContent: 'center', columnGap: espacioHorizontal }}
        >
          {fila.map((idCinta) => {
            const cinta = obtenerCintaPerfil(idCinta);
            const configuracion = configuraciones.get(idCinta);
            return (
              <Tooltip
                key={idCinta}
                arrow
                title={<TextoDeCinta cinta={cinta} />}
                // El aviso de MUI se queda en 300px de ancho: la descripción salía como
                // una columna estrecha y larga.
                slotProps={{ tooltip: { sx: { maxWidth: 380 } } }}
              >
                <Box
                  sx={(theme) => ({
                    // El hueco se descuenta del ancho para que 3 sigan cabiendo en la fila.
                    width: `calc((100% - ${theme.spacing(espacioHorizontal * (CINTAS_POR_FILA - 1))}) / ${CINTAS_POR_FILA})`,
                  })}
                >
                  <ImagenDeCinta cinta={cinta} {...configuracion} />
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      ))}

      {puedeEditar && !filas.length && (
        <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
          Sin cintas
        </Typography>
      )}

      {/* En la esquina superior derecha de la tarjeta del perfil: la tarjeta que
          lo contiene lleva `position: 'relative'`. */}
      {puedeEditar && (
        <Tooltip title="Asignar cintas de prueba">
          <IconButton
            size="small"
            onClick={() => setAbierto(true)}
            sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
          >
            <Iconify icon="solar:pen-bold" width={18} />
          </IconButton>
        </Tooltip>
      )}

      {abierto && (
        <DialogoCintasDePrueba
          idMiembros={id}
          asignadas={asignadas}
          user={user}
          onClose={() => setAbierto(false)}
        />
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

// La cinta con, si se ganó más de una vez, su número dorado en el centro.
function ImagenDeCinta({ cinta, veces, efectoBorde, efectoNumero }) {
  const digitos = digitosDeVeces(veces);
  const tieneBordeDorado = CINTAS_CON_BORDE_DORADO.has(cinta.id);
  const bordeElegido = normalizarEfectoBorde(efectoBorde);
  const numeroElegido = normalizarEfectoNumero(efectoNumero);
  const [brilloAleatorio, setBrilloAleatorio] = useState(null);

  useEffect(() => {
    if (numeroElegido !== EFECTOS_NUMERO_CINTA.DESTELLO || !digitos.length) return undefined;

    let temporizadorBrillo;
    let temporizadorSiguiente;

    const programarBrillo = () => {
      temporizadorSiguiente = setTimeout(
        () => {
          setBrilloAleatorio({
            id: Date.now(),
            indice: Math.floor(Math.random() * digitos.length),
          });
          temporizadorBrillo = setTimeout(() => setBrilloAleatorio(null), 850);
          programarBrillo();
        },
        3500 + Math.random() * 4000
      );
    };

    programarBrillo();

    return () => {
      clearTimeout(temporizadorBrillo);
      clearTimeout(temporizadorSiguiente);
    };
  }, [digitos.length, numeroElegido]);

  return (
    <Box sx={{ position: 'relative', lineHeight: 0 }}>
      <Box
        component="img"
        src={cinta.src}
        alt={cinta.nombre}
        sx={{ width: 1, height: 'auto', display: 'block' }}
      />
      {tieneBordeDorado && bordeElegido !== EFECTOS_BORDE_CINTA.NINGUNO && (
        <Box
          aria-hidden="true"
          sx={{
            inset: 0,
            zIndex: 1,
            position: 'absolute',
            pointerEvents: 'none',
            ...mascaraDelBorde,
            ...estiloDelBorde(bordeElegido),
            filter: 'drop-shadow(0 0 2px rgba(255, 193, 7, 0.35))',
            willChange: 'background-position',
            '@media (prefers-reduced-motion: reduce)': {
              display: 'none',
            },
          }}
        />
      )}
      {!!digitos.length && (
        <Box
          aria-label={`Ganada ${normalizarVeces(veces)} veces`}
          sx={{
            inset: 0,
            zIndex: 2,
            display: 'flex',
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {digitos.map((src, indice) => (
            <Box
              key={`${src}-${indice}`}
              sx={{
                height: '62%',
                width: 'auto',
                display: 'inline-flex',
                position: 'relative',
                ...(numeroElegido === EFECTOS_NUMERO_CINTA.BARRIDO && {
                  '&::after': {
                    inset: 0,
                    content: '""',
                    position: 'absolute',
                    backgroundImage:
                      'linear-gradient(110deg, transparent 43%, rgba(255, 248, 190, 0.58) 50%, transparent 57%)',
                    backgroundSize: '260% 100%',
                    backgroundPosition: '160% 0',
                    WebkitMaskImage: `url("${src}")`,
                    maskImage: `url("${src}")`,
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    willChange: 'background-position',
                    animation: `${destelloDorado} 3.4s ease-in-out infinite`,
                    '@media (prefers-reduced-motion: reduce)': {
                      display: 'none',
                    },
                  },
                }),
              }}
            >
              <Box
                component="img"
                src={src}
                alt=""
                sx={{
                  width: 'auto',
                  height: '100%',
                  display: 'block',
                  filter:
                    numeroElegido === EFECTOS_NUMERO_CINTA.NINGUNO
                      ? 'drop-shadow(0 2px 1.5px rgba(24, 18, 4, 0.48))'
                      : 'drop-shadow(0 2px 1.5px rgba(24, 18, 4, 0.48)) drop-shadow(0 0 1px rgba(255, 230, 130, 0.55)) drop-shadow(0 0 2px rgba(255, 193, 7, 0.38))',
                  ...(numeroElegido === EFECTOS_NUMERO_CINTA.AURA && {
                    animation: `${auraDorada} 3.6s ease-in-out infinite`,
                    '@media (prefers-reduced-motion: reduce)': {
                      animation: 'none',
                    },
                  }),
                }}
              />
              {numeroElegido === EFECTOS_NUMERO_CINTA.DESTELLO &&
                brilloAleatorio?.indice === indice && (
                  <Box
                    key={brilloAleatorio.id}
                    component="span"
                    aria-hidden="true"
                    sx={{
                      top: '-16%',
                      right: '-24%',
                      zIndex: 1,
                      color: '#fff7bd',
                      fontSize: '0.72rem',
                      lineHeight: 1,
                      position: 'absolute',
                      textShadow:
                        '0 0 2px rgba(255, 255, 235, 0.8), 0 0 4px rgba(255, 193, 7, 0.55)',
                      animation: `${estrellaDorada} 850ms ease-out both`,
                      '@media (prefers-reduced-motion: reduce)': {
                        display: 'none',
                      },
                    }}
                  >
                    ✦
                  </Box>
                )}
              {numeroElegido === EFECTOS_NUMERO_CINTA.CENTELLEO && (
                <>
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      top: '-12%',
                      left: '-20%',
                      color: '#fff7bd',
                      fontSize: '0.55rem',
                      lineHeight: 1,
                      position: 'absolute',
                      animation: `${centelleoDelNumero} 4.8s ease-in-out infinite`,
                      '@media (prefers-reduced-motion: reduce)': { display: 'none' },
                    }}
                  >
                    ✦
                  </Box>
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      right: '-18%',
                      bottom: '-8%',
                      color: '#ffd95c',
                      fontSize: '0.48rem',
                      lineHeight: 1,
                      position: 'absolute',
                      animation: `${centelleoDelNumero} 4.8s 1.6s ease-in-out infinite`,
                      '@media (prefers-reduced-motion: reduce)': { display: 'none' },
                    }}
                  >
                    ✦
                  </Box>
                </>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Lo que sale al pasar el ratón por una cinta: el nombre en negritas y debajo
// para qué se da.
// La descripción entera tapaba media tarjeta: se ven dos líneas y "Ver más"
// abre el resto dentro del mismo aviso (el Tooltip de MUI deja pulsar dentro).
function TextoDeCinta({ cinta }) {
  const [completa, setCompleta] = useState(false);

  return (
    <Box sx={{ py: 0.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 'fontWeightBold' }}>
        {cinta.nombre}
      </Typography>
      {cinta.descripcion && (
        <>
          <Typography
            variant="body2"
            component="p"
            sx={{
              mt: 0.5,
              ...(!completa && {
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }),
            }}
          >
            {cinta.descripcion}
          </Typography>
          <Button
            size="small"
            color="inherit"
            onClick={() => setCompleta((valor) => !valor)}
            sx={{ mt: 0.5, px: 0.5, minWidth: 0, fontWeight: 'fontWeightBold' }}
          >
            {completa ? 'Ver menos' : 'Ver más'}
          </Button>
        </>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

function DialogoCintasDePrueba({ idMiembros, asignadas, user, onClose }) {
  // id → { veces, efectoBorde, efectoNumero }. Estar en el mapa es estar elegida.
  const [elegidas, setElegidas] = useState(() => configuracionPorCinta(asignadas));
  const configuracionInicial = [...configuracionPorCinta(asignadas).values()][0];
  const [efectoBordeGlobal, setEfectoBordeGlobal] = useState(
    configuracionInicial?.efectoBorde ?? EFECTOS_BORDE_CINTA.BARRIDO
  );
  const [efectoNumeroGlobal, setEfectoNumeroGlobal] = useState(
    configuracionInicial?.efectoNumero ?? EFECTOS_NUMERO_CINTA.BARRIDO
  );
  const [guardando, setGuardando] = useState(false);

  const alternar = (idCinta) =>
    setElegidas((previas) => {
      const siguientes = new Map(previas);
      if (siguientes.has(idCinta)) siguientes.delete(idCinta);
      else {
        siguientes.set(idCinta, {
          veces: 1,
          efectoBorde: EFECTOS_BORDE_CINTA.BARRIDO,
          efectoNumero: EFECTOS_NUMERO_CINTA.BARRIDO,
        });
      }
      return siguientes;
    });

  const cambiarVeces = (idCinta, delta) =>
    setElegidas((previas) => {
      const siguientes = new Map(previas);
      const configuracion = siguientes.get(idCinta);
      siguientes.set(idCinta, {
        ...configuracion,
        veces: normalizarVeces((configuracion?.veces ?? 1) + delta),
      });
      return siguientes;
    });

  const guardar = async () => {
    try {
      setGuardando(true);
      await guardarCintasDeMiembro({
        idMiembros,
        anteriores: asignadas,
        elegidas: [...elegidas].map(([id, configuracion]) => ({
          id,
          veces: configuracion.veces,
          efectoBorde: efectoBordeGlobal,
          efectoNumero: efectoNumeroGlobal,
        })),
        usuario: user,
      });
      toast.success('Cintas guardadas.');
      onClose();
    } catch (error) {
      console.error('[cintas] no se pudieron guardar', error);
      toast.error('No se pudieron guardar las cintas.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="lg" onClose={guardando ? undefined : onClose}>
      <DialogTitle>
        Cintas de prueba <Label color="warning">Solo pruebas</Label>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Elegidas: {elegidas.size}. En el perfil se ordenan por número y se muestran hasta 18. Con
          más de una vez, la cinta lleva el número en el centro.
        </Typography>

        <Box
          sx={{
            mb: 2,
            gap: 1.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 260px))' },
          }}
        >
          <TextField
            select
            fullWidth
            size="small"
            label="Brillo global de bordes dorados"
            value={efectoBordeGlobal}
            onChange={(evento) => setEfectoBordeGlobal(evento.target.value)}
          >
            {OPCIONES_BORDE.map(([valor, etiqueta]) => (
              <MenuItem key={valor} value={valor}>
                {etiqueta}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            size="small"
            label="Brillo global de números"
            value={efectoNumeroGlobal}
            onChange={(evento) => setEfectoNumeroGlobal(evento.target.value)}
          >
            {OPCIONES_NUMERO.map(([valor, etiqueta]) => (
              <MenuItem key={valor} value={valor}>
                {etiqueta}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gap: 1,
            // `minmax(0, 1fr)` y `minWidth: 0`: con `1fr` a secas el nombre sin
            // cortar ensanchaba la columna y la ventana pedía scroll horizontal.
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(4, minmax(0, 1fr))',
              md: 'repeat(6, minmax(0, 1fr))',
            },
          }}
        >
          {CATALOGO_CINTAS_PERFIL.map((cinta) => {
            const activa = elegidas.has(cinta.id);
            const configuracion = elegidas.get(cinta.id);
            return (
              <Box
                key={cinta.id}
                role="button"
                tabIndex={0}
                onClick={() => alternar(cinta.id)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter' || evento.key === ' ') {
                    evento.preventDefault();
                    alternar(cinta.id);
                  }
                }}
                title={cinta.nombre}
                sx={(theme) => ({
                  p: 0.75,
                  minWidth: 0,
                  borderRadius: 1,
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: activa
                    ? theme.vars.palette.primary.darker
                    : theme.vars.palette.text.primary,
                  backgroundColor: activa
                    ? theme.vars.palette.primary.lighter
                    : theme.vars.palette.background.paper,
                  border: `2px solid ${
                    activa ? theme.vars.palette.primary.main : theme.vars.palette.divider
                  }`,
                  ...theme.applyStyles('dark', {
                    color: activa
                      ? theme.vars.palette.primary.lighter
                      : theme.vars.palette.text.primary,
                    backgroundColor: activa
                      ? theme.vars.palette.primary.darker
                      : theme.vars.palette.background.paper,
                    borderColor: activa
                      ? theme.vars.palette.primary.light
                      : theme.vars.palette.divider,
                  }),
                })}
              >
                <ImagenDeCinta
                  cinta={cinta}
                  veces={configuracion?.veces}
                  efectoBorde={efectoBordeGlobal}
                  efectoNumero={efectoNumeroGlobal}
                />
                <Typography variant="caption" noWrap sx={{ display: 'block', mt: 0.5 }}>
                  {cinta.id}. {cinta.nombre}
                </Typography>

                {/* Cuántas veces se ganó. No propaga el clic: cambiar el número no
                    debe desmarcar la cinta. */}
                {activa && (
                  <Box
                    onClick={(evento) => evento.stopPropagation()}
                    onKeyDown={(evento) => evento.stopPropagation()}
                    sx={{
                      mt: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconButton
                      size="small"
                      aria-label="Una vez menos"
                      disabled={configuracion.veces <= 1}
                      onClick={() => cambiarVeces(cinta.id, -1)}
                    >
                      <Iconify icon="mingcute:minimize-line" width={16} />
                    </IconButton>
                    <Typography variant="subtitle2" sx={{ minWidth: 40, textAlign: 'center' }}>
                      ×{configuracion.veces}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label="Una vez más"
                      disabled={configuracion.veces >= MAXIMO_VECES_CINTA}
                      onClick={() => cambiarVeces(cinta.id, 1)}
                    >
                      <Iconify icon="mingcute:add-line" width={16} />
                    </IconButton>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => setElegidas(new Map())} disabled={guardando} color="inherit">
          Quitar todas
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} disabled={guardando} color="inherit">
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
