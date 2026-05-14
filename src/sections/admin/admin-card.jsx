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
import {
  getCoverPhotoImageSx,
  fetchCoverPhotoOverrides,
  getMemberDivisionCoverConfig,
} from 'src/utils/cover-photos';

import { AvatarShape } from 'src/assets/illustrations';
import { _allLeadershipRoles } from 'src/_mock/_leadership';

import { Image } from 'src/components/image';

// ----------------------------------------------------------------------

export function AdminCard({ admin, sx, ...other }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();
  const leadershipAssignments = getStorageCollection('leadershipAssignments') || [];
  const [dests, setDests] = useState([]);
  const [, setCoverVersion] = useState(0);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dest');
      const data = await res.json();
      setDests(data?.Data || []);
    };
    load();
  }, []);

  useEffect(() => {
    const refreshCover = () => setCoverVersion((currentVersion) => currentVersion + 1);

    fetchCoverPhotoOverrides().then(refreshCover);

    window.addEventListener('storage', refreshCover);
    window.addEventListener('coverPhotosUpdated', refreshCover);

    return () => {
      window.removeEventListener('storage', refreshCover);
      window.removeEventListener('coverPhotosUpdated', refreshCover);
    };
  }, []);

  const coverConfig = getMemberDivisionCoverConfig(admin.memberDivision);

  const dest = dests.find((d) => Number(d.idDestacamento) === Number(admin.destId));

  const sectionalName = admin?.sectionalName || '-';

  let leaderships = leadershipAssignments
    .filter(
      (l) =>
        (l.memberId === admin.id || l.member_id === admin.id) &&
        (l.status === 'active' || !l.status)
    )
    .map((l) => ({
      ...l,
      label: _allLeadershipRoles.find((r) => r.value === l.role)?.label,
    }))
    .filter((l) => l.label);

  // si no tiene liderazgo pero si posicion en destacamento
  if (!leaderships.length && admin.memberPosition) {
    leaderships = [
      {
        label: admin.memberPosition,
        level: 'dest',
      },
    ];
  }

  const handleEdit = () => {
    router.push(`/dashboard/level/member/${admin.idMiembros || admin.memberId || admin.id}/edit`);
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
          alt={admin.name}
          src={admin.avatarUrl}
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
          src={coverConfig.src}
          alt={admin.memberDivision}
          ratio="16/6"
          slotProps={{
            img: {
              sx: getCoverPhotoImageSx(coverConfig),
            },
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
            {admin.name}
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
              link = `/dashboard/level/regional?region=${admin.regionalId}`;
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
          href={`tel:${admin.phoneNumber}`}
          sx={{
            typography: 'caption',
            color: 'primary.main',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          {(() => {
            try {
              return admin.phoneNumber
                ? parsePhoneNumber(
                    admin.phoneNumber.startsWith('+') ? admin.phoneNumber : `+1${admin.phoneNumber}`
                  )?.formatNational()
                : '';
            } catch {
              return admin.phoneNumber;
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
              router.push(`/dashboard/level/dest?dest=${encodeURIComponent(admin.destId)}`)
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
            &bull;
          </Box>

          {/* Seccion */}
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
