import * as z from 'zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

export const ProductReviewCreateSchema = z.object({
  rating: z.number().min(1, 'Selecciona una calificacion.'),
  review: z.string().min(1, { error: 'La resena es requerida.' }),
});

// ----------------------------------------------------------------------

export function ProductReviewCreateForm({ onClose, onCreateReview, sx, ...other }) {
  const defaultValues = {
    rating: 0,
    review: '',
  };

  const methods = useForm({
    mode: 'all',
    resolver: zodResolver(ProductReviewCreateSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await onCreateReview?.(data);
      reset();
      onClose();
    } catch (error) {
      console.error(error);
    }
  });

  const onCancel = useCallback(() => {
    onClose();
    reset();
  }, [onClose, reset]);

  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} sx={sx} {...other}>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>Agregar resena</DialogTitle>

        <DialogContent>
          <div>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Tu calificacion de este producto:
            </Typography>
            <Field.Rating name="rating" />
          </div>

          <Field.Text name="review" label="Resena *" multiline rows={3} sx={{ mt: 3 }} />
        </DialogContent>

        <DialogActions>
          <Button color="inherit" variant="outlined" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={isSubmitting}>
            Publicar
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
