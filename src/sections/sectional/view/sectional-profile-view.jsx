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
import { _sectionalAbout, _sectionalFeeds, _sectionalFriends, _sectionalGallery, _sectionalFollowers } from 'src/_mock';

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
    icon: <Iconify width={24} icon="solar:sectional-id-bold" />,
  },
  {
    value: 'followers',
    label: 'Followers',
    icon: <Iconify width={24} icon="solar:heart-bold" />,
  },
  {
    value: 'friends',
    label: 'Friends',
    icon: <Iconify width={24} icon="solar:sectionals-group-rounded-bold" />,
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

  const { sectional } = useMockedUser();

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
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Nacional', href: paths.dashboard.level.sectional.root },
          { name: sectional?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ height: 290 }}>
        <ProfileCover
          role={_sectionalAbout.role}
          name={sectional?.displayName}
          avatarUrl={sectional?.photoURL}
          coverUrl={_sectionalAbout.coverUrl}
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

      {selectedTab === '' && <ProfileHome info={_sectionalAbout} posts={_sectionalFeeds} sx={{ mt: 3 }} />}

      {selectedTab === 'followers' && <ProfileFollowers followers={_sectionalFollowers} />}

      {selectedTab === 'friends' && (
        <ProfileFriends
          friends={_sectionalFriends}
          searchFriends={searchFriends}
          onSearchFriends={handleSearchFriends}
        />
      )}
      {selectedTab === 'gallery' && <ProfileGallery gallery={_sectionalGallery} />}
    </DashboardContent>
  );
}
