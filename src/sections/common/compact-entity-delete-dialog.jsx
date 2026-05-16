import Button from '@mui/material/Button';

import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------

export function CompactEntityDeleteDialog({
  open,
  onClose,
  onConfirm,
  selectedCount,
  entityLabel,
  title = 'Eliminar',
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={title}
      content={
        <>
          ¿Seguro que deseas eliminar <strong> {selectedCount} </strong> {entityLabel}?
        </>
      }
      action={
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          Eliminar
        </Button>
      }
    />
  );
}
