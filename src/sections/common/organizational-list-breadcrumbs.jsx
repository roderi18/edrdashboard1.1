'use client';

import { paths } from 'src/routes/paths';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// Una sola cabecera para las cinco listas organizacionales. Las etiquetas, las
// rutas y el separador viven aqui para que ningun nivel se vea distinto.
const NIVELES = {
  national: { label: 'Nacional', href: paths.dashboard.level.national.root },
  regional: { label: 'Región', href: paths.dashboard.level.regional.root },
  sectional: { label: 'Sección', href: paths.dashboard.level.sectional.root },
  dest: { label: 'Destacamentos', href: paths.dashboard.level.dest.root },
  member: { label: 'Miembros', href: paths.dashboard.level.member.root },
};

export function OrganizationalListBreadcrumbs({ nivel, slotProps = {}, ...other }) {
  const nivelActual = NIVELES[nivel];

  if (!nivelActual) {
    throw new Error(`Nivel organizacional no reconocido: ${nivel}`);
  }

  return (
    <CustomBreadcrumbs
      {...other}
      links={[
        { name: 'Panel', href: paths.dashboard.root },
        { name: nivelActual.label, href: nivelActual.href },
        { name: 'Lista' },
      ]}
      slotProps={{
        ...slotProps,
        breadcrumbs: { ...slotProps.breadcrumbs, separator: '•' },
      }}
    />
  );
}
