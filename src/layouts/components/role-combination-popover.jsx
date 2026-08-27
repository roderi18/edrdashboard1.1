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
import { guardarAsignacionRolUsuario, actualizarClaimsAutorizacion } from 'src/auth/permissions';

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

const alcanceDeNivel = {
  [NIVEL_COMBINACION.destacamento]: 'destacamento',
  [NIVEL_COMBINACION.seccion]: 'seccion',
  [NIVEL_COMBINACION.region]: 'region',
  [NIVEL_COMBINACION.nacional]: 'nacional',
};

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
    async ({ apagar = false } = {}) => {
      if (!user?.uid) {
        toast.error('No se pudo identificar el usuario actual.');
        return;
      }

      const deDestacamento = ROL_COMBINABLE_POR_CODIGO[rolDestacamento];
      const acompanante = ROL_COMBINABLE_POR_CODIGO[rolAcompanante];

      if (!apagar && (!deDestacamento || !acompanante)) {
        toast.error('Elige un cargo de destacamento y un segundo cargo.');
        return;
      }

      // Al apagar se vuelve a quien de verdad es: el Administrador Global. Con
      // `cargos: []` se borra la pareja, que si no seguiria sumando permisos.
      const principal = apagar ? null : rolPrincipalDe([deDestacamento, acompanante]);
      const rolId = apagar ? ROLES.ADMINISTRADOR_GLOBAL : principal.codigo;
      const alcance = apagar
        ? { tipo: 'global', modo: 'global' }
        : { tipo: alcanceDeNivel[principal.nivel], modo: alcanceDeNivel[principal.nivel] };

      setGuardando(true);

      try {
        await guardarAsignacionRolUsuario({
          uidUsuario: user.uid,
          correo: user.email || user.correo || '',
          nombre: user.displayName || [user.nombres, user.apellidos].filter(Boolean).join(' '),
          rolId,
          rolNombre: apagar ? 'Administrador Global' : principal.nombre,
          alcance,
          cargos: apagar
            ? []
            : [
                { rol: deDestacamento.codigo, nivel: NIVEL_COMBINACION.destacamento },
                { rol: acompanante.codigo, nivel: acompanante.nivel },
              ],
          simulacion: apagar
            ? { activa: false }
            : {
                activa: true,
                rolDestacamento: deDestacamento.codigo,
                rolAcompanante: acompanante.codigo,
                volverA: ROLES.ADMINISTRADOR_GLOBAL,
              },
          usuario: user,
        });

        try {
          await actualizarClaimsAutorizacion({
            uidUsuario: user.uid,
            correo: user.email || user.correo || '',
          });
        } catch (claimsError) {
          console.warn('[roles combinados] no se pudieron actualizar los claims', claimsError);
        }

        window.location.reload();
      } catch (error) {
        console.error('[roles combinados] no se pudo aplicar la combinación', error);
        setGuardando(false);
        toast.error(error?.message || 'No se pudo aplicar la combinación.');
      }
    },
    [rolAcompanante, rolDestacamento, user]
  );

  const nombreDe = (codigo) => ROL_COMBINABLE_POR_CODIGO[codigo]?.nombre || '';

  return (
    <>
      <ButtonBase
        disableRipple
        onClick={popover.onOpen}
        sx={[
          (theme) => ({
            py: 0.5,
            px: 1,
            gap: 1,
            borderRadius: 1,
            typography: 'subtitle2',
            border: `dashed 1px ${theme.vars.palette.divider}`,
            ...(combinacionActiva && {
              borderStyle: 'solid',
              borderColor: theme.vars.palette.warning.main,
            }),
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        <Iconify width={18} icon="solar:users-group-rounded-bold-duotone" />

        <Box component="span" sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
          {combinacionActiva
            ? `${nombreDe(combinacionActiva.destacamento)} + ${nombreDe(combinacionActiva.acompanante)}`
            : 'Roles combinados'}
        </Box>

        {combinacionActiva && <Chip size="small" color="warning" variant="soft" label="Prueba" />}

        <Iconify width={16} icon="eva:arrow-ios-downward-fill" />
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
              encendida, esta sesión deja de ser Administrador Global.
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
