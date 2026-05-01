'use client';

import { useState, useEffect } from 'react';
import { useSetState } from 'minimal-shared/hooks';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';

import { normalizeText } from 'src/utils/normalize-text';
import { getMemberFullName } from 'src/utils/get-member-fullname';
import { obtenerAdministradores } from 'src/utils/firebase-admins';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';

import { getMembers } from 'src/services/member-service';

import { Scrollbar } from 'src/components/scrollbar';
import { useTable, TableNoData, TableHeadCustom } from 'src/components/table';

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

const resolveAdminMember = (admin, members) => {
  const idMiembros = admin.idMiembros || admin.memberId;

  if (idMiembros) {
    return members.find((member) => String(member.id) === String(idMiembros));
  }

  const adminEmail = String(admin.correo || admin.email || '').toLowerCase();

  if (!adminEmail) return null;

  return members.find((member) => String(member.email || '').toLowerCase() === adminEmail);
};

const mapAdminRow = ({ admin, member, photo }) => {
  const name =
    getMemberFullName(member || {}) ||
    [admin.nombres, admin.apellidos].filter(Boolean).join(' ').trim() ||
    admin.displayName ||
    admin.correo ||
    'Administrador';

  return {
    ...member,
    ...admin,
    adminId: admin.id,
    id: admin.idMiembros || member?.id || admin.id,
    idMiembros: admin.idMiembros || member?.id || '',
    memberId: member?.id || admin.idMiembros || '',
    memberCode: member?.memberId || admin.codigoMiembro || admin.codigoUsuario || '',
    name,
    email: member?.email || admin.correo || admin.email || '',
    avatarUrl: photo?.urlFoto || member?.avatarUrl || admin.photoURL || '',
  };
};

export function AdminListView() {
  const table = useTable();
  const [admins, setAdmins] = useState([]);
  const [displayMode, setDisplayMode] = useState('panel');
  const filters = useSetState({ name: '' });
  const { state: currentFilters } = filters;

  useEffect(() => {
    const loadData = async () => {
      const [adminDocs, members, memberPhotos] = await Promise.all([
        obtenerAdministradores(),
        getMembers(),
        obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' }),
      ]);

      setAdmins(
        adminDocs.map((admin) => {
          const member = resolveAdminMember(admin, members);
          const photo = memberPhotos[String(admin.idMiembros || member?.id)];

          return mapAdminRow({ admin, member, photo });
        })
      );
    };

    loadData();
  }, []);

  const dataFiltered = applyFilter({ inputData: admins, filters: currentFilters });
  const notFound = !dataFiltered.length;

  return (
    <Card>
      <AdminTableToolbar
        filters={filters}
        onResetPage={table.onResetPage}
        displayMode={displayMode}
        setDisplayMode={setDisplayMode}
      />

      {displayMode === 'panel' ? (
        <Scrollbar>
          <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 760 }}>
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
              {dataFiltered.map((row) => (
                <AdminTableRow
                  key={row.adminId || row.id}
                  row={row}
                  selected={table.selected.includes(row.id)}
                  onSelectRow={() => table.onSelectRow(row.id)}
                />
              ))}

              <TableNoData notFound={notFound} />
            </TableBody>
          </Table>
        </Scrollbar>
      ) : (
        <AdminCardList admins={dataFiltered} />
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, filters }) {
  const { name } = filters;

  if (!name) return inputData;

  return inputData.filter((admin) =>
    normalizeText(`${admin.name || ''} ${admin.email || ''} ${admin.memberCode || ''}`).includes(
      normalizeText(name)
    )
  );
}
