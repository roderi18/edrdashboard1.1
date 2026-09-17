'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { rolesQueEjerce } from 'src/utils/org-level-access';
import { puedeMarcarFallecido } from 'src/utils/estatus-miembro-avisos.mjs';
import { ESTATUS_MIEMBRO, opcionEstatusMiembro } from 'src/utils/estatus-miembro.mjs';

import { guardarEstatusManual } from 'src/services/estatus-miembros-service';

import { toast } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

// CAMBIAR EL ESTATUS A MANO: MOTIVO SIEMPRE, Y "FALLECIDO" ESCRIBIENDO EL NOMBRE.
//
// El estatus se mueve solo con la asistencia, así que un cambio a mano es una
// excepción: sin motivo, la Oficina Nacional recibe "Juan pasó a Inactivo" y no
// sabe por qué. "Fallecido" además avisa a media organización y la asistencia no
// lo revierte: se confirma escribiendo el nombre para que no salga de un clic.
export function MemberEstatusDialog({ miembro = {}, estatus, onClose, onGuardado }) {
  const { user } = useAuthContext();
  const [motivo, setMotivo] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const opcion = opcionEstatusMiembro(estatus);
  const esFallecido = opcion.value === ESTATUS_MIEMBRO.FALLECIDO;
  const nombre = String(
    miembro?.nombreMiembro || `${miembro?.nombres ?? ''} ${miembro?.apellidos ?? ''}`.trim()
  ).trim();
  const cargos = rolesQueEjerce(user);
  const permitido = !esFallecido || puedeMarcarFallecido(cargos);
  const nombreEscrito = !esFallecido || confirmacion.trim().toLowerCase() === nombre.toLowerCase();

  const guardar = async () => {
    try {
      setGuardando(true);
      await guardarEstatusManual({
        miembro,
        estatus: opcion.value,
        motivo,
        cargos,
        usuario: user,
      });
      toast.success(`Estatus cambiado a "${opcion.label}".`);
      onGuardado?.(opcion.value);
      onClose();
    } catch (error) {
      console.error('[estatus] no se pudo cambiar a mano', error);
      toast.error(error?.message || 'No se pudo cambiar el estatus.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={guardando ? undefined : onClose}>
      <DialogTitle>Cambiar a &quot;{opcion.label}&quot;</DialogTitle>

      <DialogContent>
        {!permitido ? (
          <Alert severity="warning">
            Solo el Coordinador de Destacamento, su Asistente y el Administrador Global pueden
            marcar &quot;Fallecido&quot;.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {opcion.descripcion}
            </Typography>

            {esFallecido && (
              <Alert severity="error">
                Este cambio avisa a la Oficina Nacional, al Administrador Global y al Consejo
                Ejecutivo, y la asistencia no lo revierte. Solo el Administrador Global puede
                deshacerlo.
              </Alert>
            )}

            <Alert severity="info">
              La regla de asistencia respetará este cambio durante 30 días.
            </Alert>

            <TextField
              fullWidth
              multiline
              minRows={2}
              value={motivo}
              label="Motivo del cambio"
              placeholder="Se mudó de ciudad, falleció el 12/09, habló con el coordinador…"
              helperText="Queda en Historial y en el aviso que reciben los cargos."
              onChange={(evento) => setMotivo(evento.target.value)}
            />

            {esFallecido && (
              <TextField
                fullWidth
                value={confirmacion}
                label={`Escribe "${nombre}" para confirmar`}
                onChange={(evento) => setConfirmacion(evento.target.value)}
              />
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={guardando} color="inherit">
          Cancelar
        </Button>
        {permitido && (
          <Button
            variant="contained"
            color={esFallecido ? 'error' : 'primary'}
            loading={guardando}
            disabled={!motivo.trim() || !nombreEscrito}
            onClick={guardar}
          >
            Confirmar cambio
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
