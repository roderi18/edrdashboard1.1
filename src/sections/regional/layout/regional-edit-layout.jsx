'use client';

import { useState, useEffect } from 'react';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import { useTheme } from '@mui/material/styles';
import AlertTitle from '@mui/material/AlertTitle';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useParams, usePathname } from 'src/routes/hooks';

import { getOwnRegionIdsForUser } from 'src/utils/member-access';
import { puedeEntrarALaRegion, puedeVerTodasLasRegiones } from 'src/utils/org-level-access';

import { getDestsApi } from 'src/services/dest-service';
import { DashboardContent } from 'src/layouts/dashboard';
import { getChurches } from 'src/services/church-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export function RegionalEditLayout({ children, ...other }) {
  const pathname = usePathname();
  const params = useParams();
  const { user } = useAuthContext();
  const regionalId = params?.id;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [regionalName, setRegionalName] = useState('Región');
  // A la region ajena no se entra ni con el enlace pegado. La lista ya la muestra
  // deshabilitada, pero eso solo tapa la puerta: esta es la puerta.
  //
  // `null` mientras se averigua, para no pintar ni la ficha ni el aviso antes de
  // saber cual de los dos toca. Quien las ve todas se resuelve en el acto; para
  // el resto hay que DERIVAR su region, que un cargo de destacamento no lleva en
  // el alcance —sale de su destacamento, su iglesia y su seccion—.
  const [puedeEntrar, setPuedeEntrar] = useState(() =>
    puedeVerTodasLasRegiones(user) ? true : null
  );

  useEffect(() => {
    if (puedeVerTodasLasRegiones(user)) {
      setPuedeEntrar(true);
      return undefined;
    }

    let cancelado = false;

    const averiguar = async () => {
      const [dests, churches, sectionals] = await Promise.all([
        getDestsApi({ includePhotos: false }).catch(() => []),
        getChurches().catch(() => []),
        getSectionals({ includePhotos: false }).catch(() => []),
      ]);

      if (cancelado) return;

      const ownRegionIds = getOwnRegionIdsForUser(user, { dests, churches, sectionals });

      setPuedeEntrar(puedeEntrarALaRegion(user, regionalId, { ownRegionIds }));
    };

    averiguar();

    return () => {
      cancelado = true;
    };
  }, [user, regionalId]);

  useEffect(() => {
    const loadRegional = async () => {
      const regionals = await getRegionals();
      const regional = (Array.isArray(regionals) ? regionals : []).find(
        (item) => String(item.id) === String(regionalId)
      );

      setRegionalName(regional?.name || 'Región');
    };

    if (regionalId) {
      loadRegional();
    }
  }, [regionalId]);

  const currentPath = pathname.replace(/\/$/, '');
  const editHref = paths.dashboard.level.regional.edit(regionalId);
  const leadershipHref = `/dashboard/level/regional/${regionalId}/edit/leadership`;

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

  // Mientras no se sabe no se pinta nada: pintar la ficha y quitarla despues
  // seria enseñar justo lo que no se puede ver.
  if (puedeEntrar === null) {
    return <DashboardContent {...other} />;
  }

  if (!puedeEntrar) {
    return (
      <DashboardContent {...other}>
        <CustomBreadcrumbs
          heading={isMobile ? null : 'Regiones'}
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Regiones', href: paths.dashboard.level.regional.root },
          ]}
          sx={{ mb: 3 }}
        />

        <Alert severity="info" sx={{ alignItems: 'center' }}>
          <AlertTitle>Esta región no es la tuya</AlertTitle>
          Puedes ver que existe en la lista de regiones, pero su ficha y su
          directiva solo las abre quien responde por ella.
        </Alert>
      </DashboardContent>
    );
  }

  return (
    <DashboardContent {...other}>
      <CustomBreadcrumbs
        heading={isMobile ? null : 'Editar región'}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Regiones', href: paths.dashboard.level.regional.root },
          { name: regionalName },
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
  );
}
