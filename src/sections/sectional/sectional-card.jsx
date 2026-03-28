import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';
import { useState, useEffect } from 'react';

import { _socials } from 'src/_mock';
import { AvatarShape } from 'src/assets/illustrations';

import { Image } from 'src/components/image';

import { useRouter } from 'next/navigation';
import { parsePhoneNumber } from 'libphonenumber-js';
import { getMembers } from 'src/services/member-service';

// ----------------------------------------------------------------------

export function SectionalCard({ sectional, sx, ...other }) {
  const router = useRouter();

  const [members, setMembers] = useState([]);

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
    } catch (e) {
      return director?.phoneNumber || 'N/A';
    }
  })();


  const regional = {
    regionalName: sectional.regionalName,
  };

  const handleGoToSectional = () => {
    router.push(`/dashboard/level/sectional/${sectional.id}/edit`);
  };

  useEffect(() => {
    async function load() {
      const data = await getMembers();
      setMembers(data);
    }
    load();
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
          src={sectional.coverUrl}
          alt={sectional.coverUrl}
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
              onClick={() =>
                router.push(`/dashboard/level/member/${director.memberId}/edit`)
              }
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
                `/dashboard/level/regional?sectional=${encodeURIComponent(
                  regional?.regionalName || ''
                )}`
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
