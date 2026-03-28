import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';

import { _socials } from 'src/_mock';
import { AvatarShape } from 'src/assets/illustrations';

import { Image } from 'src/components/image';
import { parsePhoneNumber } from 'libphonenumber-js';
import Link from '@mui/material/Link';
import { RouterLink } from 'src/routes/components';
import { useRouter } from 'next/navigation';
// ----------------------------------------------------------------------

export function NationalCard({ national, sx, ...other }) {
  const router = useRouter();

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
          alt={national.nationalName}
          src={national.avatarUrl}
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
          src={national.coverUrl}
          alt={national.coverUrl}
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
          <Link
            component={RouterLink}
            href={`/dashboard/level/member/${national.memberId}/edit`}
            color="inherit"
            underline="hover"
            sx={{ cursor: 'pointer', typography: 'subtitle1' }}
          >
            {national.nationalXname}
          </Link>
        }
        secondary={national.nationalXMemberPositionLabel || national.nationalXMemberPosition}
      />

      <Box
        sx={{
          mb: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        <Box
          component="a"
          href={`tel:${national.phoneNumber}`}
          sx={{
            typography: 'caption',
            color: 'primary.main',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          {national.phoneNumber
            ? parsePhoneNumber(national.phoneNumber)?.formatNational()
            : 'N/A'}
        </Box>
      </Box>

      <Box
        sx={{
          mb: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >

      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />

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
          {/* Estructura */}
          <Box
            sx={{
              typography: 'caption',
              color: 'text.secondary',
              whiteSpace: 'nowrap',
            }}
          >
            {national.nationalEstructureLabel || '-'}
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
