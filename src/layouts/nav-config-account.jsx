import { paths } from 'src/routes/paths';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export const _account = [
  { label: 'Inicio', href: '/', icon: <Iconify icon="solar:home-angle-bold-duotone" /> },
  {
    label: 'Perfil',
    href: paths.dashboard.user.account,
    icon: <Iconify icon="custom:profile-duotone" />,
  },
  {
    label: 'Proyectos',
    href: '#',
    icon: <Iconify icon="solar:notes-bold-duotone" />,
    info: '3',
    disabled: true,
  },
  {
    label: 'Suscripciones',
    href: '#',
    icon: <Iconify icon="custom:invoice-duotone" />,
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
