'use client';

import { useState, useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useParams, usePathname } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';
import { getSectionalById } from 'src/services/sectional-service';

import { Iconify } from 'src/components/iconify';

import { CandadoDeAlcance } from 'src/sections/common/candado-de-alcance';
import { OrganizationalProfileNavigation } from 'src/sections/common/organizational-profile-navigation';

// ----------------------------------------------------------------------

// Los títulos descriptivos de listas anidadas incluyen el nombre de la sección.
// Las pantallas generales no necesitan un encabezado "Editar".
export function SectionalEditLayout({ children, ...other }) {
  const pathname = usePathname();
  const params = useParams();
  const sectionalId = params?.id;
  const [sectionalName, setSectionalName] = useState('Sección');

  useEffect(() => {
    let cancelado = false;

    // Con cancelacion y captura: al saltar de una seccion a otra la respuesta
    // lenta de la anterior pisaba el nombre nuevo, y un fallo de la API dejaba
    // el rechazo sin dueño.
    const loadSectional = async () => {
      const sectional = await getSectionalById(sectionalId).catch(() => null);

      if (cancelado) return;

      setSectionalName(sectional?.sectionalName || 'Sección');
    };

    if (sectionalId) {
      loadSectional();
    }

    return () => {
      cancelado = true;
    };
  }, [sectionalId]);

  const currentPath = pathname.replace(/\/$/, '');
  const editHref = paths.dashboard.level.sectional.edit(sectionalId);
  const leadershipHref = `/dashboard/level/sectional/${sectionalId}/edit/leadership`;
  const destsHref = `/dashboard/level/sectional/${sectionalId}/edit/dests`;

  const navItems = [
    {
      label: 'General',
      icon: <Iconify width={24} icon="solar:buildings-bold" />,
      href: editHref,
    },
    {
      // LOS DESTACAMENTOS, EN SU SECCION. Es donde esta dicho de quien son, igual
      // que los miembros lo estan en su destacamento.
      label: 'Destacamentos',
      icon: <Iconify width={24} icon="solar:buildings-3-bold" />,
      href: destsHref,
    },
    {
      label: 'Directiva',
      icon: <Iconify width={24} icon="solar:users-group-rounded-bold" />,
      href: leadershipHref,
    },
  ];

  return (

    <CandadoDeAlcance

      tipo="seccion"

      id={sectionalId}

      titulo="Esta sección no es la tuya"

      volverA={paths.dashboard.level.sectional.root}

      etiquetaVolver="Secciones"

    >
    <DashboardContent {...other}>
      <OrganizationalProfileNavigation
        heading={sectionalName}
        nivel="Secciones"
        nivelHref={paths.dashboard.level.sectional.root}
        tabs={navItems}
        value={currentPath}
      />

      {children}
    </DashboardContent>
  
  </CandadoDeAlcance>
  );
}
