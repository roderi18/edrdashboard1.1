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

// El prefijo ya escrito: todos los códigos empiezan igual y solo cambia el número.
const PREFIJO = 'EDR-';

export function ProbarComoUsuarioDialog({ open, onClose }) {
  const [codigo, setCodigo] = useState(PREFIJO);
  const [enviando, setEnviando] = useState(false);
  const [errorVisible, setErrorVisible] = useState('');

  useEffect(() => {
    if (open) return;
    setCodigo(PREFIJO);
    setEnviando(false);
    setErrorVisible('');
  }, [open]);

  const entrar = async () => {
    const codigoMiembro = codigo.trim().toUpperCase();
    // Solo el prefijo no es un código: sin número no se intenta entrar.
    if (!/\d/.test(codigoMiembro)) return;

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
          // El cursor detrás de "EDR-", para escribir el número directamente.
          onFocus={(event) => {
            const largo = event.target.value.length;
            event.target.setSelectionRange(largo, largo);
          }}
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
          disabled={enviando || !/\d/.test(codigo)}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
