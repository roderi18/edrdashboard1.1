import { toast } from 'sonner';
import { useRef, useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { fData } from 'src/utils/format-number';
import { uploadFilesToStorage, buildStorageFileName } from 'src/utils/firebase-file-storage';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const isRestrictedItem = (item = {}) =>
  item?.requiereAprobacion || item?.renglon === 'restringido' || item?.tipoProducto === 'restringido';

const MAX_MISSING_FILES = 10;

const getAttachmentKey = (file = {}, index = 0) =>
  [
    file.id,
    file.storagePath,
    file.url,
    file.downloadURL,
    file.nombre,
    file.productId,
    index,
  ]
    .filter(Boolean)
    .join('-');

export function OrderDetailsAttachments({
  order,
  canManageStatus,
  onEvaluateOrder,
  onUploadMissingFiles,
  onDeleteAttachment,
  onRestoreAttachment,
}) {
  const missingFileInputRef = useRef(null);
  const [openReject, setOpenReject] = useState(false);
  const [openPreview, setOpenPreview] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [hasEvaluated, setHasEvaluated] = useState(false);
  const [reason, setReason] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [loadingMissingFiles, setLoadingMissingFiles] = useState(false);

  const attachments = useMemo(() => {
    const uniqueFiles = new Map();

    (order?.items || [])
      .filter(isRestrictedItem)
      .forEach((item) => {
        (item?.archivosAdjuntos || item?.aprobacion?.archivosAdjuntos || []).forEach((file) => {
          const nextFile = {
            ...file,
            productId: item?.id || item?.productoId,
            productName: item?.name,
          };

          uniqueFiles.set(getAttachmentKey(nextFile), nextFile);
        });
      });

    return Array.from(uniqueFiles.values());
  }, [order?.items]);
  const hasRestrictedItems = (order?.items || []).some(isRestrictedItem);
  const rejectedItem = (order?.items || []).find(
    (item) =>
      isRestrictedItem(item) &&
      (item?.aprobacion?.estado === 'rechazada' ||
        item?.aprobacion?.comentario ||
        item?.aprobacion?.archivosFaltantes?.length)
  );
  const rejectionReason = rejectedItem?.aprobacion?.comentario || '';
  const missingFilesCount = rejectedItem?.aprobacion?.archivosFaltantes?.length || 0;
  const isRejectedAgain = rejectedItem?.aprobacion?.estado === 'rechazada';
  const hasUploadedMissingFiles = missingFilesCount > 0 && !isRejectedAgain;
  const showMissingFiles = !canManageStatus && Boolean(rejectedItem);
  const canSubmitReject = reason.trim().length >= 5;
  const previewButtonLabel =
    attachments.length === 1
      ? `Ver archivo adjunto (${attachments.length})`
      : `Ver archivos adjuntos (${attachments.length})`;

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

  const handleSelectMissingFiles = useCallback(
    async (event) => {
      const selectedFiles = Array.from(event.target.files || []);
      event.target.value = '';

      if (!selectedFiles.length || !onUploadMissingFiles) return;

      if (missingFilesCount + selectedFiles.length > MAX_MISSING_FILES) {
        toast.error(`Solo puedes cargar ${MAX_MISSING_FILES} archivos faltantes como máximo.`);
        return;
      }

      const invalidFile = selectedFiles.find(
        (file) => !String(file.type || '').startsWith('image/') && file.type !== 'application/pdf'
      );

      if (invalidFile) {
        toast.error('Solo puedes cargar imágenes o PDF.');
        return;
      }

      try {
        setLoadingMissingFiles(true);
        const uploadedFiles = await uploadFilesToStorage({
          files: selectedFiles,
          storagePathBuilder: (file, index) =>
            `ordenes/${order?.id || order?.orderNumber}/faltantes/${buildStorageFileName(file, index)}`,
          metadataBuilder: () => ({
            orderId: order?.id || '',
            orderNumber: order?.orderNumber || '',
            tipoAdjunto: 'faltante_rechazo',
          }),
        });

        await onUploadMissingFiles(uploadedFiles);
        toast.success('Archivo faltante cargado correctamente.');
      } catch (error) {
        console.error(error);
        toast.error(error?.message || 'No se pudo cargar el archivo faltante.');
      } finally {
        setLoadingMissingFiles(false);
      }
    },
    [missingFilesCount, onUploadMissingFiles, order?.id, order?.orderNumber]
  );

  const handleConfirmDeleteAttachment = useCallback(async () => {
    if (!deleteTarget || !onDeleteAttachment) return;

    try {
      const removedFile = deleteTarget;
      await onDeleteAttachment(removedFile);
      setDeleteTarget(null);

      toast.success('Documento eliminado.', {
        duration: 6000,
        style: { whiteSpace: 'nowrap', minWidth: 360 },
        action: {
          label: 'Deshacer',
          style: { minWidth: 96 },
          onClick: () => {
            void onRestoreAttachment?.(removedFile);
          },
        },
      });
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'No se pudo eliminar el documento.');
    }
  }, [deleteTarget, onDeleteAttachment, onRestoreAttachment]);

  if (!hasRestrictedItems) {
    return null;
  }

  return (
    <>
      <CardHeader title="Archivos adjuntos" />

      <Box sx={{ p: 3, pt: 0 }}>
        <Stack spacing={2}>
          {!attachments.length && (
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
              {previewButtonLabel}
            </Button>
          )}

          {showMissingFiles && (
            <Stack spacing={1.25}>
              <Typography variant="h6">Archivos faltantes</Typography>

              <input
                ref={missingFileInputRef}
                type="file"
                accept="image/*,application/pdf"
                hidden
                multiple
                onChange={handleSelectMissingFiles}
              />

              <Button
                fullWidth
                variant="outlined"
                color="inherit"
                disabled={hasUploadedMissingFiles}
                loading={loadingMissingFiles}
                startIcon={<Iconify icon="solar:upload-bold" />}
                onClick={() => missingFileInputRef.current?.click()}
              >
                Cargar
              </Button>

              {!!rejectionReason && !hasUploadedMissingFiles && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {rejectionReason}
                </Typography>
              )}
            </Stack>
          )}

          {canManageStatus && (
            <>
              <Button
                fullWidth
                variant="outlined"
                color="inherit"
                startIcon={<Iconify icon="solar:document-add-bold" />}
                onClick={() => {
                  setHasEvaluated(true);
                  setOpenPreview(true);
                }}
              >
                Evaluar ({attachments.length})
              </Button>

              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip
                  title={
                    hasEvaluated
                      ? 'Antes de rechazar la orden, confirma que revisaste los archivos adjuntos.'
                      : 'Primero deben evaluarse los archivos adjuntos.'
                  }
                >
                  <span style={{ flex: 1 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      disabled={!hasEvaluated || !!loadingAction}
                      onClick={() => setOpenReject(true)}
                    >
                      Rechazar orden
                    </Button>
                  </span>
                </Tooltip>

                <Divider orientation="vertical" flexItem>
                  |
                </Divider>

                <Tooltip
                  title={
                    hasEvaluated
                      ? 'Antes de aceptar la orden, confirma que revisaste los archivos adjuntos.'
                      : 'Primero deben evaluarse los archivos adjuntos.'
                  }
                >
                  <span style={{ flex: 1 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      color="success"
                      disabled={!hasEvaluated}
                      loading={loadingAction === 'aceptar'}
                      onClick={() => handleEvaluate('aceptar')}
                    >
                      Aprobar
                    </Button>
                  </span>
                </Tooltip>
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
              Escribe la razón del rechazo. El miembro recibirá una notificación y
              también un mensaje en su chat.
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
              attachments.map((file, index) => {
                const fileUrl = file.url || file.urlArchivo || file.downloadURL || file.ruta;
                const isImage = String(file.tipo || '').startsWith('image/');
                const isPdf = String(file.tipo || '').includes('pdf');

                return (
                  <Box
                    key={`preview-${getAttachmentKey(file, index)}`}
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
                          <Stack direction="row" spacing={1}>
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

                            {canManageStatus && (
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                onClick={() => setDeleteTarget(file)}
                              >
                                Eliminar
                              </Button>
                            )}
                          </Stack>
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

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Eliminar documento</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            ¿Realmente deseas eliminar este documento de los archivos adjuntos?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={handleConfirmDeleteAttachment}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
