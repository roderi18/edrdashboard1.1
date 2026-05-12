import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/global-config';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export const navData = [
  { title: 'Inicio', path: '/', icon: <Iconify width={22} icon="solar:home-angle-bold-duotone" /> },
  {
    title: 'Componentes',
    path: paths.components,
    icon: <Iconify width={22} icon="solar:atom-bold-duotone" />,
  },
  {
    title: 'Páginas',
    path: '/pages',
    icon: <Iconify width={22} icon="solar:file-bold-duotone" />,
    children: [
      {
        subheader: 'Otras',
        items: [
          { title: 'Sobre nosotros', path: paths.about },
          { title: 'Contacto', path: paths.contact },
          { title: 'Preguntas frecuentes', path: paths.faqs },
          { title: 'Precios', path: paths.pricing },
          { title: 'Pago', path: paths.payment },
          { title: 'Mantenimiento', path: paths.maintenance },
          { title: 'Próximamente', path: paths.comingSoon },
        ],
      },
      {
        subheader: 'Conceptos',
        items: [
          { title: 'Tienda', path: paths.product.root },
          { title: 'Producto', path: paths.product.demo.details },
          { title: 'Checkout', path: paths.product.checkout },
          { title: 'Posts', path: paths.post.root },
          { title: 'Post', path: paths.post.demo.details },
        ],
      },
      {
        subheader: 'Autenticación',
        items: [
          { title: 'Iniciar sesión', path: paths.authDemo.split.signIn },
          { title: 'Registrarse', path: paths.authDemo.split.signUp },
          { title: 'Restablecer contraseña', path: paths.authDemo.split.resetPassword },
          { title: 'Actualizar contraseña', path: paths.authDemo.split.updatePassword },
          { title: 'Verify', path: paths.authDemo.split.verify },
          { title: 'Iniciar sesión centrado', path: paths.authDemo.centered.signIn },
          { title: 'Registrarse centrado', path: paths.authDemo.centered.signUp },
          { title: 'Restablecer contraseña centrado', path: paths.authDemo.centered.resetPassword },
          { title: 'Actualizar contraseña centrado', path: paths.authDemo.centered.updatePassword },
          { title: 'Verificar centrado', path: paths.authDemo.centered.verify },
        ],
      },
      {
        subheader: 'Error',
        items: [
          { title: 'Página 403', path: paths.page403 },
          { title: 'Página 404', path: paths.page404 },
          { title: 'Página 500', path: paths.page500 },
        ],
      },
      { subheader: 'Panel', items: [{ title: 'Panel', path: CONFIG.auth.redirectPath }] },
    ],
  },
  {
    title: 'Documentación',
    icon: <Iconify width={22} icon="solar:notebook-bold-duotone" />,
    path: paths.docs,
  },
];
