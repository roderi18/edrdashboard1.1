import dayjs from 'dayjs';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import Tooltip from '@mui/material/Tooltip';
import TableBody from '@mui/material/TableBody';
import IconButton from '@mui/material/IconButton';
import TableContainer from '@mui/material/TableContainer';
import { tableCellClasses } from '@mui/material/TableCell';
import { tablePaginationClasses } from '@mui/material/TablePagination';

import { guardarProgresoAscensoMiembro } from 'src/services/member-awards-service';
import {
  getAwardsProgressCache,
  setAwardsProgressCache,
  notifyAwardsProgressChanged,
} from 'src/services/awards-progress-cache';

import { Iconify } from 'src/components/iconify';
import {
  TableNoData,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

import { AwardsManagerTableRow } from './awards-manager-table-row';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Nombre' },
  { id: 'size', label: 'Size', width: 120 },
  { id: 'type', label: 'Type', width: 120 },
  { id: 'modifiedAt', label: 'Modified', width: 140 },
  { id: 'shared', label: 'Shared', align: 'right', width: 140 },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------

export function AwardsManagerTable({
  memberId,
  sx,
  table,
  notFound,
  onDeleteRow,
  dataFiltered,
  allData,
  onOpenConfirm,
  headCells,
  isRootFolder,
  isAcademiaSubFolder,
  isSistemaAscensoSubFolder,
  isSistemaAscensoDeepSubFolder,
  isSistemaAscenso,
  isSistemaAscensoRootFolder,
  readOnly = false,

  ...other
}) {
  const { user } = useAuthContext();
  const {
    dense,
    page,
    order,
    orderBy,
    rowsPerPage,
    /********/
    selected,
    onSelectRow,
    onSelectAllRows,
    /********/
    onSort,
    onChangeDense,
    onChangePage,
    onChangeRowsPerPage,
  } = table;
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMarkCompleted = () => {
    const { status: currentStatus = {}, data: currentData = {} } = getAwardsProgressCache(memberId);

    const ROOT_ID = 'sistemaAscenso';
    const ACADEMIA_ROOT_ID = 'academia';
    const now = new Date().toISOString();
    const today = dayjs().toISOString();

    selected.forEach((rowId) => {

      const row = dataFiltered.find((r) => r.id === rowId);

      if (!row) {
        return;
      }
      const parentId = row.parentId;
      const sectionId = allData.find((i) => i.id === parentId)?.parentId;


      if (!sectionId || !parentId) {
        return;
      }
      // 🔴 ESTADO (ESTO ES LO CLAVE)
      currentStatus[ROOT_ID] ??= {};
      currentStatus[ROOT_ID][sectionId] ??= {};
      currentStatus[ROOT_ID][sectionId][parentId] ??= {};
      currentStatus[ROOT_ID][sectionId][parentId][rowId] = 'completado';

      // ==============================
      // 🟣 SISTEMA DE ASCENSO
      // ==============================
      currentData.sistemaAscenso ??= {};
      currentData.sistemaAscenso[sectionId] ??= {};
      currentData.sistemaAscenso[sectionId][parentId] ??= {};
      currentData.sistemaAscenso[sectionId][parentId][rowId] = {
        ...(currentData.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId] || {}),
        status: 'completado',
        completedDate: today,
        timesCompleted:
          currentData.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId]?.timesCompleted
            ? currentData.sistemaAscenso[sectionId][parentId][rowId].timesCompleted
            : 1,
        updatedAt: now,
      };
      // ==============================
      // 🟣 ACADEMIA MINISTERIAL
      // ==============================
      if (isAcademiaSubFolder) {
        currentStatus[ACADEMIA_ROOT_ID] ??= {};
        currentStatus[ACADEMIA_ROOT_ID][parentId] ??= {};
        currentStatus[ACADEMIA_ROOT_ID][parentId][rowId] = 'completado';

        currentData.academia ??= {};
        currentData.academia[parentId] ??= {};
        currentData.academia[parentId][rowId] = {
          ...(currentData.academia?.[parentId]?.[rowId] || {}),
          status: 'completado',
          completedDate: today,
          updatedAt: now,
        };
      }

      guardarProgresoAscensoMiembro({
        idMiembro: memberId,
        vinculo: {
          id: isAcademiaSubFolder
            ? `academia_${parentId}_${rowId}`
            : `sistemaAscenso_${sectionId}_${parentId}_${rowId}`,
          idItemAscenso: rowId,
          nombreItemAscenso: row.name || row.nombre || rowId,
          sistema: isAcademiaSubFolder ? 'academia' : 'sistemaAscenso',
          idDivision: isAcademiaSubFolder ? '' : sectionId || '',
          nombreDivision: isAcademiaSubFolder ? '' : allData.find((item) => item.id === sectionId)?.name || '',
          idGrupo: parentId,
          nombreGrupo: allData.find((item) => item.id === parentId)?.name || parentId,
          activo: true,
        },
        estado: 'completado',
        fechaCompletado: today,
        vecesCompletado: 1,
        user,
      }).catch(() => null);
    });

    setAwardsProgressCache(memberId, { status: currentStatus, data: currentData });
    setRefreshKey((v) => v + 1);
    notifyAwardsProgressChanged(memberId);

  };

  return (
    <>
      <Box
        sx={[
          (theme) => ({ position: 'relative', m: { md: theme.spacing(-2, -3, 0, -3) } }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        <TableSelectedAction
          dense={dense}
          numSelected={selected.length}
          rowCount={dataFiltered.length}
          onSelectAllRows={(checked) =>
            onSelectAllRows(
              checked,
              dataFiltered.map((row) => row.id)
            )
          }
          action={
            <>
              {!readOnly && (
                <Tooltip title="Marcar como completados">
                  <IconButton color="primary" onClick={handleMarkCompleted}>
                    <Iconify icon="mdi:check-all" />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title="Share">
                <IconButton color="primary">
                  <Iconify icon="solar:share-bold" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Eliminar">
                <IconButton color="primary" onClick={onOpenConfirm}>
                  <Iconify icon="solar:trash-bin-trash-bold" />
                </IconButton>
              </Tooltip>
            </>
          }
          sx={{
            pl: 1,
            pr: 2,
            top: 16,
            left: 24,
            right: 24,
            width: 'auto',
            borderRadius: 1.5,
          }}
        />

        <TableContainer sx={{ px: { md: 3 } }}>
          <Table
            size={dense ? 'small' : 'medium'}
            sx={{ minWidth: 960, borderCollapse: 'separate', borderSpacing: '0 16px' }}
          >
            <TableHeadCustom
              order={order}
              orderBy={orderBy}
              headCells={headCells ?? TABLE_HEAD} // ...
              rowCount={dataFiltered.length}
              numSelected={selected.length}
              onSort={onSort}
              onSelectAllRows={(checked) =>
                onSelectAllRows(
                  checked,
                  dataFiltered.map((row) => row.id)
                )
              }
              sx={{
                [`& .${tableCellClasses.head}`]: {
                  '&:first-of-type': { borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
                  '&:last-of-type': { borderTopRightRadius: 12, borderBottomRightRadius: 12 },
                },
              }}
            />

            <TableBody>
              {dataFiltered
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => (
                  <AwardsManagerTableRow
                    key={`${row.id}-${refreshKey}`}
                    memberId={memberId}
                    row={row}
                    tableData={dataFiltered}
                    allData={allData}
                    isRootFolder={isRootFolder}
                    isAcademiaSubFolder={isAcademiaSubFolder}
                    isSistemaAscensoSubFolder={isSistemaAscensoSubFolder}
                    isSistemaAscensoDeepSubFolder={isSistemaAscensoDeepSubFolder}
                    isSistemaAscenso={isSistemaAscenso}
                    selected={selected.includes(row.id)}
                    onSelectRow={() => onSelectRow(row.id)}
                    onDeleteRow={() => onDeleteRow(row.id)}
                    readOnly={readOnly}
                  />
                ))}

              <TableNoData
                notFound={notFound}
                sx={[
                  (theme) => ({
                    m: -2,
                    borderRadius: 1.5,
                    border: `dashed 1px ${theme.vars.palette.divider}`,
                  }),
                ]}
              />
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <TablePaginationCustom
        page={page}
        dense={dense}
        rowsPerPage={rowsPerPage}
        count={dataFiltered.length}
        onPageChange={onChangePage}
        onChangeDense={onChangeDense}
        onRowsPerPageChange={onChangeRowsPerPage}
        sx={{ [`& .${tablePaginationClasses.toolbar}`]: { borderTopColor: 'transparent' } }}
      />
    </>
  );
}
