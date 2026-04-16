import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';
import { useEffect, useState } from 'react';

import { _socials } from 'src/_mock';
import { AvatarShape } from 'src/assets/illustrations';

import { Image } from 'src/components/image';
import { resolveById } from 'src/utils/resolve-display-name';
import { useRouter } from 'next/navigation';
import { REGIONALS } from 'src/_mock/assets';
import { getSectionals } from 'src/services/sectional-service';
import { getRegionals } from 'src/services/regional-service';
import { getChurches } from 'src/services/church-service';
import { getMembers } from 'src/services/member-service';
// ----------------------------------------------------------------------

export function DestCard({ dest, sx, ...other }) {

  const router = useRouter();
  const [sectionals, setSectionals] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [churches, setChurches] = useState([]);

  useEffect(() => {
    const load = async () => {
      const sectionalsData = await getSectionals();
      const regionalsData = await getRegionals();
      const churchesData = await getChurches();

      setSectionals(sectionalsData || []);
      setRegionals(regionalsData || []);
      setChurches(churchesData || []);
    };

    load();
  }, []);

  const church = churches.find(
    (c) => Number(c.id) === Number(dest?.idIglesia)
  );

  const churchName =
    church?.name ||
    dest?.churchName ||
    'Iglesia desconocida';

  const sectional = sectionals.find(
    (s) => String(s.idSeccion) === String(church?.sectionId)
  );

  const regional = regionals.find(
    (r) => String(r.idRegion) === String(sectional?.regionalId)
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

  const [members, setMembers] = useState([]);

  useEffect(() => {
    const loadMembers = async () => {
      const data = await getMembers();
      setMembers(data || []);
    };
    loadMembers();
  }, []);

  const coordinator = members.find(
    (m) => m.memberId === dest.coordinatorId
  );

  const handleGoToDest = () => {
    if (!dest?.id) {
      console.error('ID inválido 👉', dest);
      return;
    }

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
          alt={dest.nombre}
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
            {`Destacamento ${dest.nombre} ${dest.numero || ''}`}
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
          {`Iglesia ${churchName}`}
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
                    router.push(`/dashboard/level/member/${coordinator.memberId}/edit`)
                  }
                  sx={{
                    typography: 'caption',
                    color: 'primary.main',
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {`${coordinator.firstName} ${coordinator.lastName}`}
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
                  church?.sectionalName || ''
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
            {sectional?.sectionalName ? `Sección ${sectional.sectionalName}` : '-'}
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
