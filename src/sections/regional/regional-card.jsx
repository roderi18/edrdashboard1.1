import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import ListItemText from '@mui/material/ListItemText';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const getRegionalId = (regional) => regional?.id ?? regional?.idRegion ?? regional?.regionalId;

const getRegionalAvatar = (regional) =>
  regional?.avatarUrl ?? regional?.photoURL ?? regional?.urlFoto ?? '';

const getRegionalName = (regional) =>
  regional?.regionalName || regional?.name || regional?.nombre || 'Región desconocida';

const getDirectorName = (regional) =>
  regional?.memberFullName ||
  [regional?.memberFirstName, regional?.memberLastName].filter(Boolean).join(' ').trim() ||
  'Desconocido';

// ----------------------------------------------------------------------

export function RegionalCard({ regional, sx, ...other }) {
  const regionalId = getRegionalId(regional);
  const editHref = regionalId ? `/dashboard/level/regional/${regionalId}/edit` : '#';
  const regionalName = getRegionalName(regional);
  const directorName = getDirectorName(regional);

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
          alt={regionalName}
          src={getRegionalAvatar(regional)}
          sx={{ width: 48, height: 48, mr: 2 }}
        />
      </Link>

      <ListItemText
        primary={
          <Link href={editHref} color="inherit" underline="hover">
            {regionalName}
          </Link>
        }
        secondary={
          <Box
            component="span"
            sx={{
              mt: 0.5,
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
        }
        slotProps={{
          primary: { noWrap: true },
          secondary: { component: 'span', sx: { display: 'block' } },
        }}
      />
    </Card>
  );
}
