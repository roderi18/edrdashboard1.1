'use client';

import { useState, useEffect } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { canViewMemberSensitiveData } from 'src/utils/member-access';

import {
  solicitarAccesoInformacionMiembro,
  obtenerCoordinadorDestacamentoInfo,
} from 'src/services/member-info-access-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// Banner que se muestra debajo de los tabs de la ficha del miembro a los usuarios
// que ven la información personal enmascarada. Permite solicitar acceso al
// Coordinador de Destacamento del miembro (se le notifica por su nombre).
// ----------------------------------------------------------------------

export function MemberSensitiveInfoBanner({ member }) {
  const { user } = useAuthContext();
  const open = useBoolean();
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [coordinador, setCoordinador] = useState(null);

  const destId = member?.destId || member?.idDestacamento || null;

  // Solo se muestra a quienes NO pueden ver los datos sensibles del miembro.
  const shouldShow = Boolean(member) && !canViewMemberSensitiveData(user);

  useEffect(() => {
    if (!shouldShow || !destId) return undefined;

    let cancelled = false;

    obtenerCoordinadorDestacamentoInfo(destId)
      .then((info) => {
        if (!cancelled) setCoordinador(info);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [shouldShow, destId]);

  if (!shouldShow) return null;

  const trimmedReason = reason.trim();

  const handleSend = async () => {
    if (!trimmedReason) return;

    setSending(true);
    try {
      const { nombreCoordinador } = await solicitarAccesoInformacionMiembro({
        member,
        usuario: user,
        justificacion: trimmedReason,
      });

      toast.success(`Solicitud enviada a ${nombreCoordinador}.`);
      setReason('');
      open.onFalse();
    } catch (error) {
      toast.error(error?.message || 'No se pudo enviar la solicitud.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Alert
      severity="info"
      icon={<Iconify icon="solar:lock-keyhole-bold" />}
      sx={{ mb: 3 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography variant="body2">
          Parte de la información de este miembro está oculta por motivos de seguridad.
        </Typography>

        <Button
          size="small"
          variant="outlined"
          color="info"
          startIcon={<Iconify icon="solar:key-bold" />}
          onClick={open.onToggle}
          sx={{ flexShrink: 0 }}
        >
          Solicitar acceso
        </Button>
      </Stack>

      <Collapse in={open.value}>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Razón de la solicitud"
            placeholder="Explica por qué necesitas ver esta información."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            inputProps={{ maxLength: 1000 }}
          />

          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 1.5, alignItems: 'center', justifyContent: 'flex-end' }}
          >
            {coordinador?.nombre && (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
                Se notificará a {coordinador.nombre} (Coordinador de Destacamento).
              </Typography>
            )}

            <Button size="small" color="inherit" onClick={open.onFalse} disabled={sending}>
              Cancelar
            </Button>
            <Button
              size="small"
              variant="contained"
              loading={sending}
              disabled={!trimmedReason}
              onClick={handleSend}
            >
              Enviar notificación
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Alert>
  );
}
