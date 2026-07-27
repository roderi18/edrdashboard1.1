import { memo } from 'react';

import { getPhoneHref, formatPhoneNumber } from 'src/utils/format-phone-number';

import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const getMemberEditId = (member) =>
  member?.memberId ?? member?.codigoMiembro ?? member?.idMiembros ?? member?.id;

const getMemberDestId = (member) =>
  member?.destId ?? member?.idDestacamento ?? member?.destacamentoId ?? member?.idDest;

const getMemberPhone = (member) =>
  member?.phoneNumber ?? member?.telefono ?? member?.phone ?? member?.celular ?? '';

const getMemberAvatar = (member) => member?.avatarUrl ?? member?.photoURL ?? member?.urlFoto ?? '';

const DIVISION_ICONS = {
  exploradores: {
    alt: 'Exploradores',
    src: '/assets/images/divisions/member/exploradores-ico.png',
  },
  liderazgo: {
    alt: 'Liderazgo',
    src: '/assets/images/divisions/member/liderazgo-ico.png',
  },
  navegantes: {
    alt: 'Navegantes',
    src: '/assets/images/divisions/member/navegantes-ico.png',
  },
  pioneros: {
    alt: 'Pioneros',
    src: '/assets/images/divisions/member/pioneros-ico.png',
  },
  seguidores: {
    alt: 'Seguidores',
    src: '/assets/images/divisions/member/seguidores-ico.png',
  },
};

const getMemberDivisionIcon = (member) => {
  const division = String(member?.memberDivision ?? member?.division ?? member?.divisionName ?? '')
    .trim()
    .toLowerCase();

  return DIVISION_ICONS[division] || null;
};

const getDestValue = (dest, keys) => keys.map((key) => dest?.[key]).find(Boolean);

const normalizeDests = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.Data)) return value.Data;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;

  return [];
};

const buildDestLabel = (member, dests) => {
  const destList = normalizeDests(dests);
  const memberDestId = getMemberDestId(member);
  const hasMemberDestId =
    memberDestId !== null && memberDestId !== undefined && memberDestId !== '';
  const dest = hasMemberDestId
    ? destList.find((item) =>
        [item?.id, item?.idDestacamento, item?.destId].some(
          (value) => String(value) === String(memberDestId)
        )
      )
    : null;

  const name =
    getDestValue(dest, ['nombre', 'name', 'destName']) ||
    member?.destName ||
    member?.destacamentoName ||
    '';
  const number = getDestValue(dest, ['numero', 'destNumber', 'number']);
  const label = [name, number].filter(Boolean).join(' ').trim();

  if (label) {
    return label.toLowerCase().startsWith('dest') ? label : `Dest. ${label}`;
  }

  return memberDestId ? `Dest. ${memberDestId}` : 'Dest. desconocido';
};

const getDestHref = (member, dests) => {
  const destLabel = buildDestLabel(member, dests)
    .replace(/^Dest\.\s*/i, '')
    .trim();

  return destLabel && destLabel.toLowerCase() !== 'desconocido'
    ? `/dashboard/level/dest?name=${encodeURIComponent(destLabel)}`
    : '';
};

// ----------------------------------------------------------------------

export const MemberCard = memo(function MemberCard({
  member,
  sx,
  avatarUrl,
  dests: destsProp = [],
  ...other
}) {
  const memberEditId = getMemberEditId(member);
  const editHref = memberEditId ? `/dashboard/level/member/${memberEditId}/edit` : '#';
  const phoneNumber = getMemberPhone(member);
  const phoneLabel = formatPhoneNumber(phoneNumber);
  const destLabel = buildDestLabel(member, destsProp);
  const destHref = getDestHref(member, destsProp);
  const divisionIcon = getMemberDivisionIcon(member);
  const resolvedAvatarUrl = avatarUrl || getMemberAvatar(member);

  return (
    <CompactEntityCard
      title={member?.name}
      href={memberEditId ? editHref : '#'}
      avatarUrl={resolvedAvatarUrl}
      fallbackText={member?.name || member?.firstName}
      lines={[
        { icon: 'solar:phone-bold', text: phoneLabel, href: getPhoneHref(phoneNumber) },
        { icon: 'mingcute:location-fill', text: destLabel, href: destHref },
      ]}
      rightImage={divisionIcon}
      sx={sx}
      {...other}
    />
  );
});
