import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import ListItemText from '@mui/material/ListItemText';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const getSectionalId = (sectional) => sectional?.id ?? sectional?.idSeccion ?? sectional?.sectionalId;

const getSectionalAvatar = (sectional) =>
  sectional?.avatarUrl ?? sectional?.photoURL ?? sectional?.urlFoto ?? '';

const getSectionalName = (sectional) =>
  sectional?.sectionalName || sectional?.nombre || sectional?.name || 'Sección desconocida';

const getDirectorName = (sectional) =>
  sectional?.memberFullName ||
  [sectional?.memberFirstName, sectional?.memberLastName].filter(Boolean).join(' ').trim() ||
  'Desconocido';

const getRegionalName = (sectional) =>
  sectional?.regionalName || sectional?.regionName || sectional?.nombreRegion || 'Desconocida';

// ----------------------------------------------------------------------

export function SectionalCard({ sectional, sx, ...other }) {
  const sectionalId = getSectionalId(sectional);
  const editHref = sectionalId ? `/dashboard/level/sectional/${sectionalId}/edit` : '#';
  const sectionalName = getSectionalName(sectional);
  const directorName = getDirectorName(sectional);
  const regionalName = getRegionalName(sectional);

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
          alt={sectionalName}
          src={getSectionalAvatar(sectional)}
          sx={{ width: 48, height: 48, mr: 2 }}
        />
      </Link>

      <ListItemText
        primary={
          <Link href={editHref} color="inherit" underline="hover">
            {sectionalName}
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
                Director {directorName}
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
                Región {regionalName}
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
