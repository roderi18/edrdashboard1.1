'use client';

import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { nombreDeDestacamento } from './contexto-registro';

// ----------------------------------------------------------------------
// "AVISAR OFICINA NACIONAL": sale cuando el destacamento no puede pagar, sea
// cual sea el motivo. Pide quién avisa y cómo contactarle; el motivo lo pone
// el servidor (/api/avisos).
// ----------------------------------------------------------------------

export function BotonAvisarOficina({ destacamento }) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState({ nombre: '', correo: '', telefono: '', comentario: '' });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  const enviar = async () => {
    setEnviando(true);
    setError('');
    try {
      const r = await fetch('/api/avisos/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destacamentoId: destacamento.id, ...datos }),
      });
      const respuesta = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(respuesta.error || 'No se pudo enviar el aviso.');
      setEnviado(true);
      setAbierto(false);
      toast.success('Aviso enviado. La Oficina Nacional se pondrá en contacto contigo.');
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { sm: 'center' }, flex: 1, minWidth: 0 }}
      >
        <Button
          size="large"
          variant="outlined"
          color="primary"
          disabled={enviado}
          startIcon={<Iconify icon={enviado ? 'solar:check-circle-bold' : 'solar:letter-bold'} />}
          onClick={() => setAbierto(true)}
          sx={{ flexShrink: 0 }}
        >
          {enviado ? 'Aviso enviado' : 'Avisar Oficina Nacional'}
        </Button>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Si crees que se trata de un error, presiona el botón para avisar a la Oficina Nacional.
        </Typography>
      </Stack>

      <Dialog open={abierto} onClose={() => !enviando && setAbierto(false)} fullWidth maxWidth="sm">
        <DialogTitle>Avisar a la Oficina Nacional</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
            {nombreDeDestacamento(destacamento)} no puede pagar su membresía. Déjanos tus datos y la
            Oficina Nacional revisará el caso.
          </Typography>
          <Stack spacing={2}>
            <TextField label="Tu nombre *" value={datos.nombre} onChange={cambiar('nombre')} />
            <TextField
              type="email"
              label="Tu correo *"
              value={datos.correo}
              onChange={cambiar('correo')}
            />
            <TextField label="Teléfono" value={datos.telefono} onChange={cambiar('telefono')} />
            <TextField
              multiline
              minRows={3}
              label="¿Qué crees que está mal?"
              value={datos.comentario}
              onChange={cambiar('comentario')}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={enviando} onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            loading={enviando}
            disabled={datos.nombre.trim().length < 2 || !datos.correo.includes('@')}
            onClick={enviar}
          >
            Enviar aviso
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
