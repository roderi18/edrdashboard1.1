'use client';

import { useState, useCallback } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControl from '@mui/material/FormControl';
import ListSubheader from '@mui/material/ListSubheader';

import {
  borrarSimulacionDeRoles,
  guardarSimulacionDeRoles,
} from 'src/utils/simulacion-roles';

import {
  PESO_NIVEL,
  rolesDeNivel,
  ETIQUETA_NIVEL,
  rolPrincipalDe,
  NIVEL_COMBINACION,
  ROL_COMBINABLE_POR_CODIGO,
} from 'src/catalogs/combinaciones-roles';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { useAuthContext } from 'src/auth/hooks';
import { ROLES } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// PROBAR DOS CARGOS A LA VEZ.
//
// Una persona real puede ser Coordinador en su destacamento y, ademas, ocupar
// una casilla en su seccion. Los permisos se suman y dentro de cada modulo manda
// el cargo de ese nivel (ver `modulo-activo`), pero eso no se puede comprobar
// entrando con un rol suelto: hay que entrar con los dos.
//
// El desplegable de al lado cambia UN rol. Este enciende una PAREJA y apaga al
// Administrador Global mientras dura; al apagarla se vuelve a el.
//
// Un cargo de destacamento se mezcla con cualquiera. Los de seccion, region y
// Consejo Nacional NO se mezclan entre si: nadie ocupa dos casillas de esa
// escalera a la vez.
// ----------------------------------------------------------------------

const NIVELES_DEL_SEGUNDO = [
  NIVEL_COMBINACION.seccion,
  NIVEL_COMBINACION.region,
  NIVEL_COMBINACION.nacional,
];

const rolesDestacamento = rolesDeNivel(NIVEL_COMBINACION.destacamento);

export function RoleCombinationPopover({ sx, ...other }) {
  const { user } = useAuthContext();
  const popover = usePopover();

  const combinacionActiva = user?.simulacion?.activa
    ? {
        destacamento: user.simulacion.rolDestacamento || '',
        acompanante: user.simulacion.rolAcompanante || '',
      }
    : null;

  const [rolDestacamento, setRolDestacamento] = useState(
    combinacionActiva?.destacamento || ROLES.USUARIO_DESTACAMENTO
  );
  const [rolAcompanante, setRolAcompanante] = useState(
    combinacionActiva?.acompanante || ROLES.USUARIO_SECCION
  );
  const [guardando, setGuardando] = useState(false);

  const aplicar = useCallback(
    ({ apagar = false } = {}) => {
      if (apagar) {
        borrarSimulacionDeRoles();
        window.location.reload();
        return;
      }

      const deDestacamento = ROL_COMBINABLE_POR_CODIGO[rolDestacamento];
      const acompanante = ROL_COMBINABLE_POR_CODIGO[rolAcompanante];

      if (!deDestacamento || !acompanante) {
        toast.error('Elige un cargo de destacamento y un segundo cargo.');
        return;
      }

      setGuardando(true);
      // NO se toca la asignacion de rol en la base de datos. La prueba vive en
      // la pestaña: asi apagarla no depende de que las reglas dejen a un
      // coordinador reescribir su propio rol —no lo dejan—, que es como el
      // Administrador Global se quedaria encerrado fuera de su propio mando.
      guardarSimulacionDeRoles({
        rolDestacamento: deDestacamento.codigo,
        rolAcompanante: acompanante.codigo,
      });
      window.location.reload();
    },
    [rolAcompanante, rolDestacamento]
  );

  const nombreDe = (codigo) => ROL_COMBINABLE_POR_CODIGO[codigo]?.nombre || '';

  // El mismo fondo que se enciende al abrir el selector de un solo rol.
  const fondoDelBoton = {
    height: 1,
    zIndex: -1,
    opacity: 0,
    content: "''",
    borderRadius: 1,
    position: 'absolute',
    visibility: 'hidden',
    bgcolor: 'action.hover',
    width: 'calc(100% + 8px)',
    transition: (theme) =>
      theme.transitions.create(['opacity', 'visibility'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.shorter,
      }),
    ...(popover.open && {
      opacity: 1,
      visibility: 'visible',
    }),
  };

  return (
    <>
      {/* El mismo boton que el selector de un solo rol —icono redondo, nombre y
          la misma flecha—, para que se lean como dos piezas de lo mismo. Cambia
          el icono, no la forma. */}
      <ButtonBase
        disableRipple
        onClick={popover.onOpen}
        sx={[
          {
            py: 0.5,
            gap: { xs: 0.5, sm: 1 },
            '&::before': fondoDelBoton,
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        <Box
          sx={{
            width: 24,
            height: 24,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Transparente, igual que el icono del selector de un solo rol en la
            // cabecera; el color lo pone el icono, no un circulo de fondo.
            bgcolor: 'transparent',
            color: combinacionActiva ? 'warning.main' : 'primary.main',
          }}
        >
          <Iconify width={16} icon="solar:users-group-rounded-bold-duotone" />
        </Box>

        <Box
          component="span"
          sx={{ typography: 'subtitle2', display: { xs: 'none', sm: 'inline-flex' } }}
        >
          {combinacionActiva
            ? `${nombreDe(combinacionActiva.destacamento)} + ${nombreDe(combinacionActiva.acompanante)}`
            : 'Roles combinados'}
        </Box>

        {combinacionActiva && <Chip size="small" color="warning" variant="soft" label="Prueba" />}

        <Iconify width={16} icon="carbon:chevron-sort" sx={{ color: 'text.disabled' }} />
      </ButtonBase>

      <CustomPopover
        open={popover.open}
        anchorEl={popover.anchorEl}
        onClose={popover.onClose}
        slotProps={{ arrow: { placement: 'top-left' }, paper: { sx: { width: 340 } } }}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          <Box>
            <Typography variant="subtitle2">Entrar con dos cargos</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Uno de destacamento y uno de sección, región o Consejo Nacional. Mientras esté
              encendida, esta sesión deja de ser Administrador Global. Es una prueba de esta
              pestaña: no cambia tu rol en la base de datos.
            </Typography>
          </Box>

          <FormControl fullWidth size="small">
            <InputLabel id="rol-destacamento-label">Cargo de destacamento</InputLabel>
            <Select
              labelId="rol-destacamento-label"
              label="Cargo de destacamento"
              value={rolDestacamento}
              onChange={(event) => setRolDestacamento(event.target.value)}
            >
              {rolesDestacamento.map((rol) => (
                <MenuItem key={rol.codigo} value={rol.codigo}>
                  {rol.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel id="rol-acompanante-label">Segundo cargo</InputLabel>
            <Select
              labelId="rol-acompanante-label"
              label="Segundo cargo"
              value={rolAcompanante}
              onChange={(event) => setRolAcompanante(event.target.value)}
            >
              {/* Agrupados por nivel, y solo uno: seccion, region y Consejo
                  Nacional no se mezclan entre si. */}
              {NIVELES_DEL_SEGUNDO.flatMap((nivel) => [
                <ListSubheader key={`titulo-${nivel}`}>{ETIQUETA_NIVEL[nivel]}</ListSubheader>,
                ...rolesDeNivel(nivel).map((rol) => (
                  <MenuItem key={rol.codigo} value={rol.codigo}>
                    {rol.nombre}
                  </MenuItem>
                )),
              ])}
            </Select>
          </FormControl>

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Entra como{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 'fontWeightSemiBold' }}>
              {rolPrincipalDe([
                ROL_COMBINABLE_POR_CODIGO[rolDestacamento],
                ROL_COMBINABLE_POR_CODIGO[rolAcompanante],
              ])?.nombre || '—'}
            </Box>
            , y en Miembros y Destacamentos manda{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 'fontWeightSemiBold' }}>
              {nombreDe(rolDestacamento)}
            </Box>
            .
          </Typography>

          <Divider sx={{ borderStyle: 'dashed' }} />

          <Stack direction="row" spacing={1}>
            <LoadingButton
              fullWidth
              variant="contained"
              loading={guardando}
              onClick={() => aplicar()}
            >
              Aplicar
            </LoadingButton>

            <Button
              fullWidth
              color="inherit"
              variant="outlined"
              disabled={guardando || !combinacionActiva}
              onClick={() => aplicar({ apagar: true })}
            >
              Desactivar
            </Button>
          </Stack>
        </Stack>
      </CustomPopover>
    </>
  );
}

// Peso de los niveles, expuesto para quien necesite ordenar igual que aqui.
export { PESO_NIVEL };
