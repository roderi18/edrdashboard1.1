import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { varAlpha } from 'minimal-shared/utils';
import { parsePhoneNumber } from 'libphonenumber-js';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';
import { useTheme, useMediaQuery } from '@mui/material';

import { getStorageCollection } from 'src/utils/storage-service';

import { AvatarShape } from 'src/assets/illustrations';
import { _allLeadershipRoles } from 'src/_mock/_leadership';

import { Image } from 'src/components/image';
// ----------------------------------------------------------------------

export function MemberCard({ member, sx, canManage = true, ...other }) {
  const memberDivisionCoverMap = {
    Exploradores: '/assets/images/divisions/member/exploradores3.jpg',
    Seguidores: '/assets/images/divisions/member/seguidores.jpg',
    Pioneros: '/assets/images/divisions/member/pioneros.jpg',
    Navegantes: '/assets/images/divisions/member/navegantes2.jpg',
    Liderazgo: '/assets/images/divisions/member/liderazgo.jpg',
  };

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();
  const leadershipAssignments = getStorageCollection('leadershipAssignments') || [];
  const [dests, setDests] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/dest');
        const data = await res.json();
        setDests(data?.Data || []);
      } catch (error) {
        console.error('Error loading dests for member card:', error);
        setDests([]);
      }
    };
    load();
  }, []);

  const coverSrc =
    memberDivisionCoverMap[member.memberDivision?.trim()] || '/assets/images/divisions/default.jpg';

  const dest = dests.find((d) => Number(d.idDestacamento) === Number(member.destId));
  console.log('MEMBER 👉', member);
  console.log('DESTS 👉', dests);
  console.log('MATCH DEST 👉', dest);
  const sectionalName = member?.sectionalName || '-';

  let leaderships = leadershipAssignments
    .filter(
      (l) =>
        (l.memberId === member.id || l.member_id === member.id) &&
        (l.status === 'active' || !l.status)
    )
    .map((l) => ({
      ...l,
      label: _allLeadershipRoles.find((r) => r.value === l.role)?.label,
    }))
    .filter((l) => l.label);

  // si no tiene liderazgo pero sí posición en destacamento
  if (!leaderships.length && member.memberPosition) {
    leaderships = [
      {
        label: member.memberPosition,
        level: 'dest',
      },
    ];
  }

  const handleEdit = () => {
    router.push(`/dashboard/level/member/${member.idMiembros}/edit`);
  };

  return (
    <Card sx={[{ textAlign: 'center' }, ...(Array.isArray(sx) ? sx : [sx])]} {...other}>
      <Box sx={{ position: 'relative' }}>
        {/* curva */}
        <AvatarShape
          sx={{
            left: 0,
            right: 0,
            zIndex: 10,
            mx: 'auto',
            bottom: -26,
            position: 'absolute',
          }}
        />

        <Avatar
          onClick={handleEdit}
          alt={member.name}
          src={member.avatarUrl}
          sx={{
            left: 0,
            right: 0,
            width: 64,
            height: 64,
            zIndex: 11,
            mx: 'auto',
            bottom: -32,
            position: 'absolute',
            cursor: 'pointer',
          }}
        />

        <Image
          src={coverSrc}
          alt={member.memberDivision}
          ratio="16/6"
          slotProps={{
            overlay: {
              sx: (overlayTheme) => ({
                // sombra img trasera
                bgcolor: varAlpha(overlayTheme.vars.palette.common.blackChannel, 0.46),
              }),
            },
          }}
        />
      </Box>

      {/* nombre img */}
      <ListItemText
        sx={{ mt: 6, mb: 0.5 }}
        primary={
          <Box
            onClick={handleEdit}
            sx={{
              typography: 'subtitle1',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {member.name}
          </Box>
        }
      />

      {/* inferior */}
      <Box
        sx={{
          mb: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 0.5,
        }}
      >
        <Box sx={{ typography: 'body2', fontWeight: 300, mt: 0.2 }}>
          {[0, 1].map((index) => {
            const leadership = leaderships[index];

            if (!leadership) {
              if (isMobile) return null;

              return (
                <Box key={index} sx={{ color: 'text.secondary' }}>
                  -
                </Box>
              );
            }

            let link = '#';

            if (leadership.level === 'dest') {
              link = `/dashboard/level/dest?name=${encodeURIComponent(dest?.name || '')}`;
            }

            if (leadership.level === 'sectional') {
              link = `/dashboard/level/sectional?sectional=${encodeURIComponent(sectionalName)}`;
            }

            if (leadership.level === 'regional') {
              link = `/dashboard/level/regional?region=${member.regionalId}`;
            }

            if (leadership.level === 'national') {
              link = `/dashboard/level/national`;
            }

            return (
              <Box
                key={index}
                onClick={() => router.push(link)}
                sx={{
                  cursor: 'pointer',
                  color: index === 1 ? 'text.secondary' : 'text.primary',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {leadership.label}
              </Box>
            );
          })}
        </Box>

        <Box
          component="a"
          href={`tel:${member.phoneNumber}`}
          sx={{
            typography: 'caption',
            color: 'primary.main',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          {(() => {
            try {
              return member.phoneNumber
                ? parsePhoneNumber(
                    member.phoneNumber.startsWith('+')
                      ? member.phoneNumber
                      : `+1${member.phoneNumber}`
                  )?.formatNational()
                : '';
            } catch {
              return member.phoneNumber;
            }
          })()}
        </Box>
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Box
        sx={{
          py: 0.5,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            py: 1.5,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {/* Destacamento */}
          <Box
            onClick={() =>
              router.push(`/dashboard/level/dest?dest=${encodeURIComponent(member.destId)}`)
            }
            sx={{
              typography: 'caption',
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            {`Dest. ${`${dest?.nombre || 'Desconocido'} ${dest?.numero || ''}`.trim()}`}
          </Box>

          <Box
            component="span"
            sx={{
              typography: 'body2',
              fontSize: '1rem',
              color: 'text.disabled',
              lineHeight: 1,
            }}
          >
            •
          </Box>

          {/* Sección */}
          <Box
            onClick={() =>
              router.push(
                `/dashboard/level/sectional?sectional=${encodeURIComponent(sectionalName)}`
              )
            }
            sx={{
              typography: 'caption',
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            Sección {sectionalName}
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
