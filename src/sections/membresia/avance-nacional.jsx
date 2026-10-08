'use client';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

// ----------------------------------------------------------------------
// AVANCE NACIONAL (requerimientos §10-11): por región, cuántos destacamentos
// hay, cuántos pagaron y el porcentaje. Sin personas ni montos: lo calcula
// `/api/estadisticas`. % = membresías confirmadas ÷ destacamentos habilitados.
// ----------------------------------------------------------------------

export function AvanceNacional() {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/estadisticas/')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((datos) => setFilas(Array.isArray(datos) ? datos : []))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <Alert severity="warning">No se pudo calcular el avance nacional. Intenta más tarde.</Alert>
    );
  }

  return (
    <Card variant="outlined">
      <TableContainer>
        <Table size="small" sx={{ minWidth: 560 }}>
          <TableHead>
            <TableRow>
              <TableCell>Región</TableCell>
              <TableCell align="center">Destacamentos</TableCell>
              <TableCell align="center">Pagadas</TableCell>
              <TableCell align="center">Pendientes</TableCell>
              <TableCell sx={{ width: '36%' }}>Cumplimiento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!filas &&
              [0, 1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton height={28} />
                  </TableCell>
                </TableRow>
              ))}
            {filas?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}
                  >
                    Aún no hay membresías registradas.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {filas?.map((fila) => (
              <TableRow key={fila.region}>
                <TableCell sx={{ fontWeight: 600 }}>{fila.region}</TableCell>
                <TableCell align="center">{fila.total}</TableCell>
                <TableCell align="center" sx={{ color: 'success.dark', fontWeight: 600 }}>
                  {fila.pagadas}
                </TableCell>
                <TableCell align="center" sx={{ color: 'error.main', fontWeight: 600 }}>
                  {fila.pendientes}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, fila.porcentaje)}
                      sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
                    />
                    <Typography variant="caption" sx={{ minWidth: 44, textAlign: 'right' }}>
                      {fila.porcentaje.toFixed(1)} %
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
