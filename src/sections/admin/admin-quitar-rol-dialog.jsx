'use client';

import { useMemo, useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Radio from '@mui/material/Radio';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { rolesDeAdministracionDe } from 'src/utils/roles-de-administracion.mjs';

import { ROLES_POR_CODIGO } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// QUITAR UN ROL DE ADMINISTRACIÓN, NO TODOS.
//
// Una persona puede tener varios (Oficina Nacional y Tienda, por ejemplo). Antes
// "Quitar administrador" los quitaba todos y la dejaba en usuario común. Ahora
// se elige cuál; "Todos" sigue existiendo. Con uno solo, es el de siempre.
// ----------------------------------------------------------------------

const TODOS = '__todos__';

export function AdminQuitarRolDialog({ open, persona, guardando = false, onClose, onConfirm }) {
  const suyos = useMemo(() => rolesDeAdministracionDe(persona ?? {}), [persona]);
  const [elegido, setElegido] = useState(TODOS);

  useEffect(() => {
    if (open) setElegido(suyos.length > 1 ? suyos[suyos.length - 1] : TODOS);
  }, [open, suyos]);

  const nombre = persona?.name || 'este usuario';
  const quitaTodos = elegido === TODOS || suyos.length <= 1;

  return (
    <Dialog open={open} onClose={guardando ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Quitar rol de administración</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {suyos.length > 1 ? (
            <>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                <strong>{nombre}</strong> tiene varios roles. Elige cuál quitar; conservará los
                demás.
              </Typography>
              <RadioGroup value={elegido} onChange={(event) => setElegido(event.target.value)}>
                {suyos.map((codigo) => (
                  <FormControlLabel
                    key={codigo}
                    value={codigo}
                    control={<Radio />}
                    label={ROLES_POR_CODIGO[codigo]?.nombre || codigo}
                    disabled={guardando}
                  />
                ))}
                <FormControlLabel
                  value={TODOS}
                  control={<Radio />}
                  label="Todos (pasa a usuario común)"
                  disabled={guardando}
                />
              </RadioGroup>
            </>
          ) : (
            <Typography variant="body2">
              ¿Realmente quieres quitar administrador a <strong>{nombre}</strong>? Al confirmar
              pasará a usuario común.
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={guardando}>
          Cancelar
        </Button>
        <Button
          color="error"
          variant="contained"
          loading={guardando}
          onClick={() => onConfirm?.(quitaTodos ? '' : elegido)}
        >
          {quitaTodos ? 'Quitar administrador' : 'Quitar este rol'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
