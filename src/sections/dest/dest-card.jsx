import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';

import {
  getCoverPhotoConfig,
  sectionalCoverGroup,
  getCoverPhotoImageSx,
  DEFAULT_COVER_PHOTO_SRC,
  fetchCoverPhotoOverrides,
} from 'src/utils/cover-photos';

import { AvatarShape } from 'src/assets/illustrations';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';

import { Image } from 'src/components/image';
// ----------------------------------------------------------------------

export function DestCard({ dest, sx, ...other }) {
  const router = useRouter();
  const [sectionals, setSectionals] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [churches, setChurches] = useState([]);
  const [members, setMembers] = useState([]);
  const [, setCoverVersion] = useState(0);

  useEffect(() => {
    const load = async () => {
      const sectionalsData = await getSectionals();
      const regionalsData = await getRegionals();
      const churchesData = await getChurches();

      setSectionals(sectionalsData || []);
      setRegionals(regionalsData?.Data || regionalsData || []);
      setChurches(churchesData || []);
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

  const destChurchId = dest?.idIglesia || dest?.churchId;
  const church = churches.find(
    (c) => Number(c.idIglesia) === Number(destChurchId) || Number(c.id) === Number(destChurchId)
  );

  const churchName = church?.name || dest?.churchName || 'Iglesia desconocida';

  const sectional = sectionals.find(
    (s) =>
      Number(s.idSeccion) === Number(church?.idSeccion) ||
      Number(s.id) === Number(church?.idSeccion) ||
      Number(s.idSeccion) === Number(church?.sectionId) ||
      Number(s.id) === Number(church?.sectionId) ||
      Number(s.idSeccion) === Number(dest?.sectionalId) ||
      Number(s.id) === Number(dest?.sectionalId) ||
      String(s.sectionalName || '')
        .trim()
        .toLowerCase() ===
        String(dest?.sectionalName || '')
          .trim()
          .toLowerCase()
  );

  const regional = regionals.find(
    (r) =>
      Number(r.id) === Number(sectional?.regionalId) ||
      Number(r.idRegion) === Number(sectional?.regionalId)
  );

  const coverConfig = getCoverPhotoConfig({
    group: sectionalCoverGroup,
    ids: [
      sectional?.id,
      sectional?.idSeccion,
      sectional?.sectionalName,
      sectional?.nombre,
      sectional?.name,
      dest?.sectionalId,
      dest?.idSeccion,
      dest?.sectionalName,
    ],
    defaultSrc: dest?.coverUrl || DEFAULT_COVER_PHOTO_SRC,
  });

  useEffect(() => {
    const loadMembers = async () => {
      const data = await getMembers();
      setMembers(data || []);
    };
    loadMembers();
  }, []);

  const coordinator = members.find(
    (m) =>
      String(m.memberId) === String(dest.coordinatorId) ||
      String(m.id) === String(dest.coordinatorId)
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
          src={coverConfig.src}
          alt={sectional?.sectionalName || dest.coverUrl}
          ratio="16/6"
          slotProps={{
            img: {
              sx: getCoverPhotoImageSx(coverConfig),
            },
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
        }
        secondary={dest.role}
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
        <Box sx={{ typography: 'body2', fontWeight: 300, mt: 0.2 }}>{`Iglesia ${churchName}`}</Box>

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
                  sectional?.sectionalName || ''
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
            {sectional?.sectionalName
              ? `Sección ${sectional.sectionalName}`
              : 'Sección desconocida'}
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
                `/dashboard/level/regional?region=${encodeURIComponent(regional?.name || '')}`
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
            {regional?.name || 'Región desconocida'}
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
