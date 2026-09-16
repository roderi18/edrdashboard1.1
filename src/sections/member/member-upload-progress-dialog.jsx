import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';

export function MemberUploadProgressDialog({ progress }) {
  return (
    <Dialog fullWidth maxWidth="xs" open={progress.open} disableEscapeKeyDown>
      <DialogTitle>Subiendo miembros</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <LinearProgress
            variant={progress.total ? 'determinate' : 'indeterminate'}
            value={
              progress.total ? Math.round((progress.processed / progress.total) * 100) : undefined
            }
          />

          {progress.phase === 'reading' ? (
            <Typography>Leyendo el documento y contando las filas...</Typography>
          ) : progress.phase === 'refreshing' ? (
            <Stack spacing={0.5}>
              <Typography>Actualizando la vista de miembros...</Typography>
              <Typography variant="body2" color="text.secondary">
                Cargadas correctamente: {progress.inserted}. Con error: {progress.failed}.
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={0.5}>
              <Typography>
                Filas procesadas: <strong>{progress.processed}</strong> de{' '}
                <strong>{progress.total}</strong>.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cargadas correctamente: {progress.inserted}. Con error: {progress.failed}.
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
