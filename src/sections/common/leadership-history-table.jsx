'use client';

import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';

import { fDate } from 'src/utils/format-time';

import { Label } from 'src/components/label';
import { Scrollbar } from 'src/components/scrollbar';
import { TableSkeleton } from 'src/components/table';
import { EmptyContent } from 'src/components/empty-content';

import { CompactEntityTableCell } from './compact-entity-table-cell';

// ----------------------------------------------------------------------
// LA PESTAÑA "HISTORIA": una sola tabla, reusada en destacamento, sección,
// región (una entidad puntual) y en el Consejo Nacional (global, con
// `mostrarEntidad`). Las filas ya vienen combinadas y ordenadas por
// `combinarHistorialYVigentes` (src/utils/directiva-historial.mjs): vigentes
// primero, sin fecha de "hasta"; el resto con su "Desde / Hasta".
// ----------------------------------------------------------------------

export function LeadershipHistoryTable({ filas = [], loading = false, mostrarEntidad = false }) {
  return (
    <Scrollbar>
      <Table sx={{ minWidth: 720 }}>
        <TableHead>
          <TableRow>
            <TableCell>Miembro</TableCell>
            <TableCell>Posición</TableCell>
            {mostrarEntidad && <TableCell>Estructura</TableCell>}
            <TableCell width={220}>Período</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {loading && (
            <TableSkeleton rowCount={3} cellCount={mostrarEntidad ? 4 : 3} sx={{ height: 68 }} />
          )}

          {!loading &&
            filas.map((fila) => (
              <TableRow key={fila.id}>
                <CompactEntityTableCell
                  title={fila.nombreMiembro || 'Miembro'}
                  subtitle={fila.codigoMiembro}
                  avatarUrl={fila.fotoMiembro}
                />

                <TableCell>{fila.cargoNombre || 'Cargo'}</TableCell>

                {mostrarEntidad && <TableCell>{fila.entidadNombre || '-'}</TableCell>}

                <TableCell>
                  {fila.vigente ? (
                    <Label color="success">Vigente</Label>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Desde {fDate(fila.fechaInicio)} · Hasta {fDate(fila.fechaFin)}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}

          {!loading && !filas.length && (
            <TableRow>
              <TableCell colSpan={mostrarEntidad ? 4 : 3} sx={{ p: 0 }}>
                <EmptyContent
                  filled
                  title="Todavía no hay historial"
                  description="Cuando alguien deje un cargo, va a aparecer acá con las fechas de cuándo lo ocupó."
                  sx={{ py: 10 }}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Scrollbar>
  );
}
