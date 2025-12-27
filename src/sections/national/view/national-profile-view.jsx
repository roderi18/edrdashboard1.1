'use client';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { usePathname, useSearchParams } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';
import { _nationalAbout, _nationalFeeds, _nationalFriends, _nationalGallery, _nationalFollowers } from 'src/_mock';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useMockedUser } from 'src/auth/hooks';

import { ProfileHome } from '../profile-home';
import { ProfileCover } from '../profile-cover';
import { ProfileFriends } from '../profile-friends';
import { ProfileGallery } from '../profile-gallery';
import { ProfileFollowers } from '../profile-followers';

// ----------------------------------------------------------------------

const NAV_ITEMS = [
  {
    value: '',
    label: 'Profile',
    icon: <Iconify width={24} icon="solar:national-id-bold" />,
  },
  {
    value: 'followers',
    label: 'Followers',
    icon: <Iconify width={24} icon="solar:heart-bold" />,
  },
  {
    value: 'friends',
    label: 'Friends',
    icon: <Iconify width={24} icon="solar:nationals-group-rounded-bold" />,
  },
  {
    value: 'gallery',
    label: 'Gallery',
    icon: <Iconify width={24} icon="solar:gallery-wide-bold" />,
  },
];

// ----------------------------------------------------------------------

const TAB_PARAM = 'tab';

export function NationalProfileView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedTab = searchParams.get(TAB_PARAM) ?? '';

  const { national } = useMockedUser();

  const [searchFriends, setSearchFriends] = useState('');

  const handleSearchFriends = useCallback((event) => {
    setSearchFriends(event.target.value);
  }, []);

  const createRedirectPath = (currentPath, query) => {
    const queryString = new URLSearchParams({ [TAB_PARAM]: query }).toString();
    return query ? `${currentPath}?${queryString}` : currentPath;
  };

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Profile"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'National', href: paths.dashboard.national.root },
          { name: national?.displayName },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ height: 290 }}>
        <ProfileCover
          role={_nationalAbout.role}
          name={national?.displayName}
          avatarUrl={national?.photoURL}
          coverUrl={_nationalAbout.coverUrl}
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

      {selectedTab === '' && <ProfileHome info={_nationalAbout} posts={_nationalFeeds} sx={{ mt: 3 }} />}

      {selectedTab === 'followers' && <ProfileFollowers followers={_nationalFollowers} />}

      {selectedTab === 'friends' && (
        <ProfileFriends
          friends={_nationalFriends}
          searchFriends={searchFriends}
          onSearchFriends={handleSearchFriends}
        />
      )}
      {selectedTab === 'gallery' && <ProfileGallery gallery={_nationalGallery} />}
    </DashboardContent>
  );
}
