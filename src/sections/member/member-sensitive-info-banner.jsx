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

import { isSectionOrRegionLevelRole } from 'src/utils/org-level-access';
import {
  esMiembroDeSuAlcance,
  canViewMemberAwardsTab,
  canViewMemberParentsTab,
  canViewMemberHistoryTab,
  isSupervisoryMemberViewer,
  canViewMemberSensitiveData,
} from 'src/utils/member-access';

import {
  obtenerEstadoAccesoSalud,
  crearSolicitudAccesoSalud,
} from 'src/services/member-health-access-service';
import {
  solicitarAccesoInformacionMiembro,
  obtenerCoordinadorDestacamentoInfo,
} from 'src/services/member-info-access-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';
import { esMenorDeEdad } from 'src/auth/permissions/can';

// ----------------------------------------------------------------------
// Aviso de "información oculta por motivos de seguridad" + solicitud de acceso al
// Coordinador de Destacamento del miembro (se le notifica por su nombre).
//
// Se muestra en las pestañas de la ficha donde el usuario NO tiene acceso pleno al
// contenido (General, Dispensa Médica, Padres, Historial). En Sistema de Ascenso,
// si el usuario puede verlo (p. ej. el Director Nacional), NO aparece.
// ----------------------------------------------------------------------

const HIDDEN_INFO_TEXT = 'Parte de la información de este miembro está oculta por motivos de seguridad, ya que es menor de edad.';

// Para los cargos de sección y región el motivo no es la edad del miembro, sino su
// nivel de acceso: la información personal queda reservada a los Coordinadores de
// Destacamento, a quienes pueden solicitarla desde este mismo aviso.
const SUPERVISORY_HIDDEN_INFO_TEXT =
  'Por motivos de seguridad, la información personal de los miembros está reservada a los Coordinadores de Destacamento. Puedes solicitar acceso indicando el motivo.';

// El Historial solo lo ven el Coordinador de Destacamento (y su Asistente) y el
// Lider de Grupo, y unicamente de su propio destacamento. El resto de cargos
// (aunque no sean de seccion/region) ven este aviso en vez del texto de "menor
// de edad", que no aplica aqui.
const HISTORY_HIDDEN_INFO_TEXT =
  'Por motivos de seguridad, el historial de cambios está reservado al Coordinador de Destacamento, su Asistente y el Líder de Grupo del propio destacamento. Puedes solicitar acceso indicando el motivo.';

// No siempre se oculta por la edad. A un cargo de destacamento tambien se le
// oculta la ficha de alguien de OTRO destacamento, tenga la edad que tenga: ahi
// el motivo es de quien es el miembro, no cuantos años tiene.
const OTHER_DEST_HIDDEN_INFO_TEXT =
  'Parte de la información de este miembro está oculta por motivos de seguridad, ya que pertenece a otro destacamento. Puedes solicitar acceso indicando el motivo.';

const getHiddenInfoText = (user, pathname = '', member) => {
  if (pathname.includes('/edit/history')) return HISTORY_HIDDEN_INFO_TEXT;
  if (isSectionOrRegionLevelRole(user)) return SUPERVISORY_HIDDEN_INFO_TEXT;

  // Decia "ya que es menor de edad" siempre, y se leia en la ficha de personas
  // de 26 años. El aviso quedaba diciendo algo que no era verdad, y encima
  // sugiriendo el motivo equivocado a quien lo leia.
  return esMenorDeEdad(member ?? {}) ? HIDDEN_INFO_TEXT : OTHER_DEST_HIDDEN_INFO_TEXT;
};

// ¿El usuario tiene restringido el contenido de la pestaña actual? (Entonces se
// muestra el aviso.) Cada ruta se evalúa contra su permiso correspondiente.
const isRestrictedForRoute = (user, pathname = '', member) => {
  // En Dispensa Médica, los cargos de supervisión solicitan acceso al expediente
  // restringido.
  if (pathname.includes('/edit/health')) {
    // Tambien cuando el miembro no es de los suyos. Antes esta pestaña solo
    // avisaba a los cargos de seccion y region: un cargo de destacamento abria
    // la dispensa de alguien de OTRO destacamento, veia los datos tapados y
    // ningun aviso que dijera por que ni como pedirlos.
    return isSupervisoryMemberViewer(user) || !esMiembroDeSuAlcance(user, member);
  }
  if (pathname.includes('/edit/awards')) return !canViewMemberAwardsTab(user);
  if (pathname.includes('/edit/parents')) return !canViewMemberParentsTab(user);
  if (pathname.includes('/edit/history')) return !canViewMemberHistoryTab(user, member);
  // General (ficha principal): depende del acceso a los datos sensibles Y de que
  // el miembro sea de los suyos. Sin lo segundo, quien tiene cargo de
  // destacamento dejaba de ver el aviso en la ficha de otro destacamento aunque
  // los datos siguieran enmascarados.
  return !esMiembroDeSuAlcance(user, member) || !canViewMemberSensitiveData(user);
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
  // Cargos de supervisión (sección, región y Consejo Nacional): tienen la Dispensa
  // Médica deshabilitada y solicitan acceso al Coordinador de Destacamento. Aplica
  // a cualquier miembro, no solo a los menores: el expediente completo les queda
  // en consulta restringida hasta que el Coordinador les conceda el acceso.
  //
  // Y tambien a quien SI tiene cargo de destacamento cuando el miembro no es de
  // los suyos. Aqui se pedia unicamente ser cargo de supervision, y eso deja
  // fuera a quien tiene los dos —Coordinador de Destacamento Y Coordinador
  // Regional, por ejemplo—: veia la dispensa apagada, sin una linea que dijera
  // por que ni un boton para pedirla. La peticion va al Coordinador del
  // destacamento del miembro, que es quien puede concederla en los dos casos.
  const fueraDeSuAlcance = !esMiembroDeSuAlcance(user, member);
  const isHealthAccessRequest =
    isHealthRoute && (isSupervisoryMemberViewer(user) || fueraDeSuAlcance);
  const shouldShow =
    Boolean(member) &&
    isRestrictedForRoute(user, pathname, member) &&
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
          {getHiddenInfoText(user, pathname, member)}
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
