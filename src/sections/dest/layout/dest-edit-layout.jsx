'use client';


import { useState, useEffect } from 'react';

import Tabs from '@mui/material/Tabs';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { useParams, usePathname } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { CandadoDeAlcance } from 'src/sections/common/candado-de-alcance';
import { OrganizationalTab } from 'src/sections/common/organizational-tab';

// Los títulos descriptivos de listas anidadas incluyen el nombre del
// destacamento. Las pantallas generales no necesitan un encabezado "Editar".
export function DestEditLayout({ children, tituloPrefijo = '', ...other }) {

    const pathname = usePathname();
    const params = useParams();
    const destId = params?.id;
    const tituloPrefijoActual =
        tituloPrefijo || (pathname.endsWith('/members') ? 'Miembros Dest.' : '');

    const [dest, setDest] = useState(null);

    useEffect(() => {
        const load = async () => {
            const res = await fetch('/api/dest/');
            const data = await res.json();

            const found = (data?.data || []).find((d) => String(d.idDestacamento) === String(destId));
            setDest(found);
        };

        load();
    }, [destId]);

    const destName = dest ? dest.nombre : 'Destacamento';
    // El numero solo si lo tiene: un "Destacamento Tribu de Judá" a secas se lee
    // mejor que uno con un hueco al final.
    const destNumber = String(dest?.numero ?? dest?.destNumber ?? '').trim();
    const destNombreCompleto = [destName, destNumber].filter(Boolean).join(' ').trim();
    const titulo = [tituloPrefijoActual, destNombreCompleto].filter(Boolean).join(' ');

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const NAV_ITEMS = [
        {
            label: 'General',
            icon: <Iconify width={24} icon="solar:buildings-bold" />,
            href: paths.dashboard.level.dest.edit(destId),
        },
        {
            // LOS MIEMBROS, EN SU DESTACAMENTO. La lista general enseña los de
            // uno; a los de otro destacamento se llega por aqui, que es donde
            // esta dicho de quien son.
            label: 'Miembros',
            icon: <Iconify width={24} icon="solar:users-group-rounded-bold" />,
            href: `/dashboard/level/dest/${destId}/edit/members`,
        },
        {
            // "Local" la distingue de las otras tres: Nacion, Region y Seccion
            // tienen su propia Directiva y en el destacamento se llaman igual.
            label: 'Directiva Local',
            icon: <Iconify width={24} icon="solar:users-group-rounded-bold" />,
            href: `/dashboard/level/dest/${destId}/edit/leadership`,
        },
        {
            // El equipo que dirige el Lider de Grupo de cada division: continua
            // hacia abajo lo que la Directiva Local termina.
            label: 'Directiva Líderes Juveniles',
            icon: <Iconify width={24} icon="solar:users-group-two-rounded-bold" />,
            href: `/dashboard/level/dest/${destId}/edit/youth-leadership`,
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
        <DashboardContent {...other}>

            {tituloPrefijoActual && !isMobile && <CustomBreadcrumbs heading={titulo} sx={{ mb: 3 }} />}

            <Tabs value={pathname.replace(/\/$/, '')} sx={{ mb: { xs: 3, md: 5 } }}>                {NAV_ITEMS.map((tab) => (

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
