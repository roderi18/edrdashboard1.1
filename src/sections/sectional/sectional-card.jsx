import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const UNKNOWN_REGIONAL = 'Regi\u00f3n desconocida';

const getSectionalId = (sectional) =>
  sectional?.id ?? sectional?.idSeccion ?? sectional?.sectionalId;

const getSectionalAvatar = (sectional) =>
  sectional?.avatarUrl ?? sectional?.photoURL ?? sectional?.urlFoto ?? '';

const getSectionalName = (sectional) =>
  sectional?.sectionalName || sectional?.nombre || sectional?.name || 'Secci\u00f3n desconocida';

const getDirectorId = (sectional) =>
  sectional?.directorId ?? sectional?.memberId ?? sectional?.idMiembro;

const getDirectorName = (sectional) =>
  sectional?.memberFullName ||
  [sectional?.memberFirstName, sectional?.memberLastName].filter(Boolean).join(' ').trim() ||
  'Desconocido';

const getRegionalName = (sectional) => {
  const regionalName = String(
    sectional?.regionalName || sectional?.regionName || sectional?.nombreRegion || ''
  ).trim();

  return regionalName && regionalName !== '-' ? regionalName : UNKNOWN_REGIONAL;
};

// ----------------------------------------------------------------------

export function SectionalCard({ sectional, sx, ...other }) {
  const sectionalId = getSectionalId(sectional);
  const directorId = getDirectorId(sectional);
  // Siempre permite navegar al detalle (solo lectura si no puede gestionar).
  const editHref = sectionalId ? `/dashboard/level/sectional/${sectionalId}/edit` : '';
  const sectionalName = getSectionalName(sectional);
  const directorName = getDirectorName(sectional);
  const regionalName = getRegionalName(sectional);
  const regionalLine =
    regionalName === UNKNOWN_REGIONAL ? regionalName : `Regi\u00f3n ${regionalName}`;
  const destCount = sectional?.sectionalDestCount;

  return (
    <CompactEntityCard
      title={sectionalName}
      href={editHref}
      avatarUrl={getSectionalAvatar(sectional)}
      fallbackText={sectionalName}
      lines={[
        {
          icon: 'solar:user-bold',
          text: `Director ${directorName}`,
          href: directorId ? `/dashboard/level/member/${directorId}/edit` : '',
        },
        {
          icon: 'mingcute:location-fill',
          text: regionalLine,
          href:
            regionalName !== UNKNOWN_REGIONAL
              ? `/dashboard/level/regional?sectional=${encodeURIComponent(regionalName)}`
              : '',
        },
        ...(destCount !== undefined
          ? [
              {
                icon: 'solar:home-2-bold',
                text: `${destCount} destacamento${Number(destCount) === 1 ? '' : 's'}`,
                href: sectionalId ? `/dashboard/level/dest?sectional=${sectionalId}` : '',
              },
            ]
          : []),
      ]}
      sx={sx}
      {...other}
    />
  );
}
