import { useState } from 'react';

import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemIcon from '@mui/material/ListItemIcon';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { cambiarEstadoMembresia } from 'src/services/membresia-onerrd-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// EL ESTADO DE UN PAGO, que se cambia pulsándolo: una transferencia en
// revisión se confirma (recibe su código ONERRD 2027 y ya se pueden emitir
// certificado y factura) o se rechaza con un motivo; una confirmada o
// rechazada por error vuelve a revisión. Antes el estado solo se miraba.
// ----------------------------------------------------------------------

const OPCIONES = [
  {
    accion: 'confirmar',
    texto: 'Confirmar pago',
    icono: 'solar:check-circle-bold',
    color: 'success.main',
    desde: ['pendiente_transferencia', 'pendiente_revision', 'rechazada'],
  },
  {
    accion: 'rechazar',
    texto: 'Rechazar…',
    icono: 'solar:close-circle-bold',
    color: 'error.main',
    desde: ['pendiente_transferencia', 'pendiente_revision'],
  },
  {
    accion: 'revision',
    texto: 'Devolver a revisión',
    icono: 'solar:restart-bold',
    color: 'text.secondary',
    desde: ['confirmada', 'rechazada'],
  },
];

export function EstadoMembresia({ membresia, estado, user, onCambiado }) {
  const [ancla, setAncla] = useState(null);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const opciones = OPCIONES.filter((o) => o.desde.includes(membresia.estado));
  const d = membresia.destacamento || {};

  const cambiar = async (accion, motivoRechazo = '') => {
    setAncla(null);
    setEnviando(true);
    try {
      const r = await cambiarEstadoMembresia({
        id: membresia.id,
        accion,
        motivo: motivoRechazo,
        estadoAntes: estado.etiqueta,
        destacamento: `#${d.numero} ${d.nombre || ''}`.trim(),
        user,
      });
      onCambiado?.(r.membresia);
      setRechazando(false);
      setMotivo('');
      toast.success(
        accion === 'confirmar'
          ? `Pago confirmado${r.codigo ? `: ${r.codigo}` : ''}. Ya puedes emitir el certificado y la factura.`
          : accion === 'rechazar'
            ? 'Pago rechazado.'
            : 'Devuelto a revisión.'
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const etiqueta = (
    <Label
      color={estado.color}
      startIcon={<Iconify icon={estado.icono} />}
      endIcon={opciones.length ? <Iconify icon="eva:arrow-ios-downward-fill" width={14} /> : null}
    >
      {enviando ? 'Guardando…' : estado.etiqueta}
    </Label>
  );

  if (!opciones.length) return etiqueta;

  return (
    <>
      <ButtonBase
        disabled={enviando}
        onClick={(e) => setAncla(e.currentTarget)}
        sx={{ borderRadius: 0.75 }}
        aria-label="Cambiar estado"
      >
        {etiqueta}
      </ButtonBase>
      <Menu anchorEl={ancla} open={!!ancla} onClose={() => setAncla(null)}>
        {opciones.map((o) => (
          <MenuItem
            key={o.accion}
            onClick={() =>
              o.accion === 'rechazar' ? (setAncla(null), setRechazando(true)) : cambiar(o.accion)
            }
          >
            <ListItemIcon>
              <Iconify icon={o.icono} sx={{ color: o.color }} />
            </ListItemIcon>
            {o.texto}
          </MenuItem>
        ))}
      </Menu>

      <Dialog
        open={rechazando}
        onClose={() => !enviando && setRechazando(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Rechazar el pago</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            #{d.numero} {d.nombre}. El destacamento podrá volver a pagar.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Motivo *"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. el comprobante no corresponde al monto."
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={enviando} onClick={() => setRechazando(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            loading={enviando}
            disabled={motivo.trim().length < 3}
            onClick={() => cambiar('rechazar', motivo.trim())}
          >
            Rechazar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
