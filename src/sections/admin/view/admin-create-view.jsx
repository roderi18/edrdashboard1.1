'use client';

import { useState, useEffect } from 'react';
import { useSetState } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Tooltip from '@mui/material/Tooltip';
import TableBody from '@mui/material/TableBody';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';

import { normalizeText } from 'src/utils/normalize-text';
import { getMemberFullName } from 'src/utils/get-member-fullname';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';

import { getMembers } from 'src/services/member-service';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import {
  useTable,
  rowInPage,
  TableNoData,
  TableEmptyRows,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

import { AdminCardList } from '../admin-card-list';
import { AdminTableRow } from '../admin-table-row';
import { AdminTableToolbar } from '../admin-table-toolbar';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Nombre' },
  { id: 'codigoMiembro', label: 'Codigo' },
  { id: 'idMiembros', label: 'ID miembro' },
  { id: 'estatus', label: 'Estado' },
  { id: 'rol', label: 'Rol' },
  { id: '', width: 88 },
];

const mapMemberRow = ({ member, photo }) => ({
  ...member,
  idMiembros: member.id,
  memberId: member.id,
  memberCode: member.memberId || member.codigoMiembro || '',
  name: getMemberFullName(member),
  email: member.email || '',
  avatarUrl: photo?.urlFoto || member.avatarUrl || '',
  estatus: member.status || 'activo',
  rol: 'pendiente',
});

export function AdminCreateView() {
  const table = useTable();
  const [members, setMembers] = useState([]);
  const [displayMode, setDisplayMode] = useState('panel');
  const filters = useSetState({ name: '' });
  const { state: currentFilters } = filters;

  useEffect(() => {
    const loadData = async () => {
      const [memberRows, memberPhotos] = await Promise.all([
        getMembers(),
        obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' }),
      ]);

      setMembers(
        memberRows.map((member) =>
          mapMemberRow({
            member,
            photo: memberPhotos[String(member.id)],
          })
        )
      );
    };

    loadData();
  }, []);

  const dataFiltered = applyFilter({ inputData: members, filters: currentFilters });
  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);
  const notFound = !dataFiltered.length;

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Crear administrador"
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Administradores', href: paths.dashboard.admin.root },
          { name: 'Crear administrador' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <AdminTableToolbar
          filters={filters}
          onResetPage={table.onResetPage}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
        />

        {displayMode === 'panel' ? (
          <>
            <Box sx={{ position: 'relative' }}>
              <TableSelectedAction
                dense={table.dense}
                numSelected={table.selected.length}
                rowCount={dataFiltered.length}
                onSelectAllRows={(checked) =>
                  table.onSelectAllRows(
                    checked,
                    dataFiltered.map((row) => row.id)
                  )
                }
                action={
                  <Tooltip title="Asignar administrador">
                    <IconButton color="primary">
                      <Iconify icon="solar:user-plus-bold" />
                    </IconButton>
                  </Tooltip>
                }
              />

              <Scrollbar>
                <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
                  <TableHeadCustom
                    order={table.order}
                    orderBy={table.orderBy}
                    headCells={TABLE_HEAD}
                    rowCount={dataFiltered.length}
                    numSelected={table.selected.length}
                    onSort={table.onSort}
                    onSelectAllRows={(checked) =>
                      table.onSelectAllRows(
                        checked,
                        dataFiltered.map((row) => row.id)
                      )
                    }
                  />

                  <TableBody>
                    {dataInPage.map((row) => (
                      <AdminTableRow
                        key={row.id}
                        row={row}
                        selected={table.selected.includes(row.id)}
                        onSelectRow={() => table.onSelectRow(row.id)}
                      />
                    ))}

                    <TableEmptyRows
                      height={table.dense ? 56 : 76}
                      emptyRows={Math.max(0, table.rowsPerPage - dataInPage.length)}
                    />

                    <TableNoData notFound={notFound} />
                  </TableBody>
                </Table>
              </Scrollbar>
            </Box>

            <TablePaginationCustom
              page={table.page}
              dense={table.dense}
              count={dataFiltered.length}
              rowsPerPage={table.rowsPerPage}
              rowsPerPageOptions={[5, 10, 25]}
              onPageChange={table.onChangePage}
              onChangeDense={table.onChangeDense}
              onRowsPerPageChange={table.onChangeRowsPerPage}
            />
          </>
        ) : (
          <AdminCardList admins={dataFiltered} />
        )}
      </Card>
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, filters }) {
  const { name } = filters;

  if (!name) return inputData;

  return inputData.filter((member) =>
    normalizeText(`${member.name || ''} ${member.email || ''} ${member.memberCode || ''}`).includes(
      normalizeText(name)
    )
  );
}
