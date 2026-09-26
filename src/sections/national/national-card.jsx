import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const getNationalName = (national) => national?.nationalXname || 'Desconocido';

const getNationalAvatar = (national) => national?.avatarUrl ?? national?.photoURL ?? '';

const getNationalHref = (national) =>
  national?.memberId
    ? `/dashboard/level/member/${national.memberId}/edit?origen=consejo-nacional`
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

export function NationalCard({ national, canManage = true, sx, ...other }) {
  const nationalName = getNationalName(national);
  const nationalHref = getNationalHref(national);
  const structureHref = getStructureHref(national);
  const positionLabel =
    national?.nationalXMemberPositionTitulo ||
    national?.nationalXMemberPositionLabel ||
    national?.nationalXMemberPosition ||
    'Desconocido';
  const positionHref = national?.nationalXMemberPositionHref || '';
  const organizationalLevel = national?.nationalOrganizationalLevel || 'Desconocido';
  const structure =
    national?.nationalEstructureLabel || national?.nationalEstructure || 'Desconocida';
  const seenLineTexts = new Set([
    String(nationalName).trim().replace(/\s+/g, ' ').toLocaleLowerCase(),
  ]);
  const lines = [
    { text: positionLabel, href: positionHref },
    // Desde – hasta, solo en una posición de una directiva pasada que ocuparon
    // varias personas.
    { text: national?.nationalXMemberPositionPeriodo || '', icon: 'solar:calendar-date-bold' },
    { text: organizationalLevel },
    { text: structure, href: structureHref },
  ].filter((line) => {
    const key = String(line.text || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase();

    if (!key || seenLineTexts.has(key)) return false;

    seenLineTexts.add(key);
    return true;
  });

  return (
    <CompactEntityCard
      title={nationalName}
      href={nationalHref}
      avatarUrl={getNationalAvatar(national)}
      avatarSize={80}
      avatarBorderRadius={2.5}
      fallbackText={nationalName}
      lines={lines}
      sx={sx}
      {...other}
    />
  );
}
