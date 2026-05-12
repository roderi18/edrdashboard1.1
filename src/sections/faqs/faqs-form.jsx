import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

export function FaqsForm({ sx, ...other }) {
  return (
    <Box sx={sx} {...other}>
      <Typography variant="h4">¿No encontraste la ayuda que buscabas?</Typography>
      <Box
        sx={{
          my: 5,
          gap: 3,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <TextField fullWidth label="Nombre" />
        <TextField fullWidth label="Correo electrónico" />
        <TextField fullWidth label="Asunto" />
        <TextField fullWidth label="Escribe tu mensaje aquí." multiline rows={4} />
      </Box>

      <Button size="large" variant="contained">
        Enviar
      </Button>
    </Box>
  );
}
