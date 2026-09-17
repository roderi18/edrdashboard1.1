'use client';

import { onSnapshot } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { keyframes } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { isAdminGlobal } from 'src/utils/org-level-access';
import {
  vecesPorCinta,
  digitosDeVeces,
  CINTAS_POR_FILA,
  normalizarVeces,
  obtenerCintaPerfil,
  MAXIMO_VECES_CINTA,
  disponerCintasEnFilas,
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

const estrellaDorada = keyframes`
  0% { opacity: 0; transform: scale(0.25) rotate(0deg); }
  35% { opacity: 0.9; transform: scale(1) rotate(35deg); }
  65% { opacity: 0.75; transform: scale(0.82) rotate(60deg); }
  100% { opacity: 0; transform: scale(0.15) rotate(90deg); }
`;

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
  const veces = useMemo(() => vecesPorCinta(asignadas), [asignadas]);

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
                  <ImagenDeCinta cinta={cinta} veces={veces.get(idCinta)} />
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
function ImagenDeCinta({ cinta, veces }) {
  const digitos = digitosDeVeces(veces);
  const [brilloAleatorio, setBrilloAleatorio] = useState(null);

  useEffect(() => {
    if (!digitos.length) return undefined;

    let temporizadorBrillo;
    let temporizadorSiguiente;

    const programarBrillo = () => {
      const espera = 3500 + Math.random() * 4000;

      temporizadorSiguiente = setTimeout(() => {
        setBrilloAleatorio({
          id: Date.now(),
          indice: Math.floor(Math.random() * digitos.length),
        });

        temporizadorBrillo = setTimeout(() => setBrilloAleatorio(null), 850);
        programarBrillo();
      }, espera);
    };

    programarBrillo();

    return () => {
      clearTimeout(temporizadorBrillo);
      clearTimeout(temporizadorSiguiente);
    };
  }, [digitos.length]);

  return (
    <Box sx={{ position: 'relative', lineHeight: 0 }}>
      <Box
        component="img"
        src={cinta.src}
        alt={cinta.nombre}
        sx={{ width: 1, height: 'auto', display: 'block' }}
      />
      {!!digitos.length && (
        <Box
          aria-label={`Ganada ${normalizarVeces(veces)} veces`}
          sx={{
            inset: 0,
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
                    'drop-shadow(0 2px 1.5px rgba(24, 18, 4, 0.48)) drop-shadow(0 0 1px rgba(255, 230, 130, 0.55)) drop-shadow(0 0 2px rgba(255, 193, 7, 0.38))',
                }}
              />
              {brilloAleatorio?.indice === indice && (
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
                      '0 0 2px rgba(255, 255, 235, 0.85), 0 0 5px rgba(255, 193, 7, 0.65)',
                    animation: `${estrellaDorada} 850ms ease-out both`,
                    '@media (prefers-reduced-motion: reduce)': {
                      display: 'none',
                    },
                  }}
                >
                  ✦
                </Box>
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
  // id → veces. Estar en el mapa es estar elegida.
  const [elegidas, setElegidas] = useState(() => vecesPorCinta(asignadas));
  const [guardando, setGuardando] = useState(false);

  const alternar = (idCinta) =>
    setElegidas((previas) => {
      const siguientes = new Map(previas);
      if (siguientes.has(idCinta)) siguientes.delete(idCinta);
      else siguientes.set(idCinta, 1);
      return siguientes;
    });

  const cambiarVeces = (idCinta, delta) =>
    setElegidas((previas) =>
      new Map(previas).set(idCinta, normalizarVeces((previas.get(idCinta) ?? 1) + delta))
    );

  const guardar = async () => {
    try {
      setGuardando(true);
      await guardarCintasDeMiembro({
        idMiembros,
        anteriores: asignadas,
        elegidas: [...elegidas].map(([id, vecesElegidas]) => ({ id, veces: vecesElegidas })),
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
                <ImagenDeCinta cinta={cinta} veces={elegidas.get(cinta.id)} />
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
                      disabled={elegidas.get(cinta.id) <= 1}
                      onClick={() => cambiarVeces(cinta.id, -1)}
                    >
                      <Iconify icon="mingcute:minimize-line" width={16} />
                    </IconButton>
                    <Typography variant="subtitle2" sx={{ minWidth: 40, textAlign: 'center' }}>
                      ×{elegidas.get(cinta.id)}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label="Una vez más"
                      disabled={elegidas.get(cinta.id) >= MAXIMO_VECES_CINTA}
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
