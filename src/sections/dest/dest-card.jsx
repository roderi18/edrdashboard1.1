import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const UNKNOWN_COORDINATOR = 'Coordinador desconocido';
const UNKNOWN_SECTIONAL = 'Secci\u00f3n desconocida';

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
  UNKNOWN_COORDINATOR;

const getSectionalName = (dest) =>
  String(dest?.sectionalName || dest?.sectionName || '').trim() || UNKNOWN_SECTIONAL;

// ----------------------------------------------------------------------

export function DestCard({ dest, sx, ...other }) {
  const destId = getDestId(dest);
  const editHref = destId ? `/dashboard/level/dest/${destId}/edit` : '#';
  const coordinatorName = getCoordinatorName(dest);
  const sectionalName = getSectionalName(dest);
  const coordinatorLine =
    coordinatorName === UNKNOWN_COORDINATOR ? coordinatorName : `Coord. ${coordinatorName}`;
  const sectionalLine =
    sectionalName === UNKNOWN_SECTIONAL ? sectionalName : `Secci\u00f3n ${sectionalName}`;

  return (
    <CompactEntityCard
      title={getDestName(dest)}
      href={editHref}
      avatarUrl={getDestAvatar(dest)}
      fallbackText={getDestName(dest)}
      lines={[
        { icon: 'solar:user-bold', text: coordinatorLine },
        { icon: 'mingcute:location-fill', text: sectionalLine },
      ]}
      sx={sx}
      {...other}
    />
  );
}
