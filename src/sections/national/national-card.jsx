import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

import { isLocalhostNationalTestId } from './national-localhost-test-user';

// ----------------------------------------------------------------------

const getNationalName = (national) => national?.nationalXname || 'Desconocido';

const getNationalAvatar = (national) => national?.avatarUrl ?? national?.photoURL ?? '';

const getNationalHref = (national) =>
  isLocalhostNationalTestId(national?.id)
    ? `/dashboard/level/national/${national.id}/edit`
    : national?.memberId
      ? `/dashboard/level/member/${national.memberId}/edit`
      : '#';

const getStructureHref = (national) => {
  if (national?.level === 'regional' && national?.entityId) {
    return `/dashboard/level/regional?region=${national.entityId}`;
  }

  if (national?.level === 'sectional' && national?.entityId) {
    return `/dashboard/level/sectional/${national.entityId}/edit`;
  }

  if (
    national?.nationalEstructure === 'directivas_regionales' &&
    national?.nationalXAssignedRegional &&
    national.nationalXAssignedRegional !== '-'
  ) {
    return `/dashboard/level/regional?sectional=${encodeURIComponent(
      national.nationalXAssignedRegional
    )}`;
  }

  return '';
};

// ----------------------------------------------------------------------

export function NationalCard({ national, sx, ...other }) {
  const nationalName = getNationalName(national);
  const nationalHref = getNationalHref(national);
  const structureHref = getStructureHref(national);
  const position =
    national?.nationalXMemberPositionLabel || national?.nationalXMemberPosition || 'Desconocido';
  const structure =
    national?.nationalEstructureLabel || national?.nationalEstructure || 'Desconocida';

  return (
    <CompactEntityCard
      title={nationalName}
      href={nationalHref}
      avatarUrl={getNationalAvatar(national)}
      fallbackText={nationalName}
      lines={[
        { icon: 'solar:user-bold', text: position },
        { icon: 'mingcute:location-fill', text: structure, href: structureHref },
      ]}
      sx={sx}
      {...other}
    />
  );
}
