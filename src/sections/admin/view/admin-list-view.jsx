'use client';

import { useState, useEffect } from 'react';
import { useSetState } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableBody from '@mui/material/TableBody';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { normalizeText } from 'src/utils/normalize-text';
import { getMemberFullName } from 'src/utils/get-member-fullname';
import { obtenerAdministradores } from 'src/utils/firebase-admins';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';

import { getMembers } from 'src/services/member-service';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { useTable, TableNoData, TableHeadCustom } from 'src/components/table';

import { LogsFileManagerView } from 'src/sections/logs/view';

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
  const [activeTab, setActiveTab] = useState('administradores');
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

  const renderAdministradoresTab = () => (
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

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Administradores"
        links={[{ name: 'Panel', href: paths.dashboard.root }, { name: 'Administradores' }]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.admin.new}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            Crear administrador
          </Button>
        }
        sx={{ mb: { xs: 1.5, md: 2 } }}
      />

      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          sx={{
            minHeight: 44,
            px: 0,
            '& .MuiTab-root': {
              minHeight: 44,
              minWidth: 0,
              px: 0,
              mr: 4,
              alignItems: 'center',
              gap: 1,
            },
          }}
        >
          <Tab
            value="administradores"
            icon={<Iconify icon="solar:users-group-rounded-bold" />}
            iconPosition="start"
            label="Administradores"
          />
          <Tab
            value="logs"
            icon={<Iconify icon="solar:document-text-bold" />}
            iconPosition="start"
            label="Historial - Logs"
          />
        </Tabs>
      </Box>

      {activeTab === 'administradores' ? (
        renderAdministradoresTab()
      ) : (
        <LogsFileManagerView embedded />
      )}
    </DashboardContent>
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
