import { memo, useState, useEffect } from 'react';

import { formatPhoneNumber } from 'src/utils/format-phone-number';

import { CompactEntityCard } from 'src/sections/common/compact-entity-card';

// ----------------------------------------------------------------------

const getMemberEditId = (member) => member?.idMiembros ?? member?.id ?? member?.memberId;

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

const buildDestLabel = (member, dests) => {
  const memberDestId = getMemberDestId(member);
  const hasMemberDestId =
    memberDestId !== null && memberDestId !== undefined && memberDestId !== '';
  const dest = hasMemberDestId
    ? dests.find((item) =>
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

  return memberDestId ? `Dest. ${memberDestId}` : 'Dest. Desconocido';
};

// ----------------------------------------------------------------------

export const MemberCard = memo(function MemberCard({
  member,
  sx,
  avatarUrl,
  canManage = true,
  dests: destsProp = [],
  ...other
}) {
  const [dests, setDests] = useState([]);

  useEffect(() => {
    if (destsProp.length) {
      setDests(destsProp);
      return undefined;
    }

    const load = async () => {
      try {
        const res = await fetch('/api/dest');
        const data = await res.json();
        setDests(data?.Data || data || []);
      } catch (error) {
        console.error('Error loading dests for member card:', error);
        setDests([]);
      }
    };
    load();
    return undefined;
  }, [destsProp]);

  const memberEditId = getMemberEditId(member);
  const editHref = memberEditId ? `/dashboard/level/member/${memberEditId}/edit` : '#';
  const phoneNumber = getMemberPhone(member);
  const phoneLabel = formatPhoneNumber(phoneNumber, '-');
  const destLabel = buildDestLabel(member, dests);
  const divisionIcon = getMemberDivisionIcon(member);
  const resolvedAvatarUrl = avatarUrl || getMemberAvatar(member);

  return (
    <CompactEntityCard
      title={member?.name}
      href={canManage && memberEditId ? editHref : '#'}
      avatarUrl={resolvedAvatarUrl}
      fallbackText={member?.name || member?.firstName}
      lines={[
        { icon: 'solar:phone-bold', text: phoneLabel },
        { icon: 'mingcute:location-fill', text: destLabel },
      ]}
      rightImage={divisionIcon}
      sx={sx}
      {...other}
    />
  );
});
