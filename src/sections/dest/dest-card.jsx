import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const UNKNOWN_COORDINATOR = 'Coordinador desconocido';
const UNKNOWN_SECTIONAL = 'Secci\u00f3n desconocida';

const getDestId = (dest) => dest?.id ?? dest?.idDestacamento ?? dest?.destId;

const getDestAvatar = (dest) => dest?.avatarUrl ?? dest?.photoURL ?? dest?.urlFoto ?? '';

const getCoordinatorId = (dest) => dest?.coordinatorId ?? dest?.memberId ?? dest?.idMiembro;

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

const getRegionalName = (dest) => {
  const regionalName = String(
    dest?.regionalName || dest?.regionName || dest?.nombreRegion || ''
  ).trim();

  return regionalName === '-' ? '' : regionalName;
};

// ----------------------------------------------------------------------

export function DestCard({ dest, sx, ...other }) {
  const destId = getDestId(dest);
  const coordinatorId = getCoordinatorId(dest);
  const editHref = destId ? `/dashboard/level/dest/${destId}/edit` : '#';
  const coordinatorName = getCoordinatorName(dest);
  const sectionalName = getSectionalName(dest);
  const regionalName = getRegionalName(dest);
  const coordinatorLine =
    coordinatorName === UNKNOWN_COORDINATOR ? coordinatorName : `Coord. ${coordinatorName}`;
  const sectionalLine =
    sectionalName === UNKNOWN_SECTIONAL ? sectionalName : `Secci\u00f3n ${sectionalName}`;
  const regionalLine = regionalName ? `Regi\u00f3n ${regionalName}` : '';

  return (
    <CompactEntityCard
      title={getDestName(dest)}
      href={editHref}
      avatarUrl={getDestAvatar(dest)}
      fallbackText={getDestName(dest)}
      lines={[
        {
          icon: 'solar:user-bold',
          text: coordinatorLine,
          href: coordinatorId ? `/dashboard/level/member/${coordinatorId}/edit` : '',
        },
        {
          icon: 'mingcute:location-fill',
          text: sectionalLine,
          href:
            sectionalName !== UNKNOWN_SECTIONAL
              ? `/dashboard/level/sectional?sectional=${encodeURIComponent(sectionalName)}`
              : '',
        },
        ...(regionalLine
          ? [
              {
                icon: 'solar:map-point-bold',
                text: regionalLine,
                href: dest?.regionalId
                  ? `/dashboard/level/regional?region=${dest.regionalId}`
                  : `/dashboard/level/regional?sectional=${encodeURIComponent(regionalName)}`,
              },
            ]
          : []),
      ]}
      sx={sx}
      {...other}
    />
  );
}
