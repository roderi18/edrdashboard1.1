import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const getNationalName = (national) => national?.nationalXname || 'Desconocido';

const getNationalAvatar = (national) => national?.avatarUrl ?? national?.photoURL ?? '';

const getNationalHref = (national) =>
  national?.memberId ? `/dashboard/level/member/${national.memberId}/edit` : '#';

// ----------------------------------------------------------------------

export function NationalCard({ national, sx, ...other }) {
  const nationalName = getNationalName(national);
  const position =
    national?.nationalXMemberPositionLabel || national?.nationalXMemberPosition || 'Desconocido';
  const structure =
    national?.nationalEstructureLabel || national?.nationalEstructure || 'Desconocida';

  return (
    <CompactEntityCard
      title={nationalName}
      href={getNationalHref(national)}
      avatarUrl={getNationalAvatar(national)}
      fallbackText={nationalName}
      lines={[
        { icon: 'solar:user-bold', text: position },
        { icon: 'mingcute:location-fill', text: structure },
      ]}
      sx={sx}
      {...other}
    />
  );
}
