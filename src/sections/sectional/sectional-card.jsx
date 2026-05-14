import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { parsePhoneNumber } from 'libphonenumber-js';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';

import {
  regionalCoverGroup,
  getCoverPhotoConfig,
  getCoverPhotoImageSx,
  DEFAULT_COVER_PHOTO_SRC,
  fetchCoverPhotoOverrides,
} from 'src/utils/cover-photos';

import { AvatarShape } from 'src/assets/illustrations';
import { getMembers } from 'src/services/member-service';
import { getRegionals } from 'src/services/regional-service';

import { Image } from 'src/components/image';

// ----------------------------------------------------------------------

export function SectionalCard({ sectional, sx, ...other }) {
  const router = useRouter();

  const [members, setMembers] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [, setCoverVersion] = useState(0);

  const director = members.find(
    (m) =>
      String(m.memberId) === String(sectional.directorId) ||
      String(m.id) === String(sectional.directorId)
  );

  const directorPhone = (() => {
    try {
      return director?.phoneNumber
        ? parsePhoneNumber(
            director.phoneNumber.startsWith('+')
              ? director.phoneNumber
              : `+1${director.phoneNumber}`
          )?.formatNational()
        : 'N/A';
    } catch {
      return director?.phoneNumber || 'N/A';
    }
  })();

  const regional = regionals.find(
    (item) =>
      Number(item.id) === Number(sectional?.regionalId) ||
      Number(item.idRegion) === Number(sectional?.regionalId) ||
      Number(item.regionId) === Number(sectional?.regionalId) ||
      String(item.regionalName || item.name || '')
        .trim()
        .toLowerCase() ===
        String(sectional?.regionalName || sectional?.regionName || '')
          .trim()
          .toLowerCase()
  ) || {
    id: sectional?.regionalId || sectional?.idRegion,
    idRegion: sectional?.idRegion || sectional?.regionalId,
    regionId: sectional?.regionalId || sectional?.idRegion,
    regionalName: sectional?.regionalName || sectional?.regionName,
    name: sectional?.regionalName || sectional?.regionName,
  };

  const regionalName = regional?.regionalName || regional?.name;

  const coverConfig = getCoverPhotoConfig({
    group: regionalCoverGroup,
    ids: [
      regional?.id,
      regional?.idRegion,
      regional?.regionId,
      regional?.regionalName,
      regional?.name,
      sectional?.regionalId,
      sectional?.idRegion,
      sectional?.regionalName,
      sectional?.regionName,
    ],
    defaultSrc: sectional?.coverUrl || DEFAULT_COVER_PHOTO_SRC,
  });

  const handleGoToSectional = () => {
    router.push(`/dashboard/level/sectional/${sectional.id}/edit`);
  };

  useEffect(() => {
    async function load() {
      const [membersData, regionalsData] = await Promise.all([getMembers(), getRegionals()]);

      setMembers(membersData || []);
      setRegionals(regionalsData || []);
    }
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
          onClick={handleGoToSectional}
          alt={sectional.sectionalName}
          src={sectional.avatarUrl}
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
          alt={regionalName || sectional.coverUrl}
          ratio="16/6"
          slotProps={{
            img: {
              sx: getCoverPhotoImageSx(coverConfig),
            },
            overlay: {
              sx: (theme) => ({
                bgcolor: varAlpha(theme.vars.palette.common.blackChannel, 0.48),
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
            onClick={handleGoToSectional}
            sx={{
              typography: 'subtitle1',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {sectional.sectionalName}
          </Box>
        }
        secondary={sectional.role}
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
        <Box
          sx={{
            typography: 'caption',
            textAlign: 'center',
          }}
        >
          Director:{' '}
          {director ? (
            <Box
              component="span"
              onClick={() => router.push(`/dashboard/level/member/${director.memberId}/edit`)}
              sx={{
                typography: 'caption',
                color: 'primary.main',
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {`${director.firstName} ${director.lastName}`}
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
            color: director?.phoneNumber ? 'primary.main' : 'text.disabled',
            textDecoration: 'none',
            cursor: director?.phoneNumber ? 'pointer' : 'default',
            '&:hover': {
              textDecoration: director?.phoneNumber ? 'underline' : 'none',
            },
          }}
        >
          {directorPhone}
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
          {/* Región */}
          <Box
            onClick={() =>
              router.push(
                `/dashboard/level/regional?sectional=${encodeURIComponent(regionalName || '')}`
              )
            }
            sx={{
              typography: 'caption',
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              cursor: regional ? 'pointer' : 'default',
              '&:hover': {
                textDecoration: regional ? 'underline' : 'none',
              },
            }}
          >
            {regional?.regionalName || 'Región desconocida'}
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
