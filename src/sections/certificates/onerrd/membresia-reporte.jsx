import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';

import {
  fechaReporteRegistro,
  filasReporteRegistro,
  LEYENDA_REPORTE_REGISTRO,
} from 'src/utils/reporte-registro-membresia.mjs';

import { Iconify } from 'src/components/iconify';

export function ReporteRegistroMembresia({ abierto, onCerrar, membresias, padron }) {
  const filas = useMemo(() => filasReporteRegistro(membresias, padron), [membresias, padron]);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');

  const descargar = async () => {
    setDescargando(true);
    setError('');
    let url;
    try {
      const { crearReporteRegistroPdf } = await import('./membresia-reporte-pdf');
      const documento = await crearReporteRegistroPdf(filas, new Date().toISOString());
      url = URL.createObjectURL(documento);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'ERRD-reporte-registro-anual-destacamentos-2027.pdf';
      enlace.click();
    } catch (e) {
      setError(e.message || 'No se pudo generar el reporte.');
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDescargando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle>Reporte de registro anual de destacamentos 2027</DialogTitle>
      <DialogContent dividers>
        {/* Papel blanco también en modo oscuro: si no, las letras salían blancas. */}
        <Box
          data-color-scheme="light"
          sx={{
            bgcolor: '#fff',
            color: '#171b27',
            p: { xs: 2, md: 5 },
            minHeight: 580,
            boxShadow: 1,
          }}
        >
          <Typography fontWeight={700} variant="subtitle1">
            Oficina Nacional de Exploradores del Rey, Rep. Dominicana 2027
          </Typography>
          <Typography fontStyle="italic" variant="body2">
            oficinanacional@errd.org.do
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1.5 }}>
            Reporte de registro anual de destacamentos · {filas.length} confirmados
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 690 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#eef2f8' }}>
                  <TableCell>Registro No.</TableCell>
                  <TableCell>Dest. No.</TableCell>
                  <TableCell>Fecha reg.</TableCell>
                  <TableCell>Región</TableCell>
                  <TableCell>Registrado por</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filas.map((fila) => (
                  <TableRow key={`${fila.id}-${fila.registro}`}>
                    <TableCell>{fila.registro}</TableCell>
                    <TableCell>{fila.destacamento}</TableCell>
                    <TableCell>{fechaReporteRegistro(fila.fecha)}</TableCell>
                    <TableCell>{fila.region}</TableCell>
                    <TableCell>{fila.registradoPor}</TableCell>
                  </TableRow>
                ))}
                {!filas.length && (
                  <TableRow>
                    <TableCell colSpan={5}>Aún no hay membresías confirmadas.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 3, maxWidth: 560, mx: 'auto' }}>
            <Typography variant="body2" fontStyle="italic">
              *Dest. Reconocido en último semestre de 2025
            </Typography>
            <Typography variant="body2" fontStyle="italic">
              **Dest. Reconocido en 2026
            </Typography>
            <Typography
              variant="body2"
              fontWeight={700}
              fontStyle="italic"
              sx={{ mt: 1, borderBottom: '1px solid #171b27' }}
            >
              Leyenda
            </Typography>
            {LEYENDA_REPORTE_REGISTRO.map(({ codigo, descripcion }) => (
              <Box key={codigo} sx={{ display: 'flex', gap: 2, py: 0.35 }}>
                <Typography variant="body2" sx={{ width: 70, flexShrink: 0, textAlign: 'right' }}>
                  {codigo}
                </Typography>
                <Typography variant="body2" fontStyle="italic">
                  {descripcion}
                </Typography>
              </Box>
            ))}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: 3,
                mt: 2.5,
              }}
            >
              <Typography variant="body2">Preparado por:</Typography>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  component="img"
                  src="/marca/reportes/firma-eliezer-garcia.png"
                  alt="Firma de Eliezer García"
                  sx={{
                    display: 'block',
                    width: 150,
                    height: 51,
                    objectFit: 'contain',
                    mx: 'auto',
                  }}
                />
                <Typography variant="body2">Eliezer García</Typography>
                <Typography variant="body2">Administrador ONERRD</Typography>
              </Box>
            </Box>
            <Box
              component="img"
              src="/marca/reportes/sello-oficina-nacional.png"
              alt="Sello de la Oficina Nacional"
              sx={{
                display: 'block',
                width: 145,
                height: 140,
                objectFit: 'contain',
                mx: 'auto',
                mt: 3,
              }}
            />
          </Box>
          <Typography variant="caption" component="p" sx={{ mt: 2, color: '#58647a' }}>
            Se incluyen las membresías 2027 con pago confirmado. La fecha corresponde a la
            confirmación del pago. El nombre mostrado es la persona que registró el destacamento al
            pagar.
          </Typography>
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onCerrar}>Cerrar</Button>
        <Button
          variant="contained"
          onClick={descargar}
          disabled={descargando}
          startIcon={<Iconify icon="solar:download-bold" />}
        >
          {descargando ? 'Generando PDF…' : 'Descargar PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
