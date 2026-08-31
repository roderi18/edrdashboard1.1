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

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { CandadoDeAlcance } from 'src/sections/common/candado-de-alcance';

export function DestEditLayout({ children, ...other }) {

    const pathname = usePathname();
    const params = useParams();
    const destId = params?.id;

    const [dest, setDest] = useState(null);

    useEffect(() => {
        const load = async () => {
            const res = await fetch('/api/dest');
            const data = await res.json();

            const found = (data?.data || []).find((d) => String(d.idDestacamento) === String(destId));
            setDest(found);
        };

        load();
    }, [destId]);

    const destName = dest ? dest.nombre : 'Destacamento';

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const NAV_ITEMS = [
        {
            label: 'General',
            icon: <Iconify width={24} icon="solar:buildings-bold" />,
            href: paths.dashboard.level.dest.edit(destId),
        },
        {
            label: 'Directiva',
            icon: <Iconify width={24} icon="solar:users-group-rounded-bold" />,
            href: `/dashboard/level/dest/${destId}/edit/leadership`,
        },
    ];

    return (

      <CandadoDeAlcance

        tipo="destacamento"

        id={destId}

        titulo="Este destacamento no es el tuyo"

        volverA={paths.dashboard.level.dest.root}

        etiquetaVolver="Destacamentos"

      >

    return (
        <DashboardContent {...other}>

            <CustomBreadcrumbs
                heading={isMobile ? null : 'Editar destacamento'}
                links={[
                    { name: 'Panel', href: paths.dashboard.root },
                    { name: 'Destacamentos', href: paths.dashboard.level.dest.root },
                    { name: destName },
                ]}
                sx={{ mb: 3 }}
            />

            <Tabs value={pathname.replace(/\/$/, '')} sx={{ mb: { xs: 3, md: 5 } }}>                {NAV_ITEMS.map((tab) => (

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
