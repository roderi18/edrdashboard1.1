'use client';

import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { _sectionalCards } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { SectionalCardList } from '../sectional-card-list';

// ----------------------------------------------------------------------

export function SectionalCardsView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Cards"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sectional', href: paths.dashboard.level.sectional.root },
          { name: 'Cards' },
        ]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.level.sectional.new}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            Add sectional
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SectionalCardList sectionals={_sectionalCards} />
    </DashboardContent>
  );
}
