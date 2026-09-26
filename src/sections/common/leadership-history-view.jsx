'use client';

import { useMemo } from 'react';
import { useSetState } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { fDate } from 'src/utils/format-time';
import { normalizeText } from 'src/utils/normalize-text';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import {
  useTable,
  emptyRows,
  TableNoData,
  getComparator,
  TableSkeleton,
  TableEmptyRows,
  TableHeadCustom,
  TablePaginationCustom,
} from 'src/components/table';

import { useLeadershipHistory } from './use-leadership-history';
import { CompactEntityTableCell } from './compact-entity-table-cell';

// ----------------------------------------------------------------------
// LA PESTAÑA "HISTORIA" de un destacamento, sección o región: mismo diseño de
// lista que Miembros o Destacamentos (buscador + tabla ordenable + paginación).
// Junta a quien ocupa el cargo HOY con quien lo ocupó antes (30+ días), sin
// separar por de qué organigrama sale el cargo.
// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'nombreMiembro', label: 'Miembro' },
  { id: 'cargoNombre', label: 'Posición' },
  { id: 'fechaInicio', label: 'Período' },
];

export function LeadershipHistoryView({ nivel, idEntidad }) {
  const { filas, cargando } = useLeadershipHistory({ nivel, idEntidad });
  const table = useTable({ defaultOrderBy: 'fechaInicio', defaultRowsPerPage: 10 });
  const filters = useSetState({ nombre: '' });

  const dataFiltered = useMemo(() => {
    const clave = normalizeText(filters.state.nombre);
    const filtradas = clave
      ? filas.filter((fila) => normalizeText(fila.nombreMiembro).includes(clave))
      : filas;

    const comparador = getComparator(table.order, table.orderBy);

    // Vigentes siempre primero: ordenar por columna no debe mezclarlos con el
    // resto, o "quién ocupa hoy" se pierde entre el historial.
    return [...filtradas].sort(
      (a, b) => (a.vigente === b.vigente ? 0 : a.vigente ? -1 : 1) || comparador(a, b)
    );
  }, [filas, filters.state.nombre, table.order, table.orderBy]);

  const dataInPage = dataFiltered.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  return (
    <Card>
      <Box sx={{ p: 2.5, pb: 0 }}>
        <TextField
          fullWidth
          value={filters.state.nombre}
          onChange={(event) => {
            table.onResetPage();
            filters.setState({ nombre: event.target.value });
          }}
          placeholder="Buscar por nombre..."
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Scrollbar>
        <Table sx={{ minWidth: 720 }}>
          <TableHeadCustom
            order={table.order}
            orderBy={table.orderBy}
            headCells={TABLE_HEAD}
            onSort={table.onSort}
          />

          <TableBody>
            {cargando && <TableSkeleton rowCount={table.rowsPerPage} cellCount={3} />}

            {!cargando &&
              dataInPage.map((fila) => (
                <TableRow key={fila.id}>
                  <CompactEntityTableCell
                    title={fila.nombreMiembro || 'Miembro'}
                    subtitle={fila.codigoMiembro}
                    avatarUrl={fila.fotoMiembro}
                  />

                  <TableCell>{fila.cargoNombre || 'Cargo'}</TableCell>

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

            <TableEmptyRows
              height={68}
              emptyRows={emptyRows(table.page, table.rowsPerPage, dataFiltered.length)}
            />

            {!cargando && !dataFiltered.length && (
              <TableNoData notFound sx={{ '--table-not-found-height': '240px' }} />
            )}
          </TableBody>
        </Table>
      </Scrollbar>

      <TablePaginationCustom
        page={table.page}
        dense={table.dense}
        count={dataFiltered.length}
        rowsPerPage={table.rowsPerPage}
        onPageChange={table.onChangePage}
        onRowsPerPageChange={table.onChangeRowsPerPage}
      />
    </Card>
  );
}
