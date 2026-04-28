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
  },
  {
    label: 'Suscripciones',
    href: '#',
    icon: <Iconify icon="custom:invoice-duotone" />,
  },
  { label: 'Seguridad', href: '#', icon: <Iconify icon="solar:shield-keyhole-bold-duotone" /> },
  { label: 'Configuración', href: '#', icon: <Iconify icon="solar:settings-bold-duotone" /> },
];
