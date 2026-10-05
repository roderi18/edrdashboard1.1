'use client';

import { useState } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { LARGO_NOMBRE_CASILLA, limpiarNombreCasilla } from 'src/utils/casillas-personalizadas.mjs';

import {
  renombrarCasillaPersonalizada,
  renombrarContenedorDeDirectiva,
} from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// LOS TRES PUNTITOS DE UN CONTENEDOR ("Consejo Nacional", "Consejo Ejecutivo",
// una división…) en la Jerarquía de los cuatro organigramas.
//
// "Cambiar nombre" vale para TODO el nivel: cambiarlo en un destacamento lo
// cambia en todos los destacamentos; en la nacional, en la directiva actual y en
// las pasadas (comparten árbol). Es lo mismo que el panel del lápiz: el de
// fábrica deja una ficha `nombre`, el añadido se renombra
// (`casillas-personalizadas.mjs`). Solo el Administrador Global, como todo lo
// que cambia la forma de los organigramas.
// ----------------------------------------------------------------------

const PREFIJO_ANADIDA = 'casilla-';

const NOMBRE_DEL_NIVEL = {
  nacional: 'la Directiva Nacional (actual y anteriores)',
  regional: 'todas las regiones',
  seccional: 'todas las secciones',
  destacamento: 'todos los destacamentos',
};

export function MenuDeContenedor({ nivel, idNodo, nombre }) {
  const { user } = useAuthContext();
  const menu = usePopover();
  const [nombreNuevo, setNombreNuevo] = useState(null);
  const [guardando, setGuardando] = useState(false);

  if (!isAdminGlobal(user) || !idNodo) return null;

  const limpio = limpiarNombreCasilla(nombreNuevo ?? '');
  const valido =
    limpio.length >= LARGO_NOMBRE_CASILLA.minimo &&
    limpio.length <= LARGO_NOMBRE_CASILLA.maximo &&
    limpio !== nombre;

  const guardar = async () => {
    if (!valido) return;

    setGuardando(true);
    try {
      if (String(idNodo).startsWith(PREFIJO_ANADIDA)) {
        await renombrarCasillaPersonalizada({
          id: String(idNodo).slice(PREFIJO_ANADIDA.length),
          nombre: limpio,
          usuario: user,
        });
      } else {
        await renombrarContenedorDeDirectiva({ nivel, idNodo, nombre: limpio, usuario: user });
      }
      toast.success(`Ahora se llama "${limpio}" en ${NOMBRE_DEL_NIVEL[nivel] || 'este nivel'}.`);
      setNombreNuevo(null);
    } catch (error) {
      toast.error(error?.message || 'No se pudo cambiar el nombre.');
    } finally {
      setGuardando(false);
    }
  };

  // Que el clic no arrastre la tarjeta en modo edición del lápiz.
  const sinArrastre = (evento) => evento.stopPropagation();

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Opciones de ${nombre}`}
        color={menu.open ? 'inherit' : 'default'}
        onClick={menu.onOpen}
        onPointerDown={sinArrastre}
        sx={{ position: 'absolute', top: 2, right: 2, p: 0.25 }}
      >
        <Iconify icon="eva:more-horizontal-fill" width={16} />
      </IconButton>

      <CustomPopover
        open={menu.open}
        anchorEl={menu.anchorEl}
        onClose={menu.onClose}
        slotProps={{ arrow: { placement: 'left-center' } }}
      >
        <MenuList onPointerDown={sinArrastre}>
          <MenuItem
            onClick={() => {
              menu.onClose();
              setNombreNuevo(nombre || '');
            }}
          >
            <Iconify icon="solar:pen-bold" />
            Cambiar nombre
          </MenuItem>
        </MenuList>
      </CustomPopover>

      <Dialog
        open={nombreNuevo !== null}
        onClose={() => !guardando && setNombreNuevo(null)}
        fullWidth
        maxWidth="xs"
        onPointerDown={sinArrastre}
      >
        <DialogTitle>Cambiar nombre</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Nombre del contenedor"
            value={nombreNuevo ?? ''}
            onChange={(evento) => setNombreNuevo(evento.target.value)}
            onKeyDown={(evento) => evento.key === 'Enter' && guardar()}
            helperText={`Cambia en ${NOMBRE_DEL_NIVEL[nivel] || 'todo este nivel'}.`}
            slotProps={{ htmlInput: { maxLength: LARGO_NOMBRE_CASILLA.maximo } }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={guardando} onClick={() => setNombreNuevo(null)}>
            Cancelar
          </Button>
          <Button variant="contained" disabled={!valido} loading={guardando} onClick={guardar}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
