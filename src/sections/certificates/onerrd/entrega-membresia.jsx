import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// AL EMITIR EL CERTIFICADO DE UNA MEMBRESÍA (abierto desde "Membresías 2027 ·
// pagos"): no se descarga solo; se pregunta qué hacer. Descargar el
// certificado y la factura, o enviarlos por correo (a quién y desde dónde).
// Con el pago confirmado, el correo sale solo al emitir y aquí se ve si llegó
// a salir; "Reenviar" lo repite.
// ----------------------------------------------------------------------

function Dato({ icono, titulo, valor, vacio }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <Iconify icon={icono} sx={{ color: 'text.secondary', flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {titulo}
        </Typography>
        <Typography
          variant="subtitle2"
          noWrap
          sx={{ color: valor ? 'text.primary' : 'text.disabled' }}
        >
          {valor || vacio}
        </Typography>
      </Box>
    </Stack>
  );
}

const ESTADO_ENVIO = {
  enviando: { severity: 'info', texto: 'Enviando el correo…' },
  enviado: { severity: 'success', texto: 'Correo enviado con el certificado y la factura.' },
  fallido: { severity: 'error', texto: 'No se pudo enviar el correo.' },
  sin_configurar: { severity: 'warning', texto: 'El correo no está configurado.' },
};

export function EntregaMembresia({ entrega, remitente, onDescargar, onEnviar, onCerrar }) {
  const m = entrega?.membresia;
  const d = m?.destacamento || {};
  const envio = entrega?.envio;
  const aviso = envio && ESTADO_ENVIO[envio.estado];
  const confirmada = m?.estado === 'confirmada';
  return (
    <Dialog open={!!entrega} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>¿Qué deseas hacer con el certificado y la factura?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
          Se emitió el certificado <strong>{entrega?.emitido?.numeroRegistro}</strong>
          {entrega?.emitido?.factura?.numero && (
            <>
              {' '}
              y la factura <strong>{entrega.emitido.factura.numero}</strong>
            </>
          )}{' '}
          para {d.numero ? `#${d.numero} ` : ''}
          {d.nombre}.
        </Typography>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Dato
              icono="solar:letter-bold"
              titulo="Se enviará a"
              valor={m?.contacto?.email}
              vacio="Sin correo en la solicitud"
            />
            <Dato
              icono="solar:inbox-bold"
              titulo="Saldrá desde"
              valor={remitente}
              vacio="Sin remitente (Membresía 2027 · landing → Correos)"
            />
          </Stack>
        </Card>
        {aviso && (
          <Alert severity={aviso.severity} sx={{ mt: 2 }}>
            {aviso.texto}
            {envio.error && ` ${envio.error}`}
          </Alert>
        )}
        {!confirmada && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            El pago aún no está confirmado: el correo se envía cuando lo confirmes en «Membresías
            2027 · pagos».
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button color="inherit" onClick={onCerrar}>
          Cerrar
        </Button>
        <Button
          variant="outlined"
          disabled={!confirmada || envio?.estado === 'enviando'}
          loading={envio?.estado === 'enviando'}
          startIcon={<Iconify icon="custom:send-fill" />}
          onClick={onEnviar}
        >
          {envio ? 'Reenviar por correo' : 'Enviar por correo'}
        </Button>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:download-bold" />}
          onClick={onDescargar}
        >
          Descargar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
