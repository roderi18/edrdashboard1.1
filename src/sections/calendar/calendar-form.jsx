import * as z from 'zod';
import { useCallback } from 'react';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import DialogActions from '@mui/material/DialogActions';

import { fIsAfter } from 'src/utils/format-time';

import { createEvent, updateEvent, deleteEvent } from 'src/actions/calendar';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field } from 'src/components/hook-form';
import { ColorPicker } from 'src/components/color-utils';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------

export const EventSchema = z.object({
  title: z
    .string()
    .min(1, { error: 'El título es obligatorio.' })
    .max(100, { error: 'El título debe tener menos de 100 caracteres.' }),
  description: z
    .string()
    .min(1, { error: 'La descripción es obligatoria.' })
    .min(10, { error: 'La descripción debe tener al menos 10 caracteres.' }),
  // Not required
  color: z.string(),
  allDay: z.boolean(),
  start: z.union([z.string(), z.number()]),
  end: z.union([z.string(), z.number()]),
});

// ----------------------------------------------------------------------

export function CalendarForm({
  currentEvent,
  colorOptions,
  onClose,
  onCreateEvent = createEvent,
  onUpdateEvent = updateEvent,
  onDeleteEvent = deleteEvent,
}) {
  const confirmDelete = useBoolean();

  const methods = useForm({
    mode: 'all',
    resolver: zodResolver(EventSchema),
    defaultValues: currentEvent,
  });

  const {
    reset,
    watch,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const values = watch();

  const dateError = fIsAfter(values.start, values.end);

  const onSubmit = handleSubmit(async (data) => {
    const eventData = {
      id: currentEvent?.id || undefined,
      color: data?.color,
      title: data?.title,
      allDay: data?.allDay,
      description: data?.description,
      end: data?.end,
      start: data?.start,
    };

    try {
      if (!dateError) {
        if (currentEvent?.id) {
          await onUpdateEvent(eventData);
          toast.success('Evento actualizado correctamente.');
        } else {
          await onCreateEvent(eventData);
          toast.success('Evento creado correctamente.');
        }
        onClose();
        reset();
      }
    } catch (error) {
      console.error(error);
    }
  });

  const onDelete = useCallback(async () => {
    try {
      await onDeleteEvent(`${currentEvent?.id}`);
      toast.success('Evento eliminado correctamente.');
      confirmDelete.onFalse();
      onClose();
    } catch (error) {
      console.error(error);
    }
  }, [confirmDelete, currentEvent?.id, onClose, onDeleteEvent]);

  return (
    <>
      <Form methods={methods} onSubmit={onSubmit}>
        <Scrollbar sx={{ p: 3, bgcolor: 'background.neutral' }}>
          <Stack spacing={3}>
            <Field.Text name="title" label="Título" />
            <Field.Text name="description" label="Descripción" multiline rows={3} />
            <Field.Switch name="allDay" label="Todo el día" />
            <Field.DateTimePicker
              ampm
              name="start"
              label="Fecha de inicio"
              format="DD/MM/YYYY hh:mm A"
            />
            <Field.DateTimePicker
              ampm
              name="end"
              label="Fecha de fin"
              format="DD/MM/YYYY hh:mm A"
              slotProps={{
                textField: {
                  error: dateError,
                  helperText: dateError ? 'La fecha de fin debe ser posterior a la de inicio' : null,
                },
              }}
            />

            <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <ColorPicker
                  value={field.value}
                  onChange={(color) => field.onChange(color)}
                  options={colorOptions}
                />
              )}
            />
          </Stack>
        </Scrollbar>

        <DialogActions sx={{ flexShrink: 0 }}>
          {!!currentEvent?.id && (
            <Tooltip title="Eliminar evento">
              <IconButton
                aria-label="Eliminar evento"
                color="error"
                onClick={confirmDelete.onTrue}
                edge="start"
              >
                <Iconify icon="solar:trash-bin-trash-bold" />
              </IconButton>
            </Tooltip>
          )}

          <Box component="span" sx={{ flexGrow: 1 }} />

          <Button variant="outlined" color="inherit" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={isSubmitting} disabled={dateError}>
            {currentEvent?.id ? 'Guardar cambios' : 'Crear'}
          </Button>
        </DialogActions>
      </Form>

      <ConfirmDialog
        open={confirmDelete.value}
        onClose={confirmDelete.onFalse}
        title="Eliminar actividad"
        content="¿Seguro que deseas eliminar esta actividad?"
        action={
          <Button type="button" variant="contained" color="error" onClick={onDelete}>
            Eliminar
          </Button>
        }
      />
    </>
  );
}
