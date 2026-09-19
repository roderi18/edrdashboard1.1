'use client';

import { useState } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import {
  MAXIMO_NOMBRE_CATEGORIA_PRODUCTO,
  validarCategoriaProductoNueva,
} from 'src/utils/producto-categorias-personalizadas.mjs';

import { crearCategoriaProducto } from 'src/services/producto-categorias-service';

import { toast } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// AGREGAR UNA CATEGORÍA DE PRODUCTO desde /product/new ("+ Nuevo").
//
// Solo el nombre: el id que la identifica en `product.category` sale de él
// (`slugificarCategoriaProducto`). Al guardarla queda elegida en el propio
// formulario y aparece en el desplegable de Categoría de todos los que abran la
// pantalla, y en la columna de Categorías de `/product`.
// ----------------------------------------------------------------------

export function AgregarCategoriaDialog({ open, onClose, onCreada }) {
  const { user } = useAuthContext();
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [intentado, setIntentado] = useState(false);

  const cerrar = () => {
    if (guardando) return;

    setNombre('');
    setIntentado(false);
    onClose();
  };

  const error = validarCategoriaProductoNueva(nombre);

  const guardar = async () => {
    setIntentado(true);

    if (error) return;

    setGuardando(true);

    try {
      const categoria = await crearCategoriaProducto({ nombre, usuario: user });

      toast.success('Categoría agregada.');
      onCreada(categoria);
      setNombre('');
      setIntentado(false);
    } catch (fallo) {
      console.error('[categorias-producto] no se pudo agregar', fallo);
      toast.error(fallo?.message || 'No se pudo agregar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} fullWidth maxWidth="xs" onClose={guardando ? undefined : cerrar}>
      <DialogTitle>Agregar categoría</DialogTitle>

      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Nombre"
          value={nombre}
          disabled={guardando}
          onChange={(evento) => setNombre(evento.target.value)}
          error={intentado && !!error}
          helperText={
            (intentado && error) || 'Sale en el desplegable de Categoría y en la lista de productos.'
          }
          sx={{ mt: 1 }}
          slotProps={{ htmlInput: { maxLength: MAXIMO_NOMBRE_CATEGORIA_PRODUCTO } }}
        />
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Agregar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
