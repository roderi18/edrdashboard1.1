'use client';

import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { _regionalCards } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { RegionalCardList } from '../regional-card-list';

// ----------------------------------------------------------------------

export function RegionalCardsView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Cards"
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Región', href: paths.dashboard.level.regional.root },
          { name: 'Cards' },
        ]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.level.regional.new}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            Agregar regional
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <RegionalCardList regionals={_regionalCards} />
    </DashboardContent>
  );
}
