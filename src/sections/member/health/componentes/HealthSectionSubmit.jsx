'use client';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

// Boton de accion al pie de cada seccion de la Dispensa Médica. Para el Líder de
// Grupo / Líder Asistente el guardado directo se sustituye por "Enviar a
// aprobación": los cambios no se guardan, se envian al Coordinador de
// Destacamento para su revision (mismo flujo que el tab General).
export function HealthSectionSubmit({
  isSubmitting = false,
  isGroupLeader = false,
  sendingApproval = false,
  onRequestApproval,
}) {
  return (
    <Stack alignItems="flex-end">
      {isGroupLeader ? (
        <Button
          type="button"
          variant="contained"
          loading={sendingApproval}
          onClick={onRequestApproval}
        >
          Enviar a aprobación
        </Button>
      ) : (
        <Button type="submit" variant="contained" loading={isSubmitting}>
          Guardar cambios
        </Button>
      )}
    </Stack>
  );
}
