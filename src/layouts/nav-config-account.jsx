import { paths } from 'src/routes/paths';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export const _account = [
  { label: 'Inicio', href: '/', icon: <Iconify icon="solar:home-angle-bold-duotone" /> },
  // "Mi cuenta" son los datos y la seguridad; "Mi perfil", la pagina que ven los
  // demas. Antes solo estaba "Perfil", que llevaba a la cuenta: el nombre no
  // decia adonde iba, y el perfil de verdad solo se alcanzaba desde el grupo
  // "Mi usuario" del menu izquierdo, que ya no existe.
  {
    label: 'Mi cuenta',
    href: paths.dashboard.user.account,
    icon: <Iconify icon="custom:profile-duotone" />,
  },
  {
    label: 'Mi perfil',
    href: paths.dashboard.user.root,
    icon: <Iconify icon="solar:user-id-bold" />,
  },
  {
    label: 'Proyectos',
    href: '#',
    icon: <Iconify icon="solar:notes-bold-duotone" />,
    info: '3',
    disabled: true,
  },
  {
    label: 'Seguridad',
    href: `${paths.dashboard.user.account}/change-password`,
    icon: <Iconify icon="solar:shield-keyhole-bold-duotone" />,
  },
  {
    label: 'Configuración',
    href: paths.dashboard.user.accountSettings,
    icon: <Iconify icon="solar:settings-bold-duotone" />,
    disabled: true,
  },
];
