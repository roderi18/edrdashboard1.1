'use client';

import { useSetState } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableBody from '@mui/material/TableBody';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';

import { normalizeText } from 'src/utils/normalize-text';
import { getMemberFullName } from 'src/utils/get-member-fullname';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import {
  quitarAdministradorAMiembro,
  asignarAdministradorDesdeMiembro,
} from 'src/utils/firebase-admins';

import { getMembers } from 'src/services/member-service';
import { DashboardContent } from 'src/layouts/dashboard';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
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

import { useAuthContext } from 'src/auth/hooks';

import { AdminCardList } from '../admin-card-list';
import { AdminTableRow } from '../admin-table-row';
import { AdminTableToolbar } from '../admin-table-toolbar';
import { AdminAsignarCargoDialog } from '../admin-asignar-cargo-dialog';
import {
  useDatosDeAdministradores,
  COLUMNAS_DE_ADMINISTRADORES,
} from '../use-datos-de-administradores';

// ----------------------------------------------------------------------

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
  const { user } = useAuthContext();
  const table = useTable();
  const [members, setMembers] = useState([]);
  const [displayMode, setDisplayMode] = useState('panel');
  // Los MISMOS datos que la lista de administradores, por el mismo gancho: es lo
  // que hace que las dos tablas enseñen lo mismo sin tener que acordarse de
  // cambiar las dos.
  const { dests, catalogos, conCargos } = useDatosDeAdministradores();

  const [assignRows, setAssignRows] = useState([]);
  const [removeAdminRow, setRemoveAdminRow] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRemovingAdmin, setIsRemovingAdmin] = useState(false);
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

  const handleOpenAssignDialog = useCallback((rows) => {
    const nextRows = Array.isArray(rows) ? rows : [rows];
    setAssignRows(nextRows.filter(Boolean));
  }, []);

  const handleCloseAssignDialog = useCallback(() => {
    if (!isAssigning) {
      setAssignRows([]);
    }
  }, [isAssigning]);

  const handleConfirmAssignAdmins = useCallback(async (rolElegido) => {
    if (!assignRows.length || !rolElegido) {
      return;
    }

    setIsAssigning(true);

    try {
      const assignedAdmins = await Promise.all(
        assignRows.map((row) =>
          asignarAdministradorDesdeMiembro(row, { usuario: user, rolDeAdministracion: rolElegido })
        )
      );
      const assignedIds = new Set(assignRows.map((row) => String(row.id)));

      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          assignedIds.has(String(member.id))
            ? {
              ...member,
              adminId:
                assignedAdmins.find((admin) => String(admin.idMiembros) === String(member.id))?.id ||
                member.adminId,
              rol: 'administrador',
              esAdministrador: true,
            }
            : member
        )
      );

      const assignedNames = assignRows.map((row) => row.name).filter(Boolean);

      toast.success(
        assignRows.length === 1
          ? `${assignedNames[0]} fue asignado como administrador.`
          : `${assignRows.length} administradores asignados correctamente.`,
        {
          description:
            assignRows.length === 1
              ? 'El rol se guardó como administrador.'
              : 'El rol de cada miembro se guardó como administrador.',
        }
      );

      table.onSelectAllRows(false, []);
      setAssignRows([]);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo asignar el administrador.');
    } finally {
      setIsAssigning(false);
    }
  }, [assignRows, table, user]);

  const handleAssignSelectedAdmins = useCallback(async () => {
    const selectedRows = members.filter((member) => table.selected.includes(member.id));

    if (!selectedRows.length) {
      toast.error('Selecciona al menos un miembro.');
      return;
    }

    handleOpenAssignDialog(selectedRows);
  }, [handleOpenAssignDialog, members, table.selected]);

  const handleCloseRemoveAdmin = useCallback(() => {
    if (!isRemovingAdmin) {
      setRemoveAdminRow(null);
    }
  }, [isRemovingAdmin]);

  const handleConfirmRemoveAdmin = useCallback(async () => {
    if (!removeAdminRow) {
      return;
    }

    setIsRemovingAdmin(true);

    try {
      await quitarAdministradorAMiembro(removeAdminRow, { usuario: user });

      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          String(member.id) === String(removeAdminRow.id)
            ? {
              ...member,
              adminId: '',
              rol: 'usuario',
              esAdministrador: false,
            }
            : member
        )
      );

      toast.success(`${removeAdminRow.name || 'El usuario'} ahora es un usuario común.`);
      setRemoveAdminRow(null);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo quitar el administrador.');
    } finally {
      setIsRemovingAdmin(false);
    }
  }, [removeAdminRow, user]);

  const handleRoleSaved = useCallback((memberRow, assignment) => {
    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        String(member.id) === String(memberRow?.id)
          ? {
              ...member,
              rol: assignment.rolNombre || assignment.rolId,
              role: assignment.rolId,
              rolId: assignment.rolId,
              rolNombre: assignment.rolNombre,
              alcance: assignment.alcance,
              permisosRol: assignment.permisos,
            }
          : member
      )
    );
  }, []);

  const dataFiltered = conCargos(applyFilter({ inputData: members, filters: currentFilters }));
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
                    <IconButton color="primary" onClick={handleAssignSelectedAdmins}>
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
                    headCells={COLUMNAS_DE_ADMINISTRADORES}
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
                        dests={dests}
                        catalogos={catalogos}
                        selected={table.selected.includes(row.id)}
                        onSelectRow={() => table.onSelectRow(row.id)}
                        onAssignAdmin={handleOpenAssignDialog}
                        onRemoveAdmin={setRemoveAdminRow}
                        onRoleSaved={handleRoleSaved}
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
          <AdminCardList admins={dataFiltered} dests={dests} />
        )}
      </Card>

      {/* SE ELIGE EL CARGO. Antes era un "¿seguro?" que nombraba Administrador
          Global sin preguntar: el cargo con mas poder de la plataforma se daba
          con un si. */}
      <AdminAsignarCargoDialog
        open={Boolean(assignRows.length)}
        personas={assignRows}
        guardando={isAssigning}
        onClose={handleCloseAssignDialog}
        onConfirm={handleConfirmAssignAdmins}
      />

      <ConfirmDialog
        open={Boolean(removeAdminRow)}
        onClose={handleCloseRemoveAdmin}
        title="Quitar administrador"
        content={`¿Realmente quieres quitar administrador a ${removeAdminRow?.name || 'este usuario'
          }? Al confirmar pasará a usuario común.`}
        action={
          <Button
            color="error"
            variant="contained"
            loading={isRemovingAdmin}
            onClick={handleConfirmRemoveAdmin}
          >
            Quitar administrador
          </Button>
        }
      />
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
