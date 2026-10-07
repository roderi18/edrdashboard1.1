import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { formatearFechaOnerrd, urlDelCertificadoOnerrd } from 'src/utils/certificado-onerrd.mjs';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

// ----------------------------------------------------------------------
// CERTIFICADOS ONERRD EMITIDOS: cada número con sus datos. Se vuelven a
// descargar con el diseño que tenían al emitirse (va guardado con ellos).
// ----------------------------------------------------------------------

export function EmitidosOnerrd({ emitidos, descargando, onDescargar }) {
  return (
    <Card sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ p: 2.5, pb: 1 }}>
        Certificados emitidos
      </Typography>
      {!emitidos.length ? (
        <Typography variant="body2" sx={{ px: 2.5, pb: 2.5, color: 'text.secondary' }}>
          Todavía no se ha emitido ninguno. Cada certificado emitido recibe su número y queda aquí.
        </Typography>
      ) : (
        <TableContainer>
          <Scrollbar>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Registro No.</TableCell>
                  <TableCell>Destacamento</TableCell>
                  <TableCell>Iglesia</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Emitido por</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {emitidos.map((emitido) => (
                  <TableRow key={emitido.id} hover>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {emitido.numeroRegistro}
                    </TableCell>
                    <TableCell>
                      {[emitido.valores?.numeroDestacamento, emitido.valores?.nombreDestacamento]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </TableCell>
                    <TableCell>{emitido.valores?.iglesia || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatearFechaOnerrd(emitido.valores?.fecha) || '—'}
                    </TableCell>
                    <TableCell>{emitido.emitidoPor?.nombre || '—'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {emitido.claveAcceso && (
                        // Lo mismo que abre su código QR (si el PDF ya se publicó).
                        <Tooltip title="Abrir lo que abre el código QR">
                          <IconButton
                            component="a"
                            href={urlDelCertificadoOnerrd(
                              window.location.origin,
                              emitido.numeroRegistro,
                              emitido.claveAcceso
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Iconify icon="eva:external-link-fill" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Volver a descargar el PDF (y volver a publicarlo para el QR)">
                        <span>
                          <IconButton disabled={!!descargando} onClick={() => onDescargar(emitido)}>
                            {descargando === emitido.id ? (
                              <CircularProgress size={18} />
                            ) : (
                              <Iconify icon="solar:download-bold" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      )}
    </Card>
  );
}
