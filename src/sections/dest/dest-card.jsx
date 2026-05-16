import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const getDestId = (dest) => dest?.id ?? dest?.idDestacamento ?? dest?.destId;

const getDestAvatar = (dest) => dest?.avatarUrl ?? dest?.photoURL ?? dest?.urlFoto ?? '';

const getDestName = (dest) => {
  const name = dest?.nombre || dest?.name || dest?.destName || 'Desconocido';
  const number = dest?.numero || dest?.destNumber || dest?.number || '';
  const label = [name, number].filter(Boolean).join(' ').trim();

  return label.toLowerCase().startsWith('dest') ? label : `Destacamento ${label}`;
};

const getCoordinatorName = (dest) =>
  dest?.memberFullName ||
  [dest?.memberFirstName, dest?.memberLastName].filter(Boolean).join(' ').trim() ||
  'Desconocido';

const getSectionalName = (dest) => dest?.sectionalName || dest?.sectionName || 'Desconocida';

// ----------------------------------------------------------------------

export function DestCard({ dest, sx, ...other }) {
  const destId = getDestId(dest);
  const editHref = destId ? `/dashboard/level/dest/${destId}/edit` : '#';
  const coordinatorName = getCoordinatorName(dest);
  const sectionalName = getSectionalName(dest);

  return (
    <CompactEntityCard
      title={getDestName(dest)}
      href={editHref}
      avatarUrl={getDestAvatar(dest)}
      fallbackText={getDestName(dest)}
      lines={[
        { icon: 'solar:user-bold', text: `Coord. ${coordinatorName}` },
        { icon: 'mingcute:location-fill', text: `Sección ${sectionalName}` },
      ]}
      sx={sx}
      {...other}
    />
  );
}
