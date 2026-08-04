import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const getRegionalId = (regional) => regional?.id ?? regional?.idRegion ?? regional?.regionalId;

const getRegionalAvatar = (regional) =>
  regional?.avatarUrl ?? regional?.photoURL ?? regional?.urlFoto ?? '';

const getRegionalName = (regional) =>
  regional?.regionalName || regional?.name || regional?.nombre || 'Regi\u00f3n desconocida';

const getDirectorId = (regional) =>
  regional?.directorId ?? regional?.memberId ?? regional?.idMiembro;

const getDirectorName = (regional) =>
  regional?.memberFullName ||
  [regional?.memberFirstName, regional?.memberLastName].filter(Boolean).join(' ').trim() ||
  'Director desconocido';

// ----------------------------------------------------------------------

export function RegionalCard({ regional, disabledCounts = false, sx, ...other }) {
  const countsDisabled = regional?.disabledCounts ?? disabledCounts;
  const regionalId = getRegionalId(regional);
  const directorId = getDirectorId(regional);
  // Siempre permite navegar al detalle (solo lectura si no puede gestionar).
  const editHref = regionalId ? `/dashboard/level/regional/${regionalId}/edit` : '';
  const regionalName = getRegionalName(regional);
  const directorName = getDirectorName(regional);
  const directorLine =
    directorName === 'Director desconocido' ? directorName : `Director ${directorName}`;
  const sectionalCount = regional?.regionalXSectionalCount;
  const destCount = regional?.regionalXSectionalXDestCount;

  return (
    <CompactEntityCard
      title={regionalName}
      href={editHref}
      avatarUrl={getRegionalAvatar(regional)}
      fallbackText={regionalName}
      lines={[
        {
          icon: 'solar:user-bold',
          text: directorLine,
          href: directorId ? `/dashboard/level/member/${directorId}/edit` : '',
        },
        ...(sectionalCount !== undefined
          ? [
              {
                icon: 'mingcute:location-fill',
                text: `${sectionalCount} secci\u00f3n${Number(sectionalCount) === 1 ? '' : 'es'}`,
                href: countsDisabled
                  ? ''
                  : `/dashboard/level/sectional?region=${encodeURIComponent(regionalName)}`,
              },
            ]
          : []),
        ...(destCount !== undefined
          ? [
              {
                icon: 'solar:home-2-bold',
                text: `${destCount} destacamento${Number(destCount) === 1 ? '' : 's'}`,
                href: countsDisabled || !regionalId ? '' : `/dashboard/level/dest?region=${regionalId}`,
              },
            ]
          : []),
      ]}
      sx={sx}
      {...other}
    />
  );
}
