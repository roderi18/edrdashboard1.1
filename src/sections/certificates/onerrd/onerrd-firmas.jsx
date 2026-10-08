import { useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import {
  guardarFirmaOnerrd,
  retirarFirmaOnerrd,
  renombrarFirmaOnerrd,
} from 'src/services/certificado-onerrd-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { prepararImagenOnerrd, TIPOS_DE_IMAGEN_ONERRD } from './imagenes-onerrd';

// ----------------------------------------------------------------------
// FIRMAS: una biblioteca (imagen + nombre de quien firma) y dos ranuras en el
// certificado. Elegir quién firma en cada ranura cambia la imagen; la
// posición y el tamaño son de la ranura y se guardan con el diseño.
// ----------------------------------------------------------------------

function DialogoSubirFirma({ open, onClose, onSubida, user }) {
  const entradaRef = useRef(null);
  const [nombre, setNombre] = useState('');
  const [preparada, setPreparada] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => {
    setNombre('');
    setPreparada(null);
    onClose();
  };

  const elegirArchivo = async (archivo) => {
    if (!archivo) return;
    try {
      // El archivo tal cual va también, para guardar su original en Storage.
      setPreparada({
        ...(await prepararImagenOnerrd(archivo, { ladoMaximo: 1000 })),
        original: archivo,
      });
      if (!nombre) setNombre(archivo.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const firma = await guardarFirmaOnerrd({ nombre, ...preparada, user });
      if (firma?.rutaArchivo) toast.success('Firma guardada (con su imagen original en Firebase).');
      else toast.warning('Firma guardada, pero su imagen original no se pudo guardar en Firebase.');
      onSubida(firma);
      cerrar();
    } catch (error) {
      console.error('[onerrd] no se pudo guardar la firma', error);
      toast.error('No se pudo guardar la firma. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onClose={guardando ? undefined : cerrar} fullWidth maxWidth="xs">
      <DialogTitle>Subir firma</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Box
            onClick={() => entradaRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              elegirArchivo(event.dataTransfer.files?.[0]);
            }}
            sx={{
              height: 140,
              borderRadius: 1.5,
              cursor: 'pointer',
              border: (theme) => `2px dashed ${theme.vars.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // Fondo de cuadros: así se ve si la firma trae el fondo transparente.
              background:
                'repeating-conic-gradient(#f1f1f1 0% 25%, #ffffff 0% 50%) 50% / 16px 16px',
            }}
          >
            {preparada ? (
              <Box
                component="img"
                src={preparada.dataUrl}
                alt="Firma"
                sx={{ maxHeight: 120, maxWidth: '90%' }}
              />
            ) : (
              <Stack alignItems="center" spacing={0.5} sx={{ color: 'text.secondary' }}>
                <Iconify icon="eva:cloud-upload-fill" width={32} />
                <Typography variant="body2">
                  PNG, JPG o WebP (mejor con fondo transparente)
                </Typography>
              </Stack>
            )}
          </Box>
          <input
            ref={entradaRef}
            hidden
            type="file"
            accept={TIPOS_DE_IMAGEN_ONERRD.join(',')}
            onChange={(event) => {
              elegirArchivo(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <TextField
            label="Nombre de quien firma"
            placeholder="Ej.: Director Nacional — Juan Pérez"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 80 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        <LoadingButton
          variant="contained"
          loading={guardando}
          disabled={!preparada || !nombre.trim()}
          onClick={guardar}
        >
          Guardar firma
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

export function FirmasOnerrd({
  diseno,
  firmasActivas,
  user,
  onCambiarRanura,
  onFirmasCambiaron,
  onSeleccionar,
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [retirar, setRetirar] = useState(null);
  const [editando, setEditando] = useState(null);

  const alSubir = (firma) => {
    onFirmasCambiaron();
    // La primera ranura vacía la toma sola: lo normal es subirla para usarla.
    const libre = diseno.firmas.find(
      (ranura) => !firmasActivas.some((item) => item.id === ranura.idFirma)
    );
    if (libre) {
      onCambiarRanura(libre.id, { idFirma: firma.id });
      onSeleccionar({ tipo: 'firma', id: libre.id });
    }
  };

  const confirmarRetiro = async () => {
    const firma = retirar;
    setRetirar(null);
    try {
      await retirarFirmaOnerrd({ id: firma.id, nombre: firma.nombre, user });
      diseno.firmas
        .filter((ranura) => ranura.idFirma === firma.id)
        .forEach((ranura) => onCambiarRanura(ranura.id, { idFirma: '' }));
      onFirmasCambiaron();
      toast.success('Firma retirada. Los certificados ya emitidos la conservan.');
    } catch (error) {
      console.error('[onerrd] no se pudo retirar la firma', error);
      toast.error('No se pudo retirar la firma.');
    }
  };

  const guardarNombre = async () => {
    const { id, nombre, anterior } = editando;
    setEditando(null);
    if (!nombre.trim() || nombre.trim() === anterior) return;
    try {
      await renombrarFirmaOnerrd({ id, nombre, anterior, user });
      onFirmasCambiaron();
    } catch (error) {
      console.error('[onerrd] no se pudo renombrar la firma', error);
      toast.error('No se pudo cambiar el nombre.');
    }
  };

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Firmas
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={() => setSubiendo(true)}
        >
          Subir firma
        </Button>
      </Stack>

      <Stack spacing={1.5}>
        {diseno.firmas.map((ranura) => (
          <TextField
            key={ranura.id}
            select
            size="small"
            label={ranura.etiqueta}
            value={firmasActivas.some((firma) => firma.id === ranura.idFirma) ? ranura.idFirma : ''}
            onChange={(event) => {
              onCambiarRanura(ranura.id, { idFirma: event.target.value });
              onSeleccionar({ tipo: 'firma', id: ranura.id });
            }}
          >
            <MenuItem value="">Sin firma</MenuItem>
            {firmasActivas.map((firma) => (
              <MenuItem key={firma.id} value={firma.id}>
                {firma.nombre}
              </MenuItem>
            ))}
          </TextField>
        ))}
      </Stack>

      {!!firmasActivas.length && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            Biblioteca
          </Typography>
          {firmasActivas.map((firma) => (
            <Stack key={firma.id} direction="row" alignItems="center" spacing={1.5}>
              <Box
                component="img"
                src={firma.dataUrl}
                alt={firma.nombre}
                sx={{
                  width: 64,
                  height: 32,
                  objectFit: 'contain',
                  bgcolor: 'common.white',
                  borderRadius: 0.5,
                }}
              />
              {editando?.id === firma.id ? (
                <TextField
                  autoFocus
                  size="small"
                  value={editando.nombre}
                  onChange={(event) => setEditando({ ...editando, nombre: event.target.value })}
                  onBlur={guardarNombre}
                  onKeyDown={(event) => event.key === 'Enter' && guardarNombre()}
                  slotProps={{ htmlInput: { maxLength: 80 } }}
                  sx={{ flex: 1 }}
                />
              ) : (
                <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                  {firma.nombre}
                </Typography>
              )}
              <Tooltip title="Cambiar nombre">
                <IconButton
                  size="small"
                  onClick={() =>
                    setEditando({ id: firma.id, nombre: firma.nombre, anterior: firma.nombre })
                  }
                >
                  <Iconify icon="solar:pen-bold" width={18} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Retirar (no se borra)">
                <IconButton size="small" color="error" onClick={() => setRetirar(firma)}>
                  <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </Stack>
      )}

      <DialogoSubirFirma
        open={subiendo}
        onClose={() => setSubiendo(false)}
        onSubida={alSubir}
        user={user}
      />

      <ConfirmDialog
        open={!!retirar}
        onClose={() => setRetirar(null)}
        title="Retirar firma"
        content={`"${retirar?.nombre}" dejará de ofrecerse para firmar. Los certificados ya emitidos la conservan.`}
        action={
          <Button variant="contained" color="error" onClick={confirmarRetiro}>
            Retirar
          </Button>
        }
      />
    </Card>
  );
}
