'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { isCoordinadorDestacamentoRole } from 'src/utils/member-access';

import {
  obtenerSolicitudCambioEstadoAscenso,
  resolverSolicitudCambioEstadoAscenso,
} from 'src/services/award-status-change-request-service';

import { toast } from 'src/components/snackbar';

import { AwardsManagerView } from 'src/sections/member/awards/view/awards-manager-view';

import { useAuthContext } from 'src/auth/hooks';

const STATUS_LABELS = {
  no_iniciado: 'No iniciado',
  en_progreso: 'En progreso',
  completado: 'Completado',
};

const formatDateTime = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export function MemberEditAwardsForm({ currentMember, readOnly = false }) {
  const { user } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const memberId = currentMember?.id;
  const requestId = searchParams?.get('solicitudEstadoAscenso') || '';
  const [request, setRequest] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!requestId || !isCoordinadorDestacamentoRole(user)) return undefined;

    obtenerSolicitudCambioEstadoAscenso(requestId)
      .then((result) => {
        if (!active || !result) return;
        setRequest(result);
        setReviewOpen(true);
      })
      .catch((error) => {
        console.error('[awards] no se pudo cargar la solicitud de estado', error);
        toast.error('No se pudo cargar la solicitud.');
      });

    return () => {
      active = false;
    };
  }, [requestId, user]);

  if (!memberId) return null;

  const closeReview = () => {
    setReviewOpen(false);
    setRequest(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('solicitudEstadoAscenso');
    router.replace(params.size ? `${pathname}?${params}` : pathname);
  };

  const resolveRequest = async (decision) => {
    if (!request?.id) return;
    setResolving(true);
    try {
      await resolverSolicitudCambioEstadoAscenso({
        idSolicitud: request.id,
        decision,
        user,
      });
      toast.success(decision === 'aprobar' ? 'Cambio de estado aprobado.' : 'Solicitud rechazada.');
      closeReview();
    } catch (error) {
      console.error('[awards] no se pudo resolver la solicitud', error);
      toast.error(error.message || 'No se pudo resolver la solicitud.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <>
      <Box sx={{ width: '100%' }}>
        <AwardsManagerView memberId={memberId} readOnly={readOnly} />
      </Box>

      <Dialog open={reviewOpen} onClose={resolving ? undefined : closeReview} maxWidth="sm" fullWidth>
        <DialogTitle>Solicitud de cambio en Sistema de Ascenso</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box>
              <Typography variant="subtitle2">Solicitante</Typography>
              <Typography variant="body2">{request?.solicitadoPorNombre || 'Usuario'}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(request?.fechaCreacion)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Miembro e ítem</Typography>
              <Typography variant="body2">
                {request?.nombreMiembro} · {request?.nombreItemAscenso}
              </Typography>
            </Box>
            <Alert severity="warning">
              Se solicita cambiar de {STATUS_LABELS[request?.estadoAnterior] || request?.estadoAnterior}{' '}
              a {STATUS_LABELS[request?.estadoSolicitado] || request?.estadoSolicitado}.
              {request?.tieneDocumentoAnexo
                ? ' Al aprobar, el documento anexo se eliminará definitivamente.'
                : ''}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button color="error" variant="outlined" loading={resolving} onClick={() => resolveRequest('rechazar')}>
            Rechazar
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={closeReview} disabled={resolving}>Cerrar</Button>
            <Button variant="contained" loading={resolving} onClick={() => resolveRequest('aprobar')}>
              Aprobar cambio
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </>
  );
}
