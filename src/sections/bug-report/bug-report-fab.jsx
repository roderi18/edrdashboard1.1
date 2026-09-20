'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { usePathname } from 'src/routes/hooks';

import { enviarReporteProblema } from 'src/services/bug-report-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

export function BugReportFab({ pathname: pathnameProp = '', compact = false }) {
  const { user } = useAuthContext();
  const currentPathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const pathname = pathnameProp || currentPathname || '';
  if (!user?.accessToken) return null;

  const enviarReporte = async (event) => {
    event.preventDefault();
    if (!mensaje.trim()) {
      setError('Cuéntanos brevemente qué problema encontraste.');
      return;
    }

    setEnviando(true);
    setError('');
    try {
      await enviarReporteProblema({ mensaje, ruta: pathname });
      toast.success('Reporte enviado a los Administradores Globales.');
      setMensaje('');
      setOpen(false);
    } catch (sendError) {
      const message = sendError?.message || 'No se pudo enviar el reporte.';
      setError(message);
      toast.error(message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button
        fullWidth={!compact}
        color="error"
        variant="contained"
        aria-label="Reportar un problema"
        title="Reportar bug"
        onClick={() => setOpen(true)}
        startIcon={!compact && <Iconify icon="solar:bug-bold" width={21} />}
        sx={{
          minWidth: compact ? 40 : undefined,
          px: compact ? 1 : 2,
          py: 1,
          boxShadow: (theme) => `0 3px 12px ${theme.vars.palette.error.main}55`,
        }}
      >
        {compact ? <Iconify icon="solar:bug-bold" width={22} /> : 'Reportar bug'}
      </Button>

      <Dialog open={open} onClose={() => !enviando && setOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={enviarReporte}>
          <DialogTitle sx={{ pb: 0.75 }}>Reportar bug</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Redacta el problema. Este reporte será atendido en un plazo de 24 horas y se te informará cuando esté solucionado.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={4}
              maxRows={10}
              label="Reportar problema"
              placeholder="Describe el problema que encontraste…"
              value={mensaje}
              onChange={(event) => setMensaje(event.target.value.slice(0, 4000))}
              inputProps={{ maxLength: 4000, 'aria-label': 'Reportar problema' }}
              disabled={enviando}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setOpen(false)} disabled={enviando}>Cancelar</Button>
            <Button type="submit" variant="contained" color="error" startIcon={<Iconify icon="solar:bug-bold" />} disabled={enviando || !mensaje.trim()}>
              {enviando ? 'Enviando…' : 'Enviar reporte'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
