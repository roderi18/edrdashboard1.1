'use client';

import { useState, useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useParams, usePathname } from 'src/routes/hooks';

import { getDestsApi } from 'src/services/dest-service';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';

import { CandadoDeAlcance } from 'src/sections/common/candado-de-alcance';
import { OrganizationalProfileNavigation } from 'src/sections/common/organizational-profile-navigation';

// Los títulos descriptivos de listas anidadas incluyen el nombre del
// destacamento. Las pantallas generales no necesitan un encabezado "Editar".
export function DestEditLayout({ children, ...other }) {

    const pathname = usePathname();
    const params = useParams();
    const destId = params?.id;
    const [dest, setDest] = useState(null);

    useEffect(() => {
        let cancelado = false;

        // Por el servicio, no por `fetch` a pelo. El crudo no tenia try/catch:
        // un 500 o el corte por tiempo de la API dejaba el rechazo sin dueño y
        // el encabezado clavado en "Destacamento". `getDestsApi` ya reintenta
        // contra el espejo local y comparte cache con el resto de pantallas,
        // asi que la pestaña no vuelve a bajar el padron entero.
        const load = async () => {
            const dests = await getDestsApi({ includePhotos: false }).catch(() => []);

            if (cancelado) return;

            setDest(dests.find((d) => String(d?.id) === String(destId)) || null);
        };

        load();

        return () => {
            cancelado = true;
        };
    }, [destId]);

    const destName = dest ? dest.nombre || dest.name : 'Destacamento';
    // El numero solo si lo tiene: un "Destacamento Tribu de Judá" a secas se lee
    // mejor que uno con un hueco al final.
    const destNumber = String(dest?.numero ?? dest?.destNumber ?? '').trim();
    const destNombreCompleto = [destName, destNumber].filter(Boolean).join(' ').trim();
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

            <OrganizationalProfileNavigation
              heading={destNombreCompleto}
              nivel="Destacamentos"
              nivelHref={paths.dashboard.level.dest.root}
              tabs={NAV_ITEMS}
              value={pathname.replace(/\/$/, '')}
            />

            {children}

        </DashboardContent>
    
  </CandadoDeAlcance>
  );
}
