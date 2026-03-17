'use client';

import { removeLastSlash } from 'minimal-shared/utils';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useState } from 'react';
import { paths } from 'src/routes/paths';
import { usePathname, useParams } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { getDests } from 'src/services/dest-service';

import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

export function DestEditLayout({ children, ...other }) {
    console.log('DashboardContent props', other);

    const pathname = usePathname();
    const params = useParams();
    const destId = params?.id;

    const [dest, setDest] = useState(null);

    useEffect(() => {
        const found = getDests().find((d) => d.id === destId);
        setDest(found);
    }, [destId]);
    const destName = dest ? dest.name : 'Destacamento';

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
    );
}