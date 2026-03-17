import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';

import { _socials } from 'src/_mock';
import { AvatarShape } from 'src/assets/illustrations';

import { Image } from 'src/components/image';
import { resolveById } from 'src/utils/resolve-display-name';
import { useRouter } from 'next/navigation';
import { SECTIONALS, REGIONALS, CHURCHES, MEMBERS } from 'src/_mock/assets';
import { LEADERSHIP_ASSIGNMENTS } from 'src/_mock/leadershipAssignments';
// ----------------------------------------------------------------------

export function DestCard({ dest, sx, ...other }) {

  const router = useRouter();

  const church = CHURCHES.find(
    (c) => c.id === dest?.churchId
  );

  const churchName =
    church?.name ||
    dest?.churchName ||
    'Iglesia desconocida';

  const sectional = SECTIONALS.find(
    (s) => s.id === dest.sectionalId
  );
  console.log('Sectional ID:', sectional?.id);
  const regional = REGIONALS.find(
    (r) => r.id === sectional?.regionalId
  );

  // Imagen según sección
  const sectionalCoverMap = {
    'sec-este-01': '/assets/images/divisions/dest/tiburones-del-este.jpg',
    'sec-este-02': '/assets/images/divisions/dest/tiburones-del-este.jpg',
    'sec-norte-01': '/assets/images/divisions/dest/aguilas-del-norte.jpg',
    'sec-sur-01': '/assets/images/divisions/dest/titanes-del-sur.jpg',
    'sec-central-05': '/assets/images/divisions/dest/guardianes-central.jpg',
  };

  const coverSrc =
    sectionalCoverMap[sectional?.id?.trim()] ||
    '/assets/images/divisions/default.jpg';

  const coordinatorAssignment = LEADERSHIP_ASSIGNMENTS.find(
    (l) =>
      l.level === 'dest' &&
      l.entityId === dest.id &&
      l.role === 'coordinador_dest' &&
      l.status === 'active'
  );

  const coordinator = MEMBERS.find(
    (m) => m.id === coordinatorAssignment?.memberId
  );

  const handleGoToDest = () => {
    router.push(`/dashboard/level/dest/${dest.id}/edit`);
  };

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
          alt={dest.destName}
          src={dest.avatarUrl}
          onClick={handleGoToDest}
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
          alt={dest.coverUrl}
          ratio="16/6"
          slotProps={{
            overlay: {
              sx: (theme) => ({
                bgcolor: varAlpha(theme.vars.palette.common.blackChannel, 0.43),
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
            onClick={handleGoToDest}
            sx={{
              typography: 'subtitle1',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {dest.destName}
          </Box>
        } secondary={dest.role}
      />

      {/* inferior */}
      <Box
        sx={{
          mb: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 0,
        }}
      >
        <Box sx={{ typography: 'body2', fontWeight: 300, mt: 0.2 }}>
          {churchName}
        </Box>

        {/* Coordinador */}
        <Box sx={{ typography: 'caption', mt: 0.5 }}>
          <Box sx={{ typography: 'caption', mt: 0.5 }}>
            {coordinator ? (
              <>
                Coord. Dest.:{' '}
                <Box
                  component="span"
                  onClick={() =>
                    router.push(`/dashboard/level/member/${coordinator.id}/edit`)
                  }
                  sx={{
                    typography: 'caption',
                    color: 'primary.main',
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {coordinator.fullName}
                </Box>
              </>
            ) : (
              'Coord. Dest. Desconocido'
            )}
          </Box>
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
          {/* Sección */}
          <Box
            onClick={() =>
              router.push(
                `/dashboard/level/sectional?sectional=${encodeURIComponent(
                  dest.sectionalId
                )}`
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
            {resolveById(SECTIONALS, dest.sectionalId)}
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

          {/* Región */}
          <Box
            onClick={() =>
              sectional &&
              router.push(
                `/dashboard/level/regional?section=${encodeURIComponent(
                  resolveById(REGIONALS, sectional.regionalId)
                )}`
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
            {sectional ? resolveById(REGIONALS, sectional.regionalId) : 'Región desconocida'}
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
