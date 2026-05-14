import { useRouter } from 'next/navigation';
import { varAlpha } from 'minimal-shared/utils';
import { parsePhoneNumber } from 'libphonenumber-js';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';

import { fShortenNumber } from 'src/utils/format-number';
import { DEFAULT_COVER_PHOTO_SRC } from 'src/utils/cover-photos';

import { MEMBERS } from 'src/_mock/assets';
import { AvatarShape } from 'src/assets/illustrations';
import { LEADERSHIP_ASSIGNMENTS } from 'src/_mock/leadershipAssignments';

import { Image } from 'src/components/image';
// ----------------------------------------------------------------------

export function RegionalCard({ regional, sx, ...other }) {
  const router = useRouter();

  const directorAssignment = LEADERSHIP_ASSIGNMENTS.find(
    (l) =>
      l.level === 'regional' &&
      l.entityId === regional.regionalId &&
      l.role === 'director_regional' &&
      l.status === 'active'
  );

  const director = MEMBERS.find((m) => m.id === directorAssignment?.memberId);

  return (
    <Card sx={[{ textAlign: 'center' }, ...(Array.isArray(sx) ? sx : [sx])]} {...other}>
      <Box sx={{ position: 'relative' }}>
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
          alt={regional.regionalName}
          src={regional.avatarUrl}
          sx={{
            left: 0,
            right: 0,
            width: 64,
            height: 64,
            zIndex: 11,
            mx: 'auto',
            bottom: -32,
            position: 'absolute',
          }}
        />

        <Image
          src={regional.coverUrl || DEFAULT_COVER_PHOTO_SRC}
          alt={regional.regionalName || 'Portada regional'}
          ratio="16/6"
          slotProps={{
            overlay: {
              sx: (theme) => ({
                bgcolor: varAlpha(theme.vars.palette.common.blackChannel, 0.48),
              }),
            },
          }}
        />
      </Box>

      <ListItemText
        sx={{ mt: 6, mb: 0.5 }}
        primary={
          <Box
            sx={{
              typography: 'subtitle1',
            }}
          >
            {regional.regionalName}
          </Box>
        }
      />

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
        <Box sx={{ typography: 'caption' }}>
          Director:{' '}
          {director ? (
            <Box
              component="span"
              onClick={() => router.push(`/dashboard/level/member/${director.id}/edit`)}
              sx={{
                typography: 'caption',
                color: 'primary.main',
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {director.fullName}
            </Box>
          ) : (
            'Desconocido'
          )}
        </Box>

        <Box
          component="a"
          href={director?.phoneNumber ? `tel:${director.phoneNumber}` : undefined}
          sx={{
            typography: 'caption',
            color: 'primary.main',
            textDecoration: 'none',
            cursor: director?.phoneNumber ? 'pointer' : 'default',
            '&:hover': {
              textDecoration: director?.phoneNumber ? 'underline' : 'none',
            },
          }}
        >
          {(() => {
            try {
              return director?.phoneNumber
                ? parsePhoneNumber(
                    director.phoneNumber.startsWith('+')
                      ? director.phoneNumber
                      : `+1${director.phoneNumber}`
                  )?.formatNational()
                : '';
            } catch {
              return director?.phoneNumber || '';
            }
          })()}
        </Box>
      </Box>

      <Box
        sx={{
          mb: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Box
        sx={{
          py: 3,
          display: 'grid',
          typography: 'subtitle1',
          gridTemplateColumns: 'repeat(3, 1fr)',
        }}
      >
        {[
          { label: 'Follower', value: regional.totalFollowers },
          { label: 'Following', value: regional.totalFollowing },
          { label: 'Total post', value: regional.totalPosts },
        ].map((stat) => (
          <Box key={stat.label} sx={{ gap: 0.5, display: 'flex', flexDirection: 'column' }}>
            <Box component="span" sx={{ typography: 'caption', color: 'text.secondary' }}>
              {stat.label}
            </Box>
            {fShortenNumber(stat.value)}
          </Box>
        ))}
      </Box>
    </Card>
  );
}
