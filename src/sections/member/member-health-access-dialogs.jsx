'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

import {
  TODAS_SECCIONES_ACCESO_SALUD,
  OPCIONES_DURACION_ACCESO_SALUD,
  ETIQUETAS_SECCIONES_ACCESO_SALUD,
} from 'src/services/member-health-access-service';

const formatDateTime = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export function MemberHealthAccessRequestDialog({ open, saving, onClose, onSubmit }) {
  const [justificacion, setJustificacion] = useState('');
  const texto = justificacion.trim();

  useEffect(() => {
    if (!open) setJustificacion('');
  }, [open]);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Solicitar acceso a la Dispensa Médica</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="warning">
            La justificación es obligatoria y quedará registrada en el log de auditoría.
          </Alert>
          <TextField
            autoFocus
            required
            multiline
            minRows={4}
            label="Justificación del acceso"
            value={justificacion}
            onChange={(event) => setJustificacion(event.target.value)}
            error={Boolean(justificacion) && !texto}
            helperText="Explica por qué necesitas consultar la información médica del menor."
            inputProps={{ maxLength: 1000 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button
          variant="contained"
          loading={saving}
          disabled={!texto}
          onClick={() => onSubmit(texto)}
        >
          Enviar solicitud
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function MemberHealthAccessReviewDialog({
  open,
  solicitud,
  saving,
  onClose,
  onResolve,
}) {
  const [duracion, setDuracion] = useState(OPCIONES_DURACION_ACCESO_SALUD[0].value);
  const [secciones, setSecciones] = useState([...TODAS_SECCIONES_ACCESO_SALUD]);

  useEffect(() => {
    if (open) {
      setDuracion(OPCIONES_DURACION_ACCESO_SALUD[0].value);
      setSecciones([...TODAS_SECCIONES_ACCESO_SALUD]);
    }
  }, [open, solicitud?.id]);

  const allSelected = secciones.length === TODAS_SECCIONES_ACCESO_SALUD.length;
  const toggleSection = (section) => {
    setSecciones((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section]
    );
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Solicitud de acceso a Dispensa Médica</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Box>
            <Typography variant="subtitle2">Solicitante</Typography>
            <Typography variant="body2">{solicitud?.solicitadoPorNombre || 'Usuario'}</Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(solicitud?.fechaCreacion)}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">Miembro</Typography>
            <Typography variant="body2">{solicitud?.nombreMiembro || 'Miembro'}</Typography>
          </Box>

          <Alert severity="info" icon={false}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Justificación</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {solicitud?.justificacion || 'Sin justificación'}
            </Typography>
          </Alert>

          <FormControl fullWidth>
            <InputLabel id="health-access-duration-label">Duración del permiso</InputLabel>
            <Select
              labelId="health-access-duration-label"
              label="Duración del permiso"
              value={duracion}
              onChange={(event) => setDuracion(event.target.value)}
            >
              {OPCIONES_DURACION_ACCESO_SALUD.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Secciones permitidas</Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allSelected}
                  indeterminate={secciones.length > 0 && !allSelected}
                  onChange={(event) =>
                    setSecciones(event.target.checked ? [...TODAS_SECCIONES_ACCESO_SALUD] : [])
                  }
                />
              }
              label="Todas"
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {TODAS_SECCIONES_ACCESO_SALUD.map((section) => (
                <FormControlLabel
                  key={section}
                  control={
                    <Checkbox
                      checked={secciones.includes(section)}
                      onChange={() => toggleSection(section)}
                    />
                  }
                  label={ETIQUETAS_SECCIONES_ACCESO_SALUD[section]}
                />
              ))}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button
          color="error"
          variant="outlined"
          loading={saving}
          onClick={() => onResolve({ decision: 'rechazar' })}
        >
          Rechazar
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} disabled={saving}>Cerrar</Button>
          <Button
            variant="contained"
            loading={saving}
            disabled={!secciones.length}
            onClick={() => onResolve({ decision: 'aprobar', duracion, secciones })}
          >
            Aceptar
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
