'use client';

import { useState, useEffect } from 'react';

import Tabs from '@mui/material/Tabs';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { useParams, usePathname } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';
import { getSectionalById } from 'src/services/sectional-service';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { CandadoDeAlcance } from 'src/sections/common/candado-de-alcance';
import { OrganizationalTab } from 'src/sections/common/organizational-tab';

// ----------------------------------------------------------------------

// Los títulos descriptivos de listas anidadas incluyen el nombre de la sección.
// Las pantallas generales no necesitan un encabezado "Editar".
export function SectionalEditLayout({ children, tituloPrefijo = '', ...other }) {
  const pathname = usePathname();
  const params = useParams();
  const sectionalId = params?.id;
  const tituloPrefijoActual =
    tituloPrefijo || (pathname.endsWith('/dests') ? 'Destacamentos de la Sección' : '');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [sectionalName, setSectionalName] = useState('Sección');

  useEffect(() => {
    const loadSectional = async () => {
      const sectional = await getSectionalById(sectionalId);
      setSectionalName(sectional?.sectionalName || 'Sección');
    };

    if (sectionalId) {
      loadSectional();
    }
  }, [sectionalId]);

  const titulo = [tituloPrefijoActual, sectionalName].filter(Boolean).join(' ');

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
      {tituloPrefijoActual && !isMobile && <CustomBreadcrumbs heading={titulo} sx={{ mb: 3 }} />}

      <Tabs value={currentPath} sx={{ mb: { xs: 3, md: 5 } }}>
        {navItems.map((tab) => (
          <OrganizationalTab
            key={tab.href}
            tab={tab}
          />
        ))}
      </Tabs>

      {children}
    </DashboardContent>
  
  </CandadoDeAlcance>
  );
}
