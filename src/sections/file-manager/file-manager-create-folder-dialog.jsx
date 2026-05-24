import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Upload } from 'src/components/upload';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export function FileManagerCreateFolderDialog({
  open,
  onClose,
  onCreate,
  onUpdate,
  folderName,
  onChangeFolderName,
  title = 'Agregar archivos',
  ...other
}) {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (!open) {
      setFiles([]);
    }
  }, [open]);

  const handleDrop = useCallback(
    (acceptedFiles) => {
      setFiles([...files, ...acceptedFiles]);
    },
    [files]
  );

  const handleUpload = () => {
    onClose();
    console.info('ON UPLOAD');
  };

  const handleRemoveFile = (inputFile) => {
    const filtered = files.filter((file) => file !== inputFile);
    setFiles(filtered);
  };

  const handleRemoveAllFiles = () => {
    setFiles([]);
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} aria-hidden={!open} onClose={onClose} {...other}>
      <DialogTitle sx={[(theme) => ({ p: theme.spacing(3, 3, 2, 3) })]}>{title}</DialogTitle>

      <IconButton
        aria-label="Cerrar"
        onClick={onClose}
        sx={{ top: 8, right: 8, position: 'absolute' }}
      >
        <Iconify icon="mingcute:close-line" />
      </IconButton>

      <DialogContent dividers sx={{ pt: 1, pb: 0, border: 'none' }}>
        {(onCreate || onUpdate) && (
          <TextField
            fullWidth
            label="Nombre de la carpeta"
            value={folderName}
            onChange={onChangeFolderName}
            sx={{ mb: 3 }}
          />
        )}

        <Upload multiple value={files} onDrop={handleDrop} onRemove={handleRemoveFile} />
      </DialogContent>

      <DialogActions>
        <Button
          variant="contained"
          startIcon={<Iconify icon="eva:cloud-upload-fill" />}
          onClick={handleUpload}
        >
          Subir
        </Button>

        {!!files.length && (
          <Button variant="outlined" color="inherit" onClick={handleRemoveAllFiles}>
            Quitar todo
          </Button>
        )}

        {(onCreate || onUpdate) && (
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="soft" onClick={onCreate || onUpdate}>
              {onUpdate ? 'Guardar' : 'Crear'}
            </Button>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
}
