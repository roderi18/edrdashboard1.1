'use client';

import { useState } from 'react';

import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';

import { TIPOS_INSIGNIA } from 'src/utils/insignias-personalizadas.mjs';
import { puedeEditarInsignia, puedeEliminarInsignia } from 'src/utils/org-level-access';

import { eliminarInsignia } from 'src/services/insignias-personalizadas-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useAuthContext } from 'src/auth/hooks';

import { AgregarInsigniaDialog } from './agregar-insignia-dialog';

// ----------------------------------------------------------------------
// EDITAR Y ELIMINAR UNA CINTA, MEDALLA O PIN (todas, también las de fábrica).
//
// El lápiz y la papelera salen según los permisos de esa pestaña (EXPLORA
// Designer → Accesos). Eliminar no borra nada: deja de pintarse en el Designer y
// en los perfiles (ver `insignias-personalizadas.mjs`).
// ----------------------------------------------------------------------

const NOMBRE = {
  [TIPOS_INSIGNIA.CINTA]: 'la cinta',
  [TIPOS_INSIGNIA.MEDALLA]: 'la medalla',
  [TIPOS_INSIGNIA.PIN]: 'el pin',
};

const BOTON = { p: 0.25 };

export function AccionesDeInsignia({ tipo, insignia, deshabilitado = false }) {
  const { user } = useAuthContext();
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const puedeEditar = puedeEditarInsignia(user, tipo);
  const puedeEliminar = puedeEliminarInsignia(user, tipo);

  if (!puedeEditar && !puedeEliminar) return null;

  const eliminar = async () => {
    setEliminando(true);
    try {
      await eliminarInsignia({ tipo, insignia, usuario: user });
      toast.success(`Se eliminó ${NOMBRE[tipo]} "${insignia.nombre}".`);
      setConfirmar(false);
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar.');
    } finally {
      setEliminando(false);
    }
  };

  return (
    <>
      {puedeEditar && (
        <IconButton
          size="small"
          aria-label={`Editar ${insignia.nombre}`}
          disabled={deshabilitado}
          onClick={() => setEditando(true)}
          sx={BOTON}
        >
          <Iconify icon="solar:pen-bold" width={15} />
        </IconButton>
      )}

      {puedeEliminar && (
        <IconButton
          size="small"
          color="error"
          aria-label={`Eliminar ${insignia.nombre}`}
          disabled={deshabilitado}
          onClick={() => setConfirmar(true)}
          sx={BOTON}
        >
          <Iconify icon="solar:trash-bin-trash-bold" width={15} />
        </IconButton>
      )}

      {editando && (
        <AgregarInsigniaDialog
          tipo={tipo}
          open={editando}
          insignia={insignia}
          onClose={() => setEditando(false)}
        />
      )}

      <ConfirmDialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title={`Eliminar ${NOMBRE[tipo]} "${insignia.nombre}"`}
        content="Deja de verse en EXPEDITION Designer, en los perfiles y al asignarlas. Queda en Historial."
        action={
          <Button variant="contained" color="error" loading={eliminando} onClick={eliminar}>
            Eliminar
          </Button>
        }
      />
    </>
  );
}
