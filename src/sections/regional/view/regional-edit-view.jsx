'use client';

import { useState, useEffect } from 'react';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { getRegionals } from 'src/services/regional-service';

import { RegionalCreateEditForm } from '../regional-create-edit-form';

// ----------------------------------------------------------------------

export function RegionalEditView({ id }) {
  const [currentRegional, setCurrentRegional] = useState(null);

  useEffect(() => {
    const load = async () => {
      const regionals = await getRegionals();
      const regional = (Array.isArray(regionals) ? regionals : []).find(
        (item) => String(item.id) === String(id)
      );

      setCurrentRegional(regional || null);
    };

    load();
  }, [id]);

  if (!currentRegional) return null;

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar"
        backHref={paths.dashboard.level.regional}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Región', href: paths.dashboard.level.regional.root },
          { name: currentRegional?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <RegionalCreateEditForm currentRegional={currentRegional} />
    </DashboardContent>
  );
}
