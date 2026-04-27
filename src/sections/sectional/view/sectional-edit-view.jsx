'use client';

import { useState, useEffect } from 'react';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { getSectionalById } from 'src/services/sectional-service';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { SectionalCreateEditForm } from '../sectional-create-edit-form';

// ----------------------------------------------------------------------

export function SectionalEditView({ sectionalId }) {
  const [currentSectional, setCurrentSectional] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [data, churches, members, destsResponse] = await Promise.all([
        getSectionalById(sectionalId),
        getChurches(),
        getMembers(),
        fetch('/api/dest').then((res) => res.json()),
      ]);

      const dests = destsResponse?.Data || [];
      const sectionId = Number(data?.idSeccion || data?.id || sectionalId);

      const iglesiasDeSeccion = churches.filter(
        (church) => Number(church.idSeccion) === sectionId
      );

      const destacamentosDeSeccion = dests.filter((dest) =>
        iglesiasDeSeccion.some((church) => Number(church.id) === Number(dest.idIglesia))
      );

      const miembrosDeSeccion = members.filter(
        (member) =>
          member.idDestacamento !== null &&
          destacamentosDeSeccion.some(
            (dest) => Number(dest.idDestacamento) === Number(member.idDestacamento)
          )
      );

      setCurrentSectional(
        data
          ? {
              ...data,
              sectionalDestCount: destacamentosDeSeccion.length,
              sectionalXDestMemberCount: miembrosDeSeccion.length,
            }
          : null
      );
    };

    load();
  }, [sectionalId]);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar"
        backHref={paths.dashboard.level.sectional}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Sección', href: paths.dashboard.level.sectional.root },
          { name: currentSectional?.sectionalName },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SectionalCreateEditForm currentSectional={currentSectional} />
    </DashboardContent>
  );
}
