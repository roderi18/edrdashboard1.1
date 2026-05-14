'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { usePathname, useSearchParams } from 'src/routes/hooks';

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
    label: 'Galeria',
    icon: <Iconify width={24} icon="solar:gallery-wide-bold" />,
  },
];

// ----------------------------------------------------------------------

const TAB_PARAM = 'tab';

const getIdentityKeys = (values = []) =>
  values.filter(Boolean).flatMap((value) => {
    const normalizedValue = String(value).trim().toLowerCase();
    const emailUser = normalizedValue.includes('@') ? normalizedValue.split('@')[0] : '';

    return [normalizedValue, emailUser].filter(Boolean);
  });

const getDisplayName = (user, fallback = '') =>
  user?.displayName ||
  user?.name ||
  user?.nombre ||
  [user?.nombres || user?.firstName, user?.apellidos || user?.lastName].filter(Boolean).join(' ') ||
  user?.email ||
  fallback;

const getDestacamentoLabel = (user, fallback = '') => {
  const destName =
    user?.destName ||
    user?.destacamentoName ||
    user?.nombreDestacamento ||
    user?.destacamento ||
    user?.destamento;
  const destNumber =
    user?.destacamentoNumero || user?.numeroDestacamento || user?.idDestacamento || user?.destId;
  const scopeDest = user?.alcance?.destacamentos?.[0];

  if (destName && destNumber && !String(destName).includes(String(destNumber))) {
    return `${destName} ${destNumber}`;
  }

  if (destName) return destName;
  if (destNumber) return `Destacamento ${destNumber}`;
  if (scopeDest) return `Destacamento ${scopeDest}`;

  return fallback;
};

export function UserProfileView({ hideBreadcrumb = false, useSessionProfile = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedTab = searchParams.get(TAB_PARAM) ?? '';

  const { user: mockedUser } = useMockedUser();
  const { user: sessionUser } = useAuthContext();

  const [searchFriends, setSearchFriends] = useState('');
  const [resolvedPhotoURL, setResolvedPhotoURL] = useState('');

  const userIdentityKeys = useMemo(
    () =>
      getIdentityKeys([
        sessionUser?.idMiembros,
        sessionUser?.memberId,
        sessionUser?.codigoMiembro,
        sessionUser?.codigoUsuario,
        sessionUser?.correo,
        sessionUser?.email,
        sessionUser?.uid,
      ]),
    [sessionUser]
  );

  useEffect(() => {
    let active = true;
    const hasPhoto = sessionUser?.photoURL || sessionUser?.avatarUrl || sessionUser?.urlFoto;

    if (!useSessionProfile || hasPhoto || !userIdentityKeys.length) {
      setResolvedPhotoURL('');
      return undefined;
    }

    const resolvePhoto = async () => {
      const response = await fetch('/api/chat/?endpoint=contacts', { cache: 'no-store' }).catch(
        () => null
      );

      if (!active || !response?.ok) {
        return;
      }

      const payload = await response.json().catch(() => ({}));
      const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
      const contact = contacts.find((item) =>
        getIdentityKeys([
          item.idMiembros,
          item.id,
          item.memberId,
          item.codigoMiembro,
          item.codigoUsuario,
          item.correo,
          item.email,
        ]).some((value) => userIdentityKeys.includes(value))
      );

      if (active) {
        setResolvedPhotoURL(contact?.avatarUrl || '');
      }
    };

    resolvePhoto();

    return () => {
      active = false;
    };
  }, [
    useSessionProfile,
    userIdentityKeys,
    sessionUser?.photoURL,
    sessionUser?.avatarUrl,
    sessionUser?.urlFoto,
  ]);

  const displayName = useSessionProfile
    ? getDisplayName(sessionUser, mockedUser?.displayName)
    : mockedUser?.displayName;
  const photoURL = useSessionProfile
    ? sessionUser?.photoURL || sessionUser?.avatarUrl || sessionUser?.urlFoto || resolvedPhotoURL
    : mockedUser?.photoURL;
  const destacamentoLabel = useSessionProfile
    ? getDestacamentoLabel(sessionUser, _userAbout.role)
    : _userAbout.role;
  const profileInfo = useSessionProfile
    ? {
        ..._userAbout,
        email: sessionUser?.email || sessionUser?.correo || _userAbout.email,
        role: destacamentoLabel,
      }
    : _userAbout;
  const user = { ...mockedUser, displayName, photoURL };

  const handleSearchFriends = useCallback((event) => {
    setSearchFriends(event.target.value);
  }, []);

  const createRedirectPath = (currentPath, query) => {
    const queryString = new URLSearchParams({ [TAB_PARAM]: query }).toString();
    return query ? `${currentPath}?${queryString}` : currentPath;
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

      <Card sx={{ height: 290 }}>
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
          <Tabs value={selectedTab}>
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
        <ProfileHome info={profileInfo} posts={_userFeeds} user={user} sx={{ mt: 3 }} />
      )}

      {selectedTab === 'followers' && <ProfileFollowers followers={_userFollowers} />}

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
