import { useState, cloneElement, isValidElement } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------

export function ConfirmDialog({ open, title, action, content, onClose, ...other }) {
  const [processing, setProcessing] = useState(false);

  const close = (...args) => {
    if (!processing) onClose?.(...args);
  };

  const protectedAction = isValidElement(action)
    ? cloneElement(action, {
        disabled: processing || action.props.disabled,
        loading: processing || action.props.loading,
        onClick: async (event) => {
          if (processing) return;

          setProcessing(true);
          try {
            await action.props.onClick?.(event);
          } finally {
            setProcessing(false);
          }
        },
      })
    : action;

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={close} {...other}>
      <DialogTitle sx={{ pb: 2 }}>{title}</DialogTitle>

      {content && <DialogContent sx={{ typography: 'body2' }}> {content}</DialogContent>}

      <DialogActions>
        {protectedAction}

        <Button variant="outlined" color="inherit" disabled={processing} onClick={close}>
          Cancelar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
