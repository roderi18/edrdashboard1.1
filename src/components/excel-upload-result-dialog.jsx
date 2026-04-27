import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { downloadUploadLog } from 'src/utils/excel-upload';

export function ExcelUploadResultDialog({ open, result, logFileName, onClose }) {
  const failures = result?.failures || [];
  const inserted = result?.inserted || 0;

  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={onClose}>
      <DialogTitle>Resultado de la subida</DialogTitle>

      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          Filas insertadas: <strong>{inserted}</strong>. Filas no insertadas:{' '}
          <strong>{failures.length}</strong>.
        </Typography>

        {failures.length > 0 ? (
          <Box
            sx={{
              gap: 1.5,
              display: 'flex',
              maxHeight: 420,
              overflow: 'auto',
              flexDirection: 'column',
            }}
          >
            {failures.map((failure) => (
              <Box
                key={failure.rowNumber}
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: 'background.neutral',
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              >
                <Typography variant="subtitle2">Fila {failure.rowNumber} - No insertada</Typography>
                <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }}>
                  Razón: {failure.reason}
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    mt: 1,
                    p: 1,
                    m: 0,
                    fontSize: 12,
                    overflow: 'auto',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  {JSON.stringify(failure.row, null, 2)}
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography color="success.main">Todas las filas fueron insertadas correctamente.</Typography>
        )}
      </DialogContent>

      <DialogActions>
        {failures.length > 0 && (
          <Button
            color="inherit"
            variant="outlined"
            onClick={() => downloadUploadLog({ fileName: logFileName, failures })}
          >
            Descargar txt
          </Button>
        )}
        <Button variant="contained" color="inherit" onClick={onClose}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
