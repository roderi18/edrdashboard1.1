'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { Label } from 'src/components/label';
import { Scrollbar } from 'src/components/scrollbar';
import { TableHeadCustom } from 'src/components/table';

const TABLE_HEAD = [
  { id: 'fecha', label: 'Fecha', width: 120 },
  { id: 'modulo', label: 'Módulo', width: 180 },
  { id: 'afectado', label: 'Qué se afectó', width: 220 },
  { id: 'antes', label: 'Antes', width: 260 },
  { id: 'despues', label: 'Despues', width: 260 },
  { id: 'realizadoPor', label: 'Quién lo realizó', width: 220 },
];

function HistoryValue({ label, value }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2">{value || 'Sin dato'}</Typography>
    </Stack>
  );
}

const FILTER_INITIAL_STATE = {
  fecha: '',
  modulo: '',
  afectado: '',
  realizadoPor: '',
};

function getUniqueOptions(logs, key) {
  return [...new Set(logs.map((item) => item[key]).filter(Boolean))];
}

export function MemberHistoryLog({ memberName, logs = [] }) {
  const [filters, setFilters] = useState(FILTER_INITIAL_STATE);

  const filterOptions = useMemo(
    () => ({
      fechas: getUniqueOptions(logs, 'fecha'),
      modulos: getUniqueOptions(logs, 'modulo'),
      afectados: getUniqueOptions(logs, 'afectado'),
      responsables: getUniqueOptions(logs, 'realizadoPor'),
    }),
    [logs]
  );

  const dataFiltered = useMemo(
    () =>
      logs.filter(
        (item) =>
          (!filters.fecha || item.fecha === filters.fecha) &&
          (!filters.modulo || item.modulo === filters.modulo) &&
          (!filters.afectado || item.afectado === filters.afectado) &&
          (!filters.realizadoPor || item.realizadoPor === filters.realizadoPor)
      ),
    [filters, logs]
  );

  const handleChangeFilter = (name) => (event) => {
    setFilters((current) => ({ ...current, [name]: event.target.value }));
  };

  return (
    <Card>
      <CardHeader
        title="Historial de cambios"
        subheader={
          memberName
            ? `Cambios recientes registrados para ${memberName}`
            : 'Cambios recientes registrados para este miembro'
        }
        sx={{ pb: 3 }}
      />

      <Divider />

      <Box
        sx={{
          gap: 2,
          p: 3,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
        }}
      >
        <TextField select label="Fecha" value={filters.fecha} onChange={handleChangeFilter('fecha')}>
          <MenuItem value="">Todas</MenuItem>
          {filterOptions.fechas.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Módulo"
          value={filters.modulo}
          onChange={handleChangeFilter('modulo')}
        >
          <MenuItem value="">Todos</MenuItem>
          {filterOptions.modulos.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Qué se afectó"
          value={filters.afectado}
          onChange={handleChangeFilter('afectado')}
        >
          <MenuItem value="">Todo</MenuItem>
          {filterOptions.afectados.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Quién lo realizó"
          value={filters.realizadoPor}
          onChange={handleChangeFilter('realizadoPor')}
        >
          <MenuItem value="">Todos</MenuItem>
          {filterOptions.responsables.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Divider />

      <Box sx={{ position: 'relative' }}>
        <TableContainer sx={{ overflow: 'unset' }}>
          <Scrollbar>
            <Table sx={{ minWidth: 1060 }}>
              <TableHeadCustom headCells={TABLE_HEAD} />

              <TableBody>
                {dataFiltered.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">{row.fecha}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {row.hora}
                        </Typography>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Label color="info">{row.modulo}</Label>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">{row.afectado}</Typography>
                    </TableCell>

                    <TableCell>
                      <HistoryValue label="Valor anterior" value={row.antes} />
                    </TableCell>

                    <TableCell>
                      <HistoryValue label="Valor nuevo" value={row.despues} />
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">{row.realizadoPor}</Typography>
                    </TableCell>
                  </TableRow>
                ))}

                {!dataFiltered.length && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No hay registros con esos filtros.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Box>
    </Card>
  );
}
