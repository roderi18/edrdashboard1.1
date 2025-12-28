'use client';

import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { _nationalCards } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { NationalCardList } from '../national-card-list';

// ----------------------------------------------------------------------

export function NationalCardsView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Cards"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'National', href: paths.dashboard.level.national.root },
          { name: 'Cards' },
        ]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.level.national.new}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            Agregar nacional
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <NationalCardList nationals={_nationalCards} />
    </DashboardContent>
  );
}
