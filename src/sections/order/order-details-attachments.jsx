import { toast } from 'sonner';
import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { fData } from 'src/utils/format-number';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const isRestrictedItem = (item = {}) =>
  item?.requiereAprobacion || item?.renglon === 'restringido' || item?.tipoProducto === 'restringido';

export function OrderDetailsAttachments({
  order,
  canManageStatus,
  onEvaluateOrder,
}) {
  const [openReject, setOpenReject] = useState(false);
  const [openPreview, setOpenPreview] = useState(false);
  const [reason, setReason] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  const attachments = useMemo(
    () =>
      (order?.items || [])
        .filter(isRestrictedItem)
        .flatMap((item) =>
          (item?.archivosAdjuntos || item?.aprobacion?.archivosAdjuntos || []).map((file) => ({
            ...file,
            productName: item?.name,
          }))
        ),
    [order?.items]
  );
  const hasRestrictedItems = (order?.items || []).some(isRestrictedItem);
  const canSubmitReject = reason.trim().length >= 5;

  const handleEvaluate = useCallback(
    async (action, actionReason = '') => {
      if (!onEvaluateOrder) return;

      try {
        setLoadingAction(action);
        await onEvaluateOrder(action, actionReason);
        toast.success(
          action === 'rechazar'
            ? 'Orden rechazada y notificada.'
            : action === 'aceptar'
              ? 'Orden aceptada.'
              : 'Orden enviada a evaluación.'
        );
      } catch (error) {
        console.error(error);
        toast.error(error?.message || 'No se pudo actualizar la evaluación.');
      } finally {
        setLoadingAction('');
      }
    },
    [onEvaluateOrder]
  );

  const handleReject = useCallback(async () => {
    await handleEvaluate('rechazar', reason.trim());
    setReason('');
    setOpenReject(false);
  }, [handleEvaluate, reason]);

  if (!hasRestrictedItems) {
    return null;
  }

  return (
    <>
      <CardHeader title="Archivo adjunto" />

      <Box sx={{ p: 3, pt: 0 }}>
        <Stack spacing={2}>
          {attachments.length ? (
            attachments.map((file) => (
              <Box
                key={file.id || `${file.nombre}-${file.productName}`}
                sx={{
                  gap: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  typography: 'body2',
                }}
              >
                <Iconify icon="solar:file-text-bold" width={24} sx={{ color: 'text.secondary' }} />
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="subtitle2" noWrap>
                    {file.nombre || 'Archivo adjunto'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {[file.productName, file.tamano ? fData(file.tamano) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Box>
              </Box>
            ))
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Este pedido tiene producto restringido, pero no registra archivos adjuntos.
            </Typography>
          )}

          {!!attachments.length && !canManageStatus && (
            <Button
              fullWidth
              variant="outlined"
              color="inherit"
              startIcon={<Iconify icon="solar:eye-bold" />}
              onClick={() => setOpenPreview(true)}
            >
              Ver archivo adjunto
            </Button>
          )}

          {canManageStatus && (
            <>
              <Button
                fullWidth
                variant="outlined"
                color="inherit"
                startIcon={<Iconify icon="solar:document-add-bold" />}
                onClick={() => setOpenPreview(true)}
              >
                Evaluar
              </Button>

              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  disabled={!!loadingAction}
                  onClick={() => setOpenReject(true)}
                >
                  Rechazar orden
                </Button>

                <Divider orientation="vertical" flexItem>
                  |
                </Divider>

                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  loading={loadingAction === 'aceptar'}
                  onClick={() => handleEvaluate('aceptar')}
                >
                  Aceptar
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </Box>

      <Dialog open={openReject} onClose={() => setOpenReject(false)} fullWidth maxWidth="sm">
        <DialogTitle>Rechazar orden</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Escribe la razón del rechazo. Esta razón se enviará como notificación al miembro y
              también quedará registrada en el chat.
            </Typography>

            <TextField
              autoFocus
              multiline
              minRows={4}
              label="Razón del rechazo"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              helperText="Mínimo 5 caracteres."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setOpenReject(false)}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={!canSubmitReject}
            loading={loadingAction === 'rechazar'}
            onClick={handleReject}
          >
            Rechazar y notificar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openPreview} onClose={() => setOpenPreview(false)} fullWidth maxWidth="md">
        <DialogTitle>Archivos adjuntos</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {attachments.length ? (
              attachments.map((file) => {
                const fileUrl = file.url || file.urlArchivo || file.downloadURL || file.ruta;
                const isImage = String(file.tipo || '').startsWith('image/');
                const isPdf = String(file.tipo || '').includes('pdf');

                return (
                  <Box
                    key={`preview-${file.id || `${file.nombre}-${file.productName}`}`}
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      border: (theme) => `1px dashed ${theme.vars.palette.divider}`,
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                        <Iconify
                          icon="solar:file-text-bold"
                          width={24}
                          sx={{ color: 'text.secondary' }}
                        />
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="subtitle2" noWrap>
                            {file.nombre || 'Archivo adjunto'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {[file.productName, file.tipo, file.tamano ? fData(file.tamano) : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </Typography>
                        </Box>
                        {fileUrl && (
                          <Button
                            size="small"
                            color="inherit"
                            variant="outlined"
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir
                          </Button>
                        )}
                      </Box>

                      {fileUrl && isImage && (
                        <Box
                          component="img"
                          alt={file.nombre || 'Archivo adjunto'}
                          src={fileUrl}
                          sx={{
                            width: 1,
                            maxHeight: 360,
                            borderRadius: 1,
                            objectFit: 'contain',
                            bgcolor: 'background.neutral',
                          }}
                        />
                      )}

                      {fileUrl && isPdf && (
                        <Box
                          component="iframe"
                          title={file.nombre || 'Archivo PDF'}
                          src={fileUrl}
                          sx={{
                            width: 1,
                            height: 520,
                            border: 0,
                            borderRadius: 1,
                            bgcolor: 'background.neutral',
                          }}
                        />
                      )}

                      {!fileUrl && (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Este registro solo contiene los datos del archivo. Para previsualizarlo
                          desde esta pantalla, el archivo debe guardarse con una URL de descarga.
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                );
              })
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No hay archivos adjuntos para evaluar.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setOpenPreview(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
