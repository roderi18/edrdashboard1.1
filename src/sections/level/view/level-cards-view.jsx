'use client';

import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { _levelCards } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { LevelCardList } from '../level-card-list';

// ----------------------------------------------------------------------

export function LevelCardsView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Cards"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Level', href: paths.dashboard.level.root },
          { name: 'Cards' },
        ]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.level.new}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            Add level
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <LevelCardList levels={_levelCards} />
    </DashboardContent>
  );
}
