'use client';

import { useSetState } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableBody from '@mui/material/TableBody';

import { normalizeText } from 'src/utils/normalize-text';
import { getMemberFullName } from 'src/utils/get-member-fullname';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { obtenerAdministradores, quitarAdministradorAMiembro } from 'src/utils/firebase-admins';

import { getMembers } from 'src/services/member-service';
import { getDests, getDestsApi } from 'src/services/dest-service';

import { toast } from 'src/components/snackbar';
import { Scrollbar } from 'src/components/scrollbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { useTable, TableNoData, TableHeadCustom } from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

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
  const codigoMiembro = String(admin.codigoMiembro || admin.codigoUsuario || admin.memberCode || '')
    .trim()
    .toLowerCase();

  if (idMiembros) {
    const byId = members.find((member) => String(member.id) === String(idMiembros));

    if (byId) return byId;
  }

  if (codigoMiembro) {
    const byCode = members.find((member) =>
      [member.memberId, member.codigoMiembro]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
        .includes(codigoMiembro)
    );

    if (byCode) return byCode;
  }

  const adminEmail = String(admin.correo || admin.email || '').toLowerCase();

  if (!adminEmail) return null;

  return members.find((member) => String(member.email || '').toLowerCase() === adminEmail);
};

const mapAdminRow = ({ admin, member, photo }) => {
  const name =
    getMemberFullName(member || {}) ||
    admin.name ||
    admin.nombre ||
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
    idDestacamento: admin.idDestacamento || member?.idDestacamento || member?.destId || '',
  };
};

export function AdminListView() {
  const { user } = useAuthContext();
  const table = useTable();
  const [admins, setAdmins] = useState([]);
  const [removeAdminRow, setRemoveAdminRow] = useState(null);
  const [isRemovingAdmin, setIsRemovingAdmin] = useState(false);
  const [displayMode, setDisplayMode] = useState('panel');
  // Destacamentos, para mostrar el NÚMERO del destacamento (no su id interno) en
  // la etiqueta del rol. Se lee una vez aquí y se pasa a filas/tarjetas.
  const [dests, setDests] = useState(() => getDests());

  useEffect(() => {
    if (dests.length) return undefined;

    let cancelled = false;

    getDestsApi({ includePhotos: false })
      .then((data) => {
        if (!cancelled) setDests(Array.isArray(data) ? data : []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [dests.length]);

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

      setAdmins((currentAdmins) =>
        currentAdmins.filter((admin) => String(admin.adminId || admin.id) !== String(removeAdminRow.adminId || removeAdminRow.id))
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

  const handlePermissionsSaved = useCallback((adminRow, permissions) => {
    setAdmins((currentAdmins) =>
      currentAdmins.map((admin) =>
        String(admin.adminId || admin.id) === String(adminRow?.adminId || adminRow?.id)
          ? { ...admin, permisos: permissions, permissions }
          : admin
      )
    );
  }, []);

  const handleRoleSaved = useCallback((adminRow, assignment) => {
    setAdmins((currentAdmins) =>
      currentAdmins.map((admin) =>
        String(admin.adminId || admin.id) === String(adminRow?.adminId || adminRow?.id)
          ? {
              ...admin,
              rol: assignment.rolNombre || assignment.rolId,
              role: assignment.rolId,
              rolId: assignment.rolId,
              rolNombre: assignment.rolNombre,
              alcance: assignment.alcance,
              permisosRol: assignment.permisos,
            }
          : admin
      )
    );
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
                  dests={dests}
                  selected={table.selected.includes(row.id)}
                  onSelectRow={() => table.onSelectRow(row.id)}
                  onRemoveAdmin={setRemoveAdminRow}
                  onPermissionsSaved={handlePermissionsSaved}
                  onRoleSaved={handleRoleSaved}
                />
              ))}

              <TableNoData notFound={notFound} />
            </TableBody>
          </Table>
        </Scrollbar>
      ) : (
        <AdminCardList admins={dataFiltered} dests={dests} />
      )}

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
