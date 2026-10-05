'use client';


import { useMemo, useState, useEffect } from 'react';
import { getDocs, collection } from 'firebase/firestore';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useAccesosDesigner } from 'src/hooks/use-accesos-designer';

import {
  idDeRegla,
  sanearRegla,
  TIPOS_DE_REGLA,
  ACCIONES_DESIGNER,
  PESTANAS_DESIGNER,
} from 'src/utils/accesos-designer.mjs';

import { FIRESTORE } from 'src/lib/firebase';
import { getMembers } from 'src/services/member-service';
import { COLECCIONES } from 'src/config/esquema-firestore.mjs';
import { guardarAccesosDesigner } from 'src/services/accesos-designer-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useAuthContext } from 'src/auth/hooks';
import { ROLES_CATALOGO } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// EXPEDITION DESIGNER → ACCESOS (solo el Administrador Global: es quien da los
// permisos). Cada fila es una regla: a QUIÉN (un usuario con cuenta o un rol
// entero), qué PESTAÑAS ve y qué puede hacer en ellas (crear, editar,
// eliminar). Varias reglas que alcanzan a la misma persona se suman. Las reglas
// están en `src/utils/accesos-designer.mjs`; las de seguridad leen el índice que
// se guarda con ellas, así que lo que aquí no se da tampoco se puede escribir.
// ----------------------------------------------------------------------

const NOMBRE_DE_PESTANA = Object.fromEntries(PESTANAS_DESIGNER.map((p) => [p.id, p.nombre]));
const NOMBRE_DE_ACCION = Object.fromEntries(ACCIONES_DESIGNER.map((a) => [a.id, a.nombre]));
// El Administrador Global no necesita regla: lo puede todo.
const ROLES_ELEGIBLES = ROLES_CATALOGO.filter(
  (rol) => rol.activo !== false && rol.codigo !== 'administrador_global'
);

const nombreDeMiembro = (miembro) =>
  `${miembro?.firstName ?? ''} ${miembro?.lastName ?? ''}`.replace(/\s+/g, ' ').trim();

// Las cuentas del sistema (`usuarios_roles`, una por uid) con el nombre de su
// miembro: a un usuario se le da acceso por su cuenta, que es lo que comprueban
// las reglas de seguridad.
function useCuentas(abierto) {
  const [cuentas, setCuentas] = useState(null);

  useEffect(() => {
    if (!abierto || cuentas) return undefined;
    let activo = true;

    Promise.all([getDocs(collection(FIRESTORE, COLECCIONES.usuariosRoles)), getMembers().catch(() => [])])
      .then(([instantanea, miembros]) => {
        if (!activo) return;

        const porId = new Map((miembros || []).map((m) => [String(m.id ?? m.idMiembros), m]));

        setCuentas(
          instantanea.docs
            .map((fila) => {
              const datos = fila.data();
              const uid = String(datos.uid || datos.uidUsuario || fila.id);
              const miembro = porId.get(String(datos.idMiembros ?? ''));
              const nombre = nombreDeMiembro(miembro) || datos.nombre || datos.correo || uid;

              return {
                uid,
                nombre,
                idMiembros: datos.idMiembros ? String(datos.idMiembros) : '',
                codigo: miembro?.memberId || datos.codigoMiembro || '',
              };
            })
            .filter((cuenta) => cuenta.uid)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        );
      })
      .catch(() => activo && setCuentas([]));

    return () => {
      activo = false;
    };
  }, [abierto, cuentas]);

  return cuentas;
}

const REGLA_VACIA = {
  tipo: TIPOS_DE_REGLA.rol,
  clave: '',
  nombre: '',
  pestanas: [],
  acciones: [],
};

function DialogoDeRegla({ abierto, regla, ocupadas, onCerrar, onGuardar }) {
  const [borrador, setBorrador] = useState(REGLA_VACIA);
  const cuentas = useCuentas(abierto && borrador.tipo === TIPOS_DE_REGLA.usuario);

  useEffect(() => {
    if (abierto) setBorrador(regla ? { ...regla } : REGLA_VACIA);
  }, [abierto, regla]);

  const alternar = (campo, id) =>
    setBorrador((actual) => ({
      ...actual,
      [campo]: actual[campo].includes(id)
        ? actual[campo].filter((x) => x !== id)
        : [...actual[campo], id],
    }));

  // Una regla por usuario y por rol: la que ya existe se edita en su fila.
  const repetida =
    !regla && borrador.clave && ocupadas.has(idDeRegla(borrador.tipo, borrador.clave));
  const valida = Boolean(sanearRegla(borrador)) && !repetida;
  const cuentaElegida = cuentas?.find((cuenta) => cuenta.uid === borrador.clave) || null;

  return (
    <Dialog open={abierto} onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>{regla ? 'Editar acceso' : 'Dar acceso'}</DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={borrador.tipo}
            disabled={Boolean(regla)}
            onChange={(evento, tipo) =>
              tipo &&
              setBorrador({
                ...REGLA_VACIA,
                tipo,
                pestanas: borrador.pestanas,
                acciones: borrador.acciones,
              })
            }
          >
            <ToggleButton value={TIPOS_DE_REGLA.rol}>
              <Iconify icon="solar:users-group-rounded-bold" width={18} sx={{ mr: 1 }} />A un rol
            </ToggleButton>
            <ToggleButton value={TIPOS_DE_REGLA.usuario}>
              <Iconify icon="solar:user-bold" width={18} sx={{ mr: 1 }} />A un usuario
            </ToggleButton>
          </ToggleButtonGroup>

          {borrador.tipo === TIPOS_DE_REGLA.rol ? (
            <TextField
              select
              label="Rol"
              value={borrador.clave}
              disabled={Boolean(regla)}
              onChange={(evento) => {
                const rol = ROLES_ELEGIBLES.find((r) => r.codigo === evento.target.value);
                setBorrador((actual) => ({
                  ...actual,
                  clave: rol?.codigo || '',
                  nombre: rol?.nombre || '',
                }));
              }}
              helperText="Todos los que ejercen ese rol, sea o no su cargo principal."
            >
              {ROLES_ELEGIBLES.map((rol) => (
                <MenuItem key={rol.codigo} value={rol.codigo}>
                  {rol.nombre}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Autocomplete
              options={cuentas || []}
              loading={cuentas === null}
              disabled={Boolean(regla)}
              value={
                cuentaElegida ||
                (regla ? { uid: regla.clave, nombre: regla.nombre, codigo: '' } : null)
              }
              onChange={(evento, cuenta) =>
                setBorrador((actual) => ({
                  ...actual,
                  clave: cuenta?.uid || '',
                  nombre: cuenta?.nombre || '',
                  idMiembros: cuenta?.idMiembros || '',
                }))
              }
              getOptionLabel={(cuenta) => cuenta?.nombre || ''}
              isOptionEqualToValue={(a, b) => a.uid === b?.uid}
              renderOption={(props, cuenta) => {
                const { key, ...resto } = props;

                return (
                  <li key={cuenta.uid || key} {...resto}>
                    <Stack>
                      <Typography variant="body2">{cuenta.nombre}</Typography>
                      {cuenta.codigo && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {cuenta.codigo}
                        </Typography>
                      )}
                    </Stack>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Usuario"
                  helperText="Solo personas con cuenta en el sistema."
                />
              )}
            />
          )}

          {repetida && (
            <Typography variant="caption" sx={{ color: 'error.main' }}>
              Ya tiene una regla: edítala en su fila.
            </Typography>
          )}

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Pestañas que ve
            </Typography>
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' } }}
            >
              {PESTANAS_DESIGNER.map((pestana) => (
                <FormControlLabel
                  key={pestana.id}
                  label={pestana.nombre}
                  control={
                    <Checkbox
                      checked={borrador.pestanas.includes(pestana.id)}
                      onChange={() => alternar('pestanas', pestana.id)}
                    />
                  }
                />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Qué puede hacer en ellas
            </Typography>
            <Stack direction="row" spacing={1}>
              {ACCIONES_DESIGNER.map((accion) => (
                <FormControlLabel
                  key={accion.id}
                  label={accion.nombre}
                  control={
                    <Checkbox
                      checked={borrador.acciones.includes(accion.id)}
                      onChange={() => alternar('acciones', accion.id)}
                    />
                  }
                />
              ))}
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Sin ninguna, solo ve. En Portada y Tarjeta cuenta «Editar» (editar y publicar); en
              Cintas, Medallas y Pines, las tres. Cambiar el orden y dar accesos siguen siendo del
              Administrador Global.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={!valida}
          onClick={() => onGuardar(sanearRegla(borrador))}
        >
          {regla ? 'Guardar' : 'Dar acceso'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function EverestAccesos() {
  const { user } = useAuthContext();
  const reglas = useAccesosDesigner();
  const [dialogo, setDialogo] = useState(null); // null | 'nueva' | regla
  const [quitando, setQuitando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const ocupadas = useMemo(() => new Set(reglas.map((regla) => regla.id)), [reglas]);

  const guardar = async (siguientes, mensaje) => {
    setGuardando(true);
    try {
      await guardarAccesosDesigner({ reglas: siguientes, anteriores: reglas, usuario: user });
      toast.success(mensaje);
      return true;
    } catch (error) {
      toast.error(error?.message || 'No se pudieron guardar los accesos.');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const guardarRegla = async (regla) => {
    const siguientes = reglas.some((r) => r.id === regla.id)
      ? reglas.map((r) => (r.id === regla.id ? regla : r))
      : [...reglas, regla];

    if (await guardar(siguientes, `Acceso guardado: ${regla.nombre}.`)) setDialogo(null);
  };

  const quitarRegla = async () => {
    if (
      await guardar(
        reglas.filter((r) => r.id !== quitando.id),
        `Acceso retirado: ${quitando.nombre}.`
      )
    ) {
      setQuitando(null);
    }
  };

  return (
    <Card sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6">Accesos</Typography>
            <Label color="info">{reglas.length}</Label>
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Quién entra a EXPEDITION Designer, qué pestañas ve y qué puede hacer en ellas. Se da a un
            usuario concreto o a un rol entero; si a una persona la alcanzan varias reglas, se
            suman. El Administrador Global lo puede todo siempre y es el único que ve esta pestaña.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Iconify icon="mingcute:add-line" />}
          disabled={guardando}
          onClick={() => setDialogo('nueva')}
          sx={{ alignSelf: { sm: 'flex-start' }, flexShrink: 0 }}
        >
          Dar acceso
        </Button>
      </Stack>

      {reglas.length ? (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>A quién</TableCell>
                <TableCell>Pestañas</TableCell>
                <TableCell>Puede</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {reglas.map((regla) => (
                <TableRow key={regla.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Iconify
                        width={18}
                        icon={
                          regla.tipo === TIPOS_DE_REGLA.rol
                            ? 'solar:users-group-rounded-bold'
                            : 'solar:user-bold'
                        }
                        sx={{ color: 'text.secondary', flexShrink: 0 }}
                      />
                      <Box>
                        <Typography variant="subtitle2">{regla.nombre}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {regla.tipo === TIPOS_DE_REGLA.rol ? 'Rol' : 'Usuario'}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                      {regla.pestanas.map((id) => (
                        <Label key={id} variant="soft">
                          {NOMBRE_DE_PESTANA[id]}
                        </Label>
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                      {regla.acciones.length ? (
                        regla.acciones.map((id) => (
                          <Label
                            key={id}
                            variant="soft"
                            color={id === 'eliminar' ? 'error' : 'primary'}
                          >
                            {NOMBRE_DE_ACCION[id]}
                          </Label>
                        ))
                      ) : (
                        <Label variant="soft">Solo ver</Label>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <IconButton
                      size="small"
                      aria-label={`Editar el acceso de ${regla.nombre}`}
                      disabled={guardando}
                      onClick={() => setDialogo(regla)}
                    >
                      <Iconify icon="solar:pen-bold" width={17} />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Quitar el acceso de ${regla.nombre}`}
                      disabled={guardando}
                      onClick={() => setQuitando(regla)}
                    >
                      <Iconify icon="solar:trash-bin-trash-bold" width={17} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nadie más que el Administrador Global entra a EXPEDITION Designer.
        </Typography>
      )}

      <DialogoDeRegla
        abierto={Boolean(dialogo)}
        regla={dialogo && dialogo !== 'nueva' ? dialogo : null}
        ocupadas={ocupadas}
        onCerrar={() => !guardando && setDialogo(null)}
        onGuardar={guardarRegla}
      />

      <ConfirmDialog
        open={Boolean(quitando)}
        onClose={() => setQuitando(null)}
        title={`Quitar el acceso de ${quitando?.nombre || ''}`}
        content="Deja de ver esas pestañas al momento. Si también le llega por otra regla (su rol), la conserva por esa."
        action={
          <Button variant="contained" color="error" loading={guardando} onClick={quitarRegla}>
            Quitar
          </Button>
        }
      />
    </Card>
  );
}
