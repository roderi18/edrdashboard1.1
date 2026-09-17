'use client';

import { toast } from 'sonner';
import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

import { guardarSesionComoUsuario } from 'src/utils/sesion-como-usuario';

import axios from 'src/lib/axios';
import { AUTH } from 'src/lib/firebase';

import { signInWithCustomToken } from 'src/auth/components/context/firebase/action';

export function ProbarComoUsuarioDialog({ open, onClose }) {
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorVisible, setErrorVisible] = useState('');

  useEffect(() => {
    if (open) return;
    setCodigo('');
    setEnviando(false);
    setErrorVisible('');
  }, [open]);

  const entrar = async () => {
    const codigoMiembro = codigo.trim().toUpperCase();
    if (!codigoMiembro) return;

    setEnviando(true);
    setErrorVisible('');
    try {
      const idToken = await AUTH?.currentUser?.getIdToken();
      if (!idToken) throw new Error('No se pudo verificar tu sesión administrativa.');

      const { data: result } = await axios.post(
        '/api/admin/probar-como-usuario',
        {
          accion: 'entrar',
          codigoMiembro,
        },
        {
          // Esta ruta pertenece a la aplicación Next, no al API externo
          // configurado como base general de Axios.
          baseURL: window.location.origin,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        }
      );

      guardarSesionComoUsuario(result.miembro);
      await signInWithCustomToken({ token: result.token });
      window.location.assign('/dashboard/user/account/');
    } catch (error) {
      const mensaje =
        error?.response?.data?.error || error?.message || 'No se pudo abrir la cuenta del miembro.';
      setErrorVisible(mensaje);
      toast.error(mensaje);
      setEnviando(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={enviando ? undefined : onClose}>
      <DialogTitle>Probar como usuario</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Abre la sesión real del miembro sin cambiar su contraseña ni sus permisos.
        </DialogContentText>
        {errorVisible && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorVisible}
          </Alert>
        )}
        <TextField
          autoFocus
          fullWidth
          label="Código de miembro"
          placeholder="EDR-10002"
          value={codigo}
          disabled={enviando}
          onChange={(event) => setCodigo(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') entrar();
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={entrar}
          disabled={enviando || !codigo.trim()}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
