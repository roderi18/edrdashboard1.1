import { useState, useCallback } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import {
  isAllowedFileManagerFile,
  subirArchivosGestorFirestore,
} from 'src/services/file-manager-service';

import { Upload } from 'src/components/upload';
import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------

const getFileExtension = (fileName = '') =>
  String(fileName || '')
    .split('.')
    .pop()
    ?.toLowerCase() || '';

const mapPendingFile = ({ file, parentId, batchId, index }) => ({
  id: `${batchId}-${index}`,
  name: file.name || `Archivo ${index + 1}`,
  type: getFileExtension(file.name) || (String(file.type).startsWith('image/') ? 'image' : 'pdf'),
  url: URL.createObjectURL(file),
  parentId: parentId || null,
  shared: [],
  tags: [],
  size: file.size || 0,
  totalFiles: 0,
  createdAt: new Date().toISOString(),
  modifiedAt: new Date().toISOString(),
  isFavorited: false,
  uploading: true,
});

export function FileManagerUploadDialog({
  open,
  parentId,
  onClose,
  onUploadStart,
  onUploadError,
  onUploadComplete,
}) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDrop = useCallback((acceptedFiles) => {
    const nextFiles = acceptedFiles.filter(isAllowedFileManagerFile);

    if (nextFiles.length !== acceptedFiles.length) {
      setError('Solo se permiten imagenes y archivos PDF.');
    } else {
      setError('');
    }

    setFiles((currentFiles) => [...currentFiles, ...nextFiles]);
  }, []);

  const handleRemove = useCallback((fileToRemove) => {
    setFiles((currentFiles) => currentFiles.filter((file) => file !== fileToRemove));
  }, []);

  const handleRemoveAll = useCallback(() => {
    setFiles([]);
    setError('');
  }, []);

  const resetDialog = useCallback(() => {
    setFiles([]);
    setError('');
  }, []);

  const handleClose = useCallback(() => {
    if (loading) return;

    resetDialog();
    onClose?.();
  }, [loading, onClose, resetDialog]);

  const handleUpload = useCallback(async () => {
    if (!files.length) {
      setError('Selecciona al menos un PDF o una imagen.');
      return;
    }

    const uploadFiles = [...files];
    const batchId = `pendiente-${Date.now()}`;
    const pendingFiles = uploadFiles.map((file, index) =>
      mapPendingFile({ file, parentId, batchId, index })
    );
    const pendingIds = pendingFiles.map((file) => file.id);

    try {
      onUploadStart?.(pendingFiles);
      resetDialog();
      onClose?.();

      setLoading(true);
      setError('');

      const uploadedFiles = await subirArchivosGestorFirestore({
        files: uploadFiles,
        parentId: parentId || null,
      });

      onUploadComplete?.(uploadedFiles, pendingIds);
      toast.success(
        uploadedFiles.length === 1
          ? 'Archivo subido correctamente.'
          : 'Archivos subidos correctamente.'
      );
    } catch (uploadError) {
      onUploadError?.(pendingIds);
      setError(uploadError?.message || 'No se pudo subir el archivo.');
      toast.error(uploadError?.message || 'No se pudo subir el archivo.');
    } finally {
      setLoading(false);
    }
  }, [files, onClose, onUploadComplete, onUploadError, onUploadStart, parentId, resetDialog]);

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={handleClose}>
      <DialogTitle>Subir archivos</DialogTitle>

      <DialogContent>
        <Upload
          multiple
          value={files}
          loading={loading}
          onDrop={handleDrop}
          onRemove={handleRemove}
          onRemoveAll={handleRemoveAll}
          previewOrientation="vertical"
          accept={{ 'image/*': [], 'application/pdf': ['.pdf'] }}
          helperText={
            error || (
              <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                Las imagenes se comprimen automaticamente antes de subirlas.
              </Typography>
            )
          }
        />
      </DialogContent>

      <DialogActions>
        <Button color="inherit" disabled={loading} onClick={handleClose}>
          Cancelar
        </Button>

        <Button variant="contained" loading={loading} onClick={handleUpload}>
          Subir
        </Button>
      </DialogActions>
    </Dialog>
  );
}
