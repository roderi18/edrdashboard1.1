'use client';

import { useState, useEffect } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { usePathname } from 'src/routes/hooks';

import {
  canViewMemberAwardsTab,
  canViewMemberParentsTab,
  canViewMemberHistoryTab,
  canViewMemberSensitiveData,
  isConsejoNacionalHealthViewer,
} from 'src/utils/member-access';

import {
  solicitarAccesoInformacionMiembro,
  obtenerCoordinadorDestacamentoInfo,
} from 'src/services/member-info-access-service';
import {
  esMiembroMenorDeEdad,
  obtenerEstadoAccesoSalud,
  crearSolicitudAccesoSalud,
} from 'src/services/member-health-access-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// Aviso de "información oculta por motivos de seguridad" + solicitud de acceso al
// Coordinador de Destacamento del miembro (se le notifica por su nombre).
//
// Se muestra en las pestañas de la ficha donde el usuario NO tiene acceso pleno al
// contenido (General, Dispensa Médica, Padres, Historial). En Sistema de Ascenso,
// si el usuario puede verlo (p. ej. el Director Nacional), NO aparece.
// ----------------------------------------------------------------------

const HIDDEN_INFO_TEXT = 'Parte de la información de este miembro está oculta por motivos de seguridad, ya que es menor de edad.';

// ¿El usuario tiene restringido el contenido de la pestaña actual? (Entonces se
// muestra el aviso.) Cada ruta se evalúa contra su permiso correspondiente.
const isRestrictedForRoute = (user, pathname = '') => {
  // En Dispensa Médica, los cargos del Consejo Nacional solicitan acceso
  // únicamente a los datos del seguro enmascarados para miembros menores.
  if (pathname.includes('/edit/health')) return isConsejoNacionalHealthViewer(user);
  if (pathname.includes('/edit/awards')) return !canViewMemberAwardsTab(user);
  if (pathname.includes('/edit/parents')) return !canViewMemberParentsTab(user);
  if (pathname.includes('/edit/history')) return !canViewMemberHistoryTab(user);
  // General (ficha principal): depende del acceso a los datos sensibles.
  return !canViewMemberSensitiveData(user);
};

// ----------------------------------------------------------------------

// Formulario en línea (colapsable) para justificar y enviar la solicitud.
function AccessRequestForm({ coordinador, sending, onCancel, onSend }) {
  const [reason, setReason] = useState('');
  const trimmedReason = reason.trim();

  return (
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

        <Button size="small" color="inherit" onClick={onCancel} disabled={sending}>
          Cancelar
        </Button>
        <Button
          size="small"
          variant="contained"
          loading={sending}
          disabled={!trimmedReason}
          onClick={() => onSend(trimmedReason)}
        >
          Enviar notificación
        </Button>
      </Stack>
    </Box>
  );
}

// ----------------------------------------------------------------------

export function MemberSensitiveInfoBanner({ member }) {
  const { user } = useAuthContext();
  const pathname = usePathname();
  const open = useBoolean();
  const [sending, setSending] = useState(false);
  const [coordinador, setCoordinador] = useState(null);
  const [healthAccessLoading, setHealthAccessLoading] = useState(false);
  const [healthAccessState, setHealthAccessState] = useState({
    permiso: null,
    solicitudPendiente: null,
  });

  const destId = member?.destId || member?.idDestacamento || null;
  const isHealthRoute = pathname.includes('/edit/health');
  const isHealthAccessRequest =
    isHealthRoute &&
    isConsejoNacionalHealthViewer(user) &&
    esMiembroMenorDeEdad(member);
  const shouldShow =
    Boolean(member) &&
    isRestrictedForRoute(user, pathname) &&
    (!isHealthRoute ||
      (isHealthAccessRequest && !healthAccessLoading && !healthAccessState.permiso));

  useEffect(() => {
    if (!isHealthAccessRequest) {
      setHealthAccessState({ permiso: null, solicitudPendiente: null });
      setHealthAccessLoading(false);
      return undefined;
    }

    let cancelled = false;
    setHealthAccessLoading(true);

    obtenerEstadoAccesoSalud({ member, usuario: user })
      .then((state) => {
        if (!cancelled) {
          setHealthAccessState({
            permiso: state?.permiso || null,
            solicitudPendiente: state?.solicitudPendiente || null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealthAccessState({ permiso: null, solicitudPendiente: null });
        }
      })
      .finally(() => {
        if (!cancelled) setHealthAccessLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isHealthAccessRequest, member, user]);

  useEffect(() => {
    if (!shouldShow || !destId) return undefined;

    let cancelled = false;

    obtenerCoordinadorDestacamentoInfo(destId)
      .then((info) => {
        if (!cancelled) setCoordinador(info);
      })
      .catch(() => { });

    return () => {
      cancelled = true;
    };
  }, [shouldShow, destId]);

  if (!shouldShow) return null;

  const handleSend = async (justificacion) => {
    setSending(true);
    try {
      if (isHealthAccessRequest) {
        const solicitud = await crearSolicitudAccesoSalud({
          member,
          usuario: user,
          justificacion,
        });

        setHealthAccessState((current) => ({
          ...current,
          solicitudPendiente: solicitud,
        }));
        toast.success('Solicitud enviada a los Coordinadores de Destacamento.');
        open.onFalse();
        return;
      }

      const { nombreCoordinador } = await solicitarAccesoInformacionMiembro({
        member,
        usuario: user,
        justificacion,
      });

      toast.success(`Solicitud enviada a ${nombreCoordinador}.`);
      open.onFalse();
    } catch (error) {
      toast.error(error?.message || 'No se pudo enviar la solicitud.');
    } finally {
      setSending(false);
    }
  };

  return (
    // Un único contenedor (recuadro) con color heredado del contexto, para no
    // desplazar las vistas ni imponer un color propio.
    <Box
      sx={{
        mb: 3,
        p: 2,
        color: 'inherit',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography variant="body2" sx={{ color: 'inherit' }}>
          {HIDDEN_INFO_TEXT}
        </Typography>

        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<Iconify icon="solar:key-bold" />}
          disabled={Boolean(healthAccessState.solicitudPendiente)}
          onClick={open.onToggle}
          sx={{ flexShrink: 0 }}
        >
          {healthAccessState.solicitudPendiente ? 'Solicitud pendiente' : 'Solicitar acceso'}
        </Button>
      </Stack>

      <Collapse in={open.value} unmountOnExit>
        <AccessRequestForm
          coordinador={coordinador}
          sending={sending}
          onCancel={open.onFalse}
          onSend={handleSend}
        />
      </Collapse>
    </Box>
  );
}
