'use client';

import { useEffect, useState } from 'react';
import { paths } from 'src/routes/paths';
import { DashboardContent } from 'src/layouts/dashboard';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { SectionalCreateEditForm } from '../sectional-create-edit-form';
import { getSectionalById } from 'src/services/sectional-service';

// ----------------------------------------------------------------------

export function SectionalEditView({ sectionalId }) {
  const [currentSectional, setCurrentSectional] = useState(null);

  useEffect(() => {
    const data = getSectionalById(sectionalId);
    console.log('CLIENT SECTIONAL 👉', data);
    setCurrentSectional(data);
  }, [sectionalId]);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar"
        backHref={paths.dashboard.level.sectional}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Seccional', href: paths.dashboard.level.sectional.root },
          { name: currentSectional?.sectionalName },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SectionalCreateEditForm currentSectional={currentSectional} />
    </DashboardContent>
  );
}