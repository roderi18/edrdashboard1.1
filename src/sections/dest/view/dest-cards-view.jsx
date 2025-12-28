'use client';

import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { _destCards } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { DestCardList } from '../dest-card-list';

// ----------------------------------------------------------------------

export function DestCardsView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Cards"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Dest', href: paths.dashboard.level.dest.root },
          { name: 'Cards' },
        ]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.level.dest.new}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            Agregar Destacamento
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <DestCardList dests={_destCards} />
    </DashboardContent>
  );
}
