import { useState, useEffect } from 'react';
import { parsePhoneNumber } from 'libphonenumber-js';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import ListItemText from '@mui/material/ListItemText';

import { Iconify } from 'src/components/iconify';

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

const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '-';

  try {
    return parsePhoneNumber(phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber}`)
      ?.formatNational();
  } catch {
    return phoneNumber;
  }
};

const getDestValue = (dest, keys) => keys.map((key) => dest?.[key]).find(Boolean);

const buildDestLabel = (member, dests) => {
  const memberDestId = getMemberDestId(member);
  const hasMemberDestId = memberDestId !== null && memberDestId !== undefined && memberDestId !== '';
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

export function MemberCard({ member, sx, canManage = true, dests: destsProp = [], ...other }) {
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
  const phoneLabel = formatPhoneNumber(phoneNumber);
  const destLabel = buildDestLabel(member, dests);
  const divisionIcon = getMemberDivisionIcon(member);

  return (
    <Card
      sx={[
        (theme) => ({
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          minHeight: 88,
          p: theme.spacing(3, divisionIcon ? 8 : 2, 3, 3),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Link href={canManage && memberEditId ? editHref : '#'} color="inherit" underline="none">
        <Avatar
          alt={member?.name}
          src={getMemberAvatar(member)}
          sx={{ width: 48, height: 48, mr: 2 }}
        />
      </Link>

      <ListItemText
        primary={
          <Link
            href={canManage && memberEditId ? editHref : '#'}
            color="inherit"
            underline="hover"
          >
            {member?.name}
          </Link>
        }
        secondary={
          <Box component="span" sx={{ display: 'grid', gap: 0.35, minWidth: 0 }}>
            <Box
              component="span"
              sx={{
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
                typography: 'caption',
                color: 'text.disabled',
              }}
            >
              <Iconify icon="solar:phone-bold" width={16} sx={{ flexShrink: 0, mr: 0.5 }} />
              <Box
                component="span"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {phoneLabel}
              </Box>
            </Box>

            <Box
              component="span"
              sx={{
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
                typography: 'caption',
                color: 'text.disabled',
              }}
            >
              <Iconify icon="mingcute:location-fill" width={16} sx={{ flexShrink: 0, mr: 0.5 }} />
              <Box
                component="span"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {destLabel}
              </Box>
            </Box>
          </Box>
        }
        slotProps={{
          primary: { noWrap: true },
          secondary: { component: 'span', sx: { mt: 0.5, display: 'block' } },
        }}
      />

      {divisionIcon && (
        <Box
          component="img"
          alt={divisionIcon.alt}
          src={divisionIcon.src}
          sx={{
            right: 18,
            bottom: 16,
            width: 42,
            height: 42,
            objectFit: 'contain',
            position: 'absolute',
            pointerEvents: 'none',
          }}
        />
      )}
    </Card>
  );
}
