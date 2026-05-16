import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import ListItemText from '@mui/material/ListItemText';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const getDestId = (dest) => dest?.id ?? dest?.idDestacamento ?? dest?.destId;

const getDestAvatar = (dest) => dest?.avatarUrl ?? dest?.photoURL ?? dest?.urlFoto ?? '';

const getDestName = (dest) => {
  const name = dest?.nombre || dest?.name || dest?.destName || 'Desconocido';
  const number = dest?.numero || dest?.destNumber || dest?.number || '';
  const label = [name, number].filter(Boolean).join(' ').trim();

  return label.toLowerCase().startsWith('dest') ? label : `Destacamento ${label}`;
};

const getCoordinatorName = (dest) =>
  dest?.memberFullName ||
  [dest?.memberFirstName, dest?.memberLastName].filter(Boolean).join(' ').trim() ||
  'Desconocido';

const getSectionalName = (dest) => dest?.sectionalName || dest?.sectionName || 'Desconocida';

// ----------------------------------------------------------------------

export function DestCard({ dest, sx, ...other }) {
  const destId = getDestId(dest);
  const editHref = destId ? `/dashboard/level/dest/${destId}/edit` : '#';
  const coordinatorName = getCoordinatorName(dest);
  const sectionalName = getSectionalName(dest);

  return (
    <Card
      sx={[
        (theme) => ({
          display: 'flex',
          alignItems: 'center',
          minHeight: 88,
          p: theme.spacing(3, 2, 3, 3),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Link href={editHref} color="inherit" underline="none">
        <Avatar
          alt={getDestName(dest)}
          src={getDestAvatar(dest)}
          sx={{ width: 48, height: 48, mr: 2 }}
        />
      </Link>

      <ListItemText
        primary={
          <Link href={editHref} color="inherit" underline="hover">
            {getDestName(dest)}
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
              <Iconify icon="solar:user-bold" width={16} sx={{ flexShrink: 0, mr: 0.5 }} />
              <Box
                component="span"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                Coord. {coordinatorName}
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
                Sección {sectionalName}
              </Box>
            </Box>
          </Box>
        }
        slotProps={{
          primary: { noWrap: true },
          secondary: { component: 'span', sx: { mt: 0.5, display: 'block' } },
        }}
      />
    </Card>
  );
}
