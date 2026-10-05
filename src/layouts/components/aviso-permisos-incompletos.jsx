'use client';

import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

/**
 * Avisa cuando la sesion se quedo sin sus cargos y permisos completos.
 *
 * Antes eso no se decia: una lectura lenta dejaba la sesion "a medias" y las
 * opciones de administrador no aparecian, sin error ni pista, hasta recargar o
 * limpiar la cache. Ahora el proveedor reintenta solo; si aun asi no llega,
 * este aviso lo dice y deja reintentar sin recargar la pagina.
 */
export function AvisoPermisosIncompletos() {
  const { permisosIncompletos, checkUserSession } = useAuthContext();
  const [reintentando, setReintentando] = useState(false);

  if (!permisosIncompletos) return null;

  const reintentar = async () => {
    setReintentando(true);

    try {
      await checkUserSession();
    } finally {
      setReintentando(false);
    }
  };

  return (
    <Alert
      severity="warning"
      sx={{ borderRadius: 0, alignItems: 'center' }}
      action={
        <Button color="inherit" size="small" onClick={reintentar} disabled={reintentando}>
          {reintentando ? 'Reintentando…' : 'Reintentar'}
        </Button>
      }
    >
      No se pudieron cargar todos tus permisos y puede que falten opciones.
    </Alert>
  );
}
