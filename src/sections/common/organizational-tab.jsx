'use client';

import Tab from '@mui/material/Tab';

import { RouterLink } from 'src/routes/components';

// Cada pestaña de los niveles organizacionales usa navegación del App Router.
// Las rutas nuevas bajo `[id]/edit/` heredan el layout y loading del nivel; al
// agregarlas a su arreglo de navegación obtienen esta misma precarga. Quien usa
// este componente debe pasar `value` directamente: Tabs inspecciona las props
// de este wrapper antes de que React renderice el Tab interior.
export function OrganizationalTab({ tab, ...other }) {
  return (
    <Tab
      component={RouterLink}
      prefetch
      label={tab.label}
      icon={tab.icon}
      value={tab.href}
      href={tab.href}
      {...other}
    />
  );
}
