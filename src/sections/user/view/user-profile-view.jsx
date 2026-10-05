'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { usePathname, useSearchParams } from 'src/routes/hooks';

import { destacamentoDelMiembro } from 'src/utils/destacamento-del-perfil.mjs';

import { getDestsApi } from 'src/services/dest-service';
import { getMembers } from 'src/services/member-service';
import { DashboardContent } from 'src/layouts/dashboard';
import { _userAbout, _userFeeds, _userFriends, _userGallery, _userFollowers } from 'src/_mock';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useMockedUser, useAuthContext } from 'src/auth/hooks';

import { ProfileHome } from '../profile-home';
import { ProfileCover } from '../profile-cover';
import { ProfileFriends } from '../profile-friends';
import { ProfileGallery } from '../profile-gallery';
import { ProfileFollowers } from '../profile-followers';

// ----------------------------------------------------------------------

const NAV_ITEMS = [
  {
    value: '',
    label: 'Perfil',
    icon: <Iconify width={24} icon="solar:user-id-bold" />,
  },
  {
    value: 'followers',
    label: 'Seguidores',
    icon: <Iconify width={24} icon="solar:heart-bold" />,
  },
  {
    value: 'friends',
    label: 'Amigos',
    icon: <Iconify width={24} icon="solar:users-group-rounded-bold" />,
  },
  {
    value: 'gallery',
    label: 'Galería',
    icon: <Iconify width={24} icon="solar:gallery-wide-bold" />,
  },
];

// ----------------------------------------------------------------------

const TAB_PARAM = 'tab';

const getDisplayName = (user, fallback = '') =>
  user?.displayName ||
  user?.name ||
  user?.nombre ||
  [user?.nombres || user?.firstName, user?.apellidos || user?.lastName].filter(Boolean).join(' ') ||
  user?.email ||
  fallback;

const normalizePath = (value = '') => String(value || '').replace(/\/$/, '');

const getParamMemberId = ({ pathname, searchParams }) => {
  if (normalizePath(pathname) !== paths.dashboard.user.root) return null;

  const idMiembros = Number(searchParams.get('idMiembros') || 0);

  return Number.isFinite(idMiembros) && idMiembros > 0 ? idMiembros : null;
};

const normalizeContactProfile = (contact = {}, idMiembros = null) => ({
  ...contact,
  id: String(contact.id || contact.idMiembros || idMiembros || ''),
  idMiembros: Number(contact.idMiembros || contact.id || idMiembros || 0) || idMiembros,
  displayName: contact.displayName || contact.name || getDisplayName(contact),
  name: contact.name || contact.displayName || getDisplayName(contact),
  photoURL: contact.photoURL || contact.avatarUrl || contact.urlFoto || '',
  avatarUrl: contact.avatarUrl || contact.photoURL || contact.urlFoto || '',
  email: contact.email || contact.correo || '',
});

export function UserProfileView({ hideBreadcrumb = false, useSessionProfile = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedTab = searchParams.get(TAB_PARAM) ?? '';
  const profileMemberId = useMemo(
    () => getParamMemberId({ pathname, searchParams }),
    [pathname, searchParams]
  );

  const { user: mockedUser } = useMockedUser();
  const { user: sessionUser } = useAuthContext();

  const [searchFriends, setSearchFriends] = useState('');
  const [targetProfile, setTargetProfile] = useState(null);

  useEffect(() => {
    let active = true;

    if (!profileMemberId) {
      setTargetProfile(null);
      return undefined;
    }

    const resolveTargetProfile = async () => {
      const response = await fetch('/api/chat/?endpoint=contacts', { cache: 'no-store' }).catch(
        () => null
      );

      if (!active) return;

      if (!response?.ok) {
        setTargetProfile(normalizeContactProfile({}, profileMemberId));
        return;
      }

      const payload = await response.json().catch(() => ({}));
      const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
      const contact = contacts.find(
        (item) => Number(item.idMiembros || item.id || 0) === Number(profileMemberId)
      );

      if (active) {
        setTargetProfile(normalizeContactProfile(contact || {}, profileMemberId));
      }
    };

    resolveTargetProfile();

    return () => {
      active = false;
    };
  }, [profileMemberId]);

  // Sin `?idMiembros=` el perfil es el de QUIEN TIENE LA SESIÓN. Antes solo lo
  // era si se pasaba `useSessionProfile`, y `/dashboard/user` no lo pasaba: salía
  // el usuario de ejemplo de la plantilla ("Roderi Pena", "CTO", avatar de
  // dibujo) a cualquiera que entrara.
  const perfilDeLaSesion = useSessionProfile || Boolean(sessionUser);
  // De quién es el perfil: el miembro de la dirección o, si no, el de la sesión.
  // Con él se filtra el muro (solo SUS publicaciones; antes salía el muro de
  // todos) y se busca su destacamento.
  const idMiembrosDelPerfil =
    profileMemberId || (perfilDeLaSesion ? Number(sessionUser?.idMiembros) || null : null);

  // Donde decía "CTO" va su destacamento ("Tribu de Judá 18"). Antes se adivinaba
  // con los campos de la sesión, que no lo traen, y el "número" salía del id
  // interno del destacamento.
  const [destacamentoLabel, setDestacamentoLabel] = useState('');

  useEffect(() => {
    let activo = true;

    setDestacamentoLabel('');

    if (!idMiembrosDelPerfil) return undefined;

    Promise.all([getMembers(), getDestsApi({ includePhotos: false })])
      .then(([miembros, destacamentos]) => {
        if (activo) {
          setDestacamentoLabel(
            destacamentoDelMiembro({ idMiembros: idMiembrosDelPerfil, miembros, destacamentos })
          );
        }
      })
      .catch((error) => console.error('[perfil] no se pudo leer el destacamento', error));

    return () => {
      activo = false;
    };
  }, [idMiembrosDelPerfil]);

  const currentDisplayName = getDisplayName(sessionUser, mockedUser?.displayName);
  const currentPhotoURL =
    sessionUser?.photoURL || sessionUser?.avatarUrl || sessionUser?.urlFoto || '';
  const viewerUser = perfilDeLaSesion
    ? {
        ...mockedUser,
        ...sessionUser,
        displayName: currentDisplayName,
        name: currentDisplayName,
        photoURL: currentPhotoURL,
      }
    : mockedUser;
  const hasTargetProfile = Boolean(profileMemberId);
  const profileSource = hasTargetProfile
    ? targetProfile || normalizeContactProfile({}, profileMemberId)
    : perfilDeLaSesion
      ? sessionUser
      : mockedUser;
  const displayName = hasTargetProfile
    ? getDisplayName(profileSource, `Miembro ${profileMemberId}`)
    : perfilDeLaSesion
      ? currentDisplayName
      : mockedUser?.displayName;
  const photoURL = hasTargetProfile
    ? profileSource?.photoURL || profileSource?.avatarUrl || profileSource?.urlFoto || ''
    : perfilDeLaSesion
      ? currentPhotoURL
      : mockedUser?.photoURL;
  const profileInfo =
    perfilDeLaSesion || hasTargetProfile
      ? {
          ..._userAbout,
          email:
            profileSource?.email ||
            profileSource?.correo ||
            sessionUser?.email ||
            sessionUser?.correo ||
            _userAbout.email,
          role: destacamentoLabel,
        }
      : _userAbout;
  const user = hasTargetProfile
    ? {
        ...mockedUser,
        ...profileSource,
        id: String(profileMemberId),
        idMiembros: profileMemberId,
        displayName,
        name: displayName,
        photoURL,
      }
    : perfilDeLaSesion
      ? {
          ...mockedUser,
          ...sessionUser,
          displayName,
          name: displayName,
          photoURL,
        }
      : { ...mockedUser, displayName, photoURL };

  const handleSearchFriends = useCallback((event) => {
    setSearchFriends(event.target.value);
  }, []);

  const createRedirectPath = (currentPath, query) => {
    const params = new URLSearchParams(searchParams.toString());

    if (query) {
      params.set(TAB_PARAM, query);
    } else {
      params.delete(TAB_PARAM);
    }

    const queryString = params.toString();

    return queryString ? `${currentPath}?${queryString}` : currentPath;
  };

  return (
    <DashboardContent>
      {!hideBreadcrumb && (
        <CustomBreadcrumbs
          heading="Perfil"
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Usuario', href: paths.dashboard.user.root },
            { name: user?.displayName },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />
      )}

      <Card
        sx={{
          height: { xs: 260, md: 290 },
          overflow: 'hidden',
          border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
        }}
      >
        <ProfileCover
          role={profileInfo.role}
          name={user?.displayName}
          avatarUrl={user?.photoURL}
          coverUrl={profileInfo.coverUrl}
        />

        <Box
          sx={{
            width: 1,
            bottom: 0,
            zIndex: 9,
            px: { md: 3 },
            display: 'flex',
            position: 'absolute',
            bgcolor: 'background.paper',
            justifyContent: { xs: 'center', md: 'flex-end' },
          }}
        >
          <Tabs
            value={selectedTab}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Secciones del perfil"
            sx={{ maxWidth: 1 }}
          >
            {NAV_ITEMS.map((tab) => (
              <Tab
                component={RouterLink}
                key={tab.value}
                value={tab.value}
                icon={tab.icon}
                label={tab.label}
                href={createRedirectPath(pathname, tab.value)}
              />
            ))}
          </Tabs>
        </Box>
      </Card>

      {selectedTab === '' && (
        <ProfileHome
          info={profileInfo}
          posts={_userFeeds}
          user={hasTargetProfile ? viewerUser : user}
          perfilIdMiembros={idMiembrosDelPerfil}
          sx={{ mt: 3 }}
        />
      )}

      {selectedTab === 'followers' && (
        <ProfileFollowers followers={_userFollowers} info={profileInfo} />
      )}

      {selectedTab === 'friends' && (
        <ProfileFriends
          friends={_userFriends}
          searchFriends={searchFriends}
          onSearchFriends={handleSearchFriends}
        />
      )}
      {selectedTab === 'gallery' && <ProfileGallery gallery={_userGallery} />}
    </DashboardContent>
  );
}
