'use client';

import { toast } from 'sonner';
import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import {
  leerSesionComoUsuario,
  borrarSesionComoUsuario,
  EVENTO_SESION_COMO_USUARIO,
} from 'src/utils/sesion-como-usuario';

import axios from 'src/lib/axios';

import { signInWithCustomToken } from 'src/auth/components/context/firebase/action';

export function SesionComoUsuarioBanner() {
  const [sesion, setSesion] = useState(null);
  const [volviendo, setVolviendo] = useState(false);

  useEffect(() => {
    const actualizar = () => setSesion(leerSesionComoUsuario());
    actualizar();
    window.addEventListener(EVENTO_SESION_COMO_USUARIO, actualizar);
    window.addEventListener('storage', actualizar);

    return () => {
      window.removeEventListener(EVENTO_SESION_COMO_USUARIO, actualizar);
      window.removeEventListener('storage', actualizar);
    };
  }, []);

  if (!sesion) return null;

  const volver = async () => {
    setVolviendo(true);
    try {
      const { data: result } = await axios.post(
        '/api/admin/probar-como-usuario',
        { accion: 'volver' },
        { baseURL: window.location.origin }
      );

      await signInWithCustomToken({ token: result.token });
      borrarSesionComoUsuario();
      window.location.assign('/dashboard/user/account/');
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          'No se pudo recuperar la cuenta administradora.'
      );
      setVolviendo(false);
    }
  };

  return (
    <Alert
      severity="warning"
      sx={{ borderRadius: 0, alignItems: 'center' }}
      action={
        <Button color="inherit" size="small" onClick={volver} disabled={volviendo}>
          {volviendo ? 'Volviendo…' : 'Volver a mi cuenta'}
        </Button>
      }
    >
      Estás usando la cuenta de <strong>{sesion.nombre}</strong> ({sesion.codigo}).
    </Alert>
  );
}
