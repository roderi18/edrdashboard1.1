import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const getAdminEditId = (admin) => admin?.idMiembros || admin?.memberId || admin?.id;

const getAdminAvatar = (admin) => admin?.avatarUrl || admin?.photoURL || admin?.urlFoto || '';

const getDestId = (admin) =>
  admin?.destId || admin?.idDestacamento || admin?.destacamentoId || admin?.idDest;

const getDestLabel = (admin) => {
  const destName =
    admin?.destName ||
    admin?.destacamentoName ||
    admin?.nombreDestacamento ||
    admin?.destacamento ||
    '';
  const destNumber = admin?.destNumber || admin?.destacamentoNumero || admin?.numeroDestacamento || '';
  const label = [destName, destNumber].filter(Boolean).join(' ').trim();

  if (label) {
    return label.toLowerCase().startsWith('dest') ? label : `Dest. ${label}`;
  }

  return getDestId(admin) ? `Dest. ${getDestId(admin)}` : 'Dest. desconocido';
};

const getDestHref = (admin) => {
  const destId = getDestId(admin);

  if (destId) {
    return `/dashboard/level/dest?dest=${encodeURIComponent(destId)}`;
  }

  const destLabel = getDestLabel(admin).replace(/^Dest\.\s*/i, '').trim();

  return destLabel && destLabel.toLowerCase() !== 'desconocido'
    ? `/dashboard/level/dest?name=${encodeURIComponent(destLabel)}`
    : '';
};

const getSectionalLabel = (admin) => {
  const sectionalName =
    admin?.sectionalName || admin?.sectionName || admin?.seccion || admin?.nombreSeccion || '';

  return sectionalName && sectionalName !== '-' ? `Sección ${sectionalName}` : 'Sección desconocida';
};

const getSectionalHref = (admin) => {
  const sectionalLabel = getSectionalLabel(admin).replace(/^Sección\s*/i, '').trim();

  return sectionalLabel && sectionalLabel.toLowerCase() !== 'desconocida'
    ? `/dashboard/level/sectional?sectional=${encodeURIComponent(sectionalLabel)}`
    : '';
};

// ----------------------------------------------------------------------

export function AdminCard({ admin, sx, ...other }) {
  const adminEditId = getAdminEditId(admin);
  const editHref = adminEditId ? `/dashboard/level/member/${adminEditId}/edit` : '#';
  const adminName = admin?.name || admin?.displayName || admin?.email || 'Administrador';

  return (
    <CompactEntityCard
      title={adminName}
      href={editHref}
      avatarUrl={getAdminAvatar(admin)}
      fallbackText={adminName}
      lines={[
        { icon: 'solar:shield-user-bold', text: admin?.rol || admin?.role || 'Administrador' },
        { icon: 'mingcute:location-fill', text: getDestLabel(admin), href: getDestHref(admin) },
        { icon: 'solar:map-point-bold', text: getSectionalLabel(admin), href: getSectionalHref(admin) },
      ]}
      sx={sx}
      {...other}
    />
  );
}
