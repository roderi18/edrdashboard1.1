import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const UNKNOWN_REGIONAL = 'Región desconocida';

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
  String(sectional?.regionalName || sectional?.regionName || sectional?.nombreRegion || '').trim() ||
  UNKNOWN_REGIONAL;

// ----------------------------------------------------------------------

export function SectionalCard({ sectional, sx, ...other }) {
  const sectionalId = getSectionalId(sectional);
  const editHref = sectionalId ? `/dashboard/level/sectional/${sectionalId}/edit` : '#';
  const sectionalName = getSectionalName(sectional);
  const directorName = getDirectorName(sectional);
  const regionalName = getRegionalName(sectional);
  const regionalLine = regionalName === UNKNOWN_REGIONAL ? regionalName : `Región ${regionalName}`;

  return (
    <CompactEntityCard
      title={sectionalName}
      href={editHref}
      avatarUrl={getSectionalAvatar(sectional)}
      fallbackText={sectionalName}
      lines={[
        { icon: 'solar:user-bold', text: `Director ${directorName}` },
        { icon: 'mingcute:location-fill', text: regionalLine },
      ]}
      sx={sx}
      {...other}
    />
  );
}
