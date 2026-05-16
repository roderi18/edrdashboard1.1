import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const getRegionalId = (regional) => regional?.id ?? regional?.idRegion ?? regional?.regionalId;

const getRegionalAvatar = (regional) =>
  regional?.avatarUrl ?? regional?.photoURL ?? regional?.urlFoto ?? '';

const getRegionalName = (regional) =>
  regional?.regionalName || regional?.name || regional?.nombre || 'Región desconocida';

const getDirectorName = (regional) =>
  regional?.memberFullName ||
  [regional?.memberFirstName, regional?.memberLastName].filter(Boolean).join(' ').trim() ||
  'Desconocido';

// ----------------------------------------------------------------------

export function RegionalCard({ regional, sx, ...other }) {
  const regionalId = getRegionalId(regional);
  const editHref = regionalId ? `/dashboard/level/regional/${regionalId}/edit` : '#';
  const regionalName = getRegionalName(regional);
  const directorName = getDirectorName(regional);

  return (
    <CompactEntityCard
      title={regionalName}
      href={editHref}
      avatarUrl={getRegionalAvatar(regional)}
      fallbackText={regionalName}
      lines={[{ icon: 'solar:user-bold', text: `Director ${directorName}` }]}
      sx={sx}
      {...other}
    />
  );
}
