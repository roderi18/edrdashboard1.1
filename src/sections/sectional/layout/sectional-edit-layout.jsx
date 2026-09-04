'use client';

import { useState, useEffect } from 'react';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useParams, usePathname } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';
import { getSectionalById } from 'src/services/sectional-service';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { CandadoDeAlcance } from 'src/sections/common/candado-de-alcance';

// ----------------------------------------------------------------------

export function SectionalEditLayout({ children, ...other }) {
  const pathname = usePathname();
  const params = useParams();
  const sectionalId = params?.id;
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

  const currentPath = pathname.replace(/\/$/, '');
  const editHref = paths.dashboard.level.sectional.edit(sectionalId);
  const leadershipHref = `/dashboard/level/sectional/${sectionalId}/edit/leadership`;

  const navItems = [
    {
      label: 'General',
      icon: <Iconify width={24} icon="solar:buildings-bold" />,
      href: editHref,
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
      <CustomBreadcrumbs
        heading={isMobile ? null : 'Editar sección'}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Secciones', href: paths.dashboard.level.sectional.root },
          { name: sectionalName },
        ]}
        sx={{ mb: 3 }}
      />

      <Tabs value={currentPath} sx={{ mb: { xs: 3, md: 5 } }}>
        {navItems.map((tab) => (
          <Tab
            component={RouterLink}
            key={tab.href}
            label={tab.label}
            icon={tab.icon}
            value={tab.href}
            href={tab.href}
          />
        ))}
      </Tabs>

      {children}
    </DashboardContent>
  
  </CandadoDeAlcance>
  );
}
