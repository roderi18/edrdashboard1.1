import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const getSectionalId = (sectional) => sectional?.id ?? sectional?.idSeccion ?? sectional?.sectionalId;

const getSectionalAvatar = (sectional) =>
  sectional?.avatarUrl ?? sectional?.photoURL ?? sectional?.urlFoto ?? '';

const getSectionalName = (sectional) =>
  sectional?.sectionalName || sectional?.nombre || sectional?.name || 'Sección desconocida';

const getDirectorName = (sectional) =>
  sectional?.memberFullName ||
  [sectional?.memberFirstName, sectional?.memberLastName].filter(Boolean).join(' ').trim() ||
  'Desconocido';

const getRegionalName = (sectional) =>
  sectional?.regionalName || sectional?.regionName || sectional?.nombreRegion || 'Desconocida';

// ----------------------------------------------------------------------

export function SectionalCard({ sectional, sx, ...other }) {
  const sectionalId = getSectionalId(sectional);
  const editHref = sectionalId ? `/dashboard/level/sectional/${sectionalId}/edit` : '#';
  const sectionalName = getSectionalName(sectional);
  const directorName = getDirectorName(sectional);
  const regionalName = getRegionalName(sectional);

  return (
    <CompactEntityCard
      title={sectionalName}
      href={editHref}
      avatarUrl={getSectionalAvatar(sectional)}
      fallbackText={sectionalName}
      lines={[
        { icon: 'solar:user-bold', text: `Director ${directorName}` },
        { icon: 'mingcute:location-fill', text: `Región ${regionalName}` },
      ]}
      sx={sx}
      {...other}
    />
  );
}
