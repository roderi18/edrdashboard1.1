'use client';

import { useMemo, useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { ROLES_DE_ADMINISTRACION } from 'src/utils/admin-role-label';

import { ROLES_POR_CODIGO } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// QUE CARGO SE LE DA, NO SOLO "SI O NO".
//
// Aqui habia un "¿Realmente quieres asignar a Fulano como administrador?" con un
// boton de Asignar, y lo que hacia era nombrarlo ADMINISTRADOR GLOBAL sin
// preguntar: el cargo con mas poder de la plataforma se daba con un si.
//
// Ahora se elige, y solo entre los cuatro cargos de administracion, que son los
// que se reparten desde estas pantallas. Los organizacionales se ponen en la
// ficha del miembro y en las directivas, donde se ve sobre que entidad se ponen.
// ----------------------------------------------------------------------

const OPCIONES = ROLES_DE_ADMINISTRACION.map((codigo) => ({
  codigo,
  nombre: ROLES_POR_CODIGO[codigo]?.nombre || codigo,
  descripcion: ROLES_POR_CODIGO[codigo]?.descripcion || '',
}));

// El de menos poder por defecto. Que el desplegable abriera en Administrador
// Global convertia un despiste en la llave de todo.
const POR_DEFECTO = 'administrador_tienda';

export function AdminAsignarCargoDialog({ open, personas = [], guardando = false, onClose, onConfirm }) {
  const [rolId, setRolId] = useState(POR_DEFECTO);

  // Cada vez que se abre vuelve al de menos poder: dejar el de la ultima vez
  // hacia que el segundo nombramiento heredara en silencio la eleccion anterior.
  useEffect(() => {
    if (open) setRolId(POR_DEFECTO);
  }, [open]);

  const seleccionado = useMemo(
    () => OPCIONES.find((opcion) => opcion.codigo === rolId) || OPCIONES[0],
    [rolId]
  );

  const cuantos = personas.length;
  const aQuien =
    cuantos === 1
      ? personas[0]?.name || 'esta persona'
      : `${cuantos} personas`;

  return (
    <Dialog open={open} onClose={guardando ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Asignar cargo de administración</DialogTitle>

      <DialogContent>
        <Stack sx={{ gap: 2.5, pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Se le dará a <strong>{aQuien}</strong>. Recibirá un aviso con el cargo nuevo.
          </Typography>

          <TextField
            select
            fullWidth
            label="Cargo"
            value={rolId}
            onChange={(event) => setRolId(event.target.value)}
            disabled={guardando}
          >
            {OPCIONES.map((opcion) => (
              <MenuItem key={opcion.codigo} value={opcion.codigo}>
                {opcion.nombre}
              </MenuItem>
            ))}
          </TextField>

          {seleccionado?.descripcion ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {seleccionado.descripcion}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={guardando}>
          Cancelar
        </Button>

        <Button
          variant="contained"
          loading={guardando}
          onClick={() => onConfirm?.(rolId)}
          disabled={!rolId}
        >
          Asignar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
