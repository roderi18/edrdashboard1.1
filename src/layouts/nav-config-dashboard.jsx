import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/global-config';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { SvgColor } from 'src/components/svg-color';

import { CheckoutCartNavInfo } from './components/checkout-cart-nav-info';

// ----------------------------------------------------------------------

const icon = (name) => <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/${name}.svg`} />;

const ICONS = {
  job: icon('ic-job'),
  blog: icon('ic-blog'),
  chat: icon('ic-chat'),
  mail: icon('ic-mail'),
  user: icon('ic-user'),
  file: icon('ic-file'),
  lock: icon('ic-lock'),
  tour: icon('ic-tour'),
  order: icon('ic-order'),
  label: icon('ic-label'),
  blank: icon('ic-blank'),
  kanban: icon('ic-kanban'),
  folder: icon('ic-folder'),
  course: icon('ic-course'),
  params: icon('ic-params'),
  banking: icon('ic-banking'),
  booking: icon('ic-booking'),
  invoice: icon('ic-invoice'),
  product: icon('ic-product'),
  calendar: icon('ic-calendar'),
  disabled: icon('ic-disabled'),
  external: icon('ic-external'),
  subpaths: icon('ic-subpaths'),
  menuItem: icon('ic-menu-item'),
  ecommerce: icon('ic-ecommerce'),
  analytics: icon('ic-analytics'),
  dashboard: icon('ic-dashboard'),
};

// ----------------------------------------------------------------------

/**
 * Input nav data is an array of navigation section items used to define the structure and content of a navigation bar.
 * Each section contains a subheader and an array of items, which can include nested children items.
 *
 * Each item can have the following properties:
 * - `title`: The title of the navigation item.
 * - `path`: The URL path the item links to.
 * - `icon`: An optional icon component to display alongside the title.
 * - `info`: Optional additional information to display, such as a label.
 * - `allowedRoles`: An optional array of roles that are allowed to see the item.
 * - `caption`: An optional caption to display below the title.
 * - `children`: An optional array of nested navigation items.
 * - `disabled`: An optional boolean to disable the item.
 * - `deepMatch`: An optional boolean to indicate if the item should match subpaths.
 */
export const navData = [
  /**
   * Overview
   */
  {
    subheader: 'Overview',
    items: [
      { title: 'Aplicación', path: paths.dashboard.root, icon: ICONS.dashboard },
      { title: 'Ecommerce', path: paths.dashboard.general.ecommerce, icon: ICONS.ecommerce },
      { title: 'Analytics', path: paths.dashboard.general.analytics, icon: ICONS.analytics },
      { title: 'Banking', path: paths.dashboard.general.banking, icon: ICONS.banking },
      { title: 'Booking', path: paths.dashboard.general.booking, icon: ICONS.booking },
      { title: 'File', path: paths.dashboard.general.file, icon: ICONS.file },
      { title: 'Course', path: paths.dashboard.general.course, icon: ICONS.course },
    ],
  },
  /**
   * Management
   */
  {
    subheader: 'Management',
    items: [
      {
        title: 'Usuario - desarrollo',
        path: paths.dashboard.user.root,
        icon: ICONS.user,
        children: [
          { title: 'Perfil', path: paths.dashboard.user.root },
          { title: 'Cartas', path: paths.dashboard.user.cards },
          { title: 'Lista', path: paths.dashboard.user.list },
          { title: 'Crear', path: paths.dashboard.user.new },
          { title: 'Editar', path: paths.dashboard.user.demo.edit },
          { title: 'Cuenta', path: paths.dashboard.user.account, deepMatch: true },
        ],
      },
      /* rp */
      {
        title: 'Niveles',
        path: paths.dashboard.level.root,
        icon: ICONS.user,
        deepMatch: true,
        children: [
          // { title: 'Profile', path: paths.dashboard.level.profile },
          {
            title: 'Consejo Nacional',
            path: paths.dashboard.level.national.root,
            deepMatch: true,
          },
          {
            title: 'Regiones',
            path: paths.dashboard.level.regional.root,
            deepMatch: true,
          },
          {
            title: 'Secciones',
            path: paths.dashboard.level.sectional.root,
            deepMatch: true,
          },
          {
            title: 'Destacamentos',
            path: paths.dashboard.level.dest.root,
            deepMatch: true,
          },
          {
            title: 'Miembros',
            path: paths.dashboard.level.member.root,
            deepMatch: true,
          },
        ],
      },
      {
        title: 'Tienda Virtual',
        path: paths.dashboard.product.root,
        icon: ICONS.product,
        children: [
          { title: 'Lista', path: paths.dashboard.product.root },
          { title: 'Detalles', path: paths.dashboard.product.demo.details },
          { title: 'Crear', path: paths.dashboard.product.new },
          { title: 'Editar', path: paths.dashboard.product.demo.edit },
        ],
      },
      {
        title: 'Ordenes - DEV',
        path: paths.dashboard.order.root,
        icon: ICONS.ecommerce,
        children: [
          { title: 'Lista', path: paths.dashboard.order.root },
          { title: 'Detalles', path: paths.dashboard.order.demo.details },
        ],
      },
      {
        title: 'Recibos - DEV',
        path: paths.dashboard.invoice.root,
        icon: ICONS.invoice,
        children: [
          { title: 'Lista', path: paths.dashboard.invoice.root },
          { title: 'Detalles', path: paths.dashboard.invoice.demo.details },
          { title: 'Crear', path: paths.dashboard.invoice.new },
          { title: 'Editar', path: paths.dashboard.invoice.demo.edit },
        ],
      },
      {
        title: 'Mi carrito',
        path: paths.dashboard.checkout,
        icon: ICONS.order,
        info: <CheckoutCartNavInfo />,
      },
      {
        title: 'Administradores',
        path: paths.dashboard.admin.root,
        icon: ICONS.lock,
      },
      {
        title: 'Blog',
        path: paths.dashboard.post.root,
        icon: ICONS.blog,
        children: [
          { title: 'Lista', path: paths.dashboard.post.root },
          { title: 'Detalles', path: paths.dashboard.post.demo.details },
          { title: 'Crear', path: paths.dashboard.post.new },
          { title: 'Editar', path: paths.dashboard.post.demo.edit },
        ],
      },
      {
        title: 'Job',
        path: paths.dashboard.job.root,
        icon: ICONS.job,
        children: [
          { title: 'Lista', path: paths.dashboard.job.root },
          { title: 'Detalles', path: paths.dashboard.job.demo.details },
          { title: 'Crear', path: paths.dashboard.job.new },
          { title: 'Editar', path: paths.dashboard.job.demo.edit },
        ],
      },
      {
        title: 'Tour',
        path: paths.dashboard.tour.root,
        icon: ICONS.tour,
        children: [
          { title: 'Lista', path: paths.dashboard.tour.root },
          { title: 'Detalles', path: paths.dashboard.tour.demo.details },
          { title: 'Crear', path: paths.dashboard.tour.new },
          { title: 'Editar', path: paths.dashboard.tour.demo.edit },
        ],
      },
      { title: 'Documentos Ministeriales', path: paths.dashboard.fileManager, icon: ICONS.folder },
      {
        title: 'Mail',
        path: paths.dashboard.mail,
        icon: ICONS.mail,
        info: (
          <Label color="error" variant="inverted">
            +32
          </Label>
        ),
      },
      { title: 'Chats', path: paths.dashboard.chat, icon: ICONS.chat },
      { title: 'Calendario actividades', path: paths.dashboard.calendar, icon: ICONS.calendar },
      { title: 'Flujo de trabajo', path: paths.dashboard.kanban, icon: ICONS.kanban },
    ],
  },
  /**
   * Item state
   */
  {
    subheader: 'Misc',
    items: [
      {
        /**
         * Permissions can be set for each item by using the `allowedRoles` property.
         * - If `allowedRoles` is not set (default), all roles can see the item.
         * - If `allowedRoles` is an empty array `[]`, no one can see the item.
         * - If `allowedRoles` contains specific roles, only those roles can see the item.
         *
         * Examples:
         * - `allowedRoles: ['user']` - only users with the 'user' role can see this item.
         * - `allowedRoles: ['admin']` - only users with the 'admin' role can see this item.
         * - `allowedRoles: ['admin', 'manager']` - only users with the 'admin' or 'manager' roles can see this item.
         *
         * Combine with the `checkPermissions` prop to build conditional expressions.
         * Example usage can be found in: src/sections/_examples/extra/navigation-bar-view/nav-vertical.{jsx | tsx}
         */
        title: 'Permisos - ejemplo',
        path: paths.dashboard.permission,
        icon: ICONS.lock,
        allowedRoles: ['admin', 'manager'],
        caption: 'Only admin can see this item.',
      },
      {
        title: 'Ejemplo children niveles',
        path: '#/dashboard/menu-level',
        icon: ICONS.menuItem,
        children: [
          {
            title: 'Level 1a',
            path: '#/dashboard/menu-level/1a',
            children: [
              { title: 'Level 2a', path: '#/dashboard/menu-level/1a/2a' },
              {
                title: 'Level 2b',
                path: '#/dashboard/menu-level/1a/2b',
                children: [
                  {
                    title: 'Level 3a',
                    path: '#/dashboard/menu-level/1a/2b/3a',
                  },
                  {
                    title: 'Level 3b',
                    path: '#/dashboard/menu-level/1a/2b/3b',
                  },
                ],
              },
            ],
          },
          { title: 'Level 1b', path: '#/dashboard/menu-level/1b' },
        ],
      },
      {
        title: 'Deshabilitado',
        path: '#disabled',
        icon: ICONS.disabled,
        disabled: true,
      },
      {
        title: 'Label',
        path: '#label',
        icon: ICONS.label,
        info: (
          <Label
            color="info"
            variant="inverted"
            startIcon={<Iconify icon="solar:bell-bing-bold-duotone" />}
          >
            NEW
          </Label>
        ),
      },
      {
        title: 'Caption',
        path: '#caption',
        icon: ICONS.menuItem,
        caption:
          'Quisque malesuada placerat nisl. In hac habitasse platea dictumst. Cras id dui. Pellentesque commodo eros a enim. Morbi mollis tellus ac sapien.',
      },
      {
        title: 'Params',
        path: '/dashboard/params?id=e99f09a7-dd88-49d5-b1c8-1daf80c2d7b1',
        icon: ICONS.params,
      },
      {
        title: 'Subpaths',
        path: '/dashboard/subpaths',
        icon: ICONS.subpaths,
        deepMatch: true,
      },
      {
        title: 'Enlaces externos',
        path: 'https://www.google.com/',
        icon: ICONS.external,
        info: <Iconify width={18} icon="eva:external-link-fill" />,
      },
      { title: 'Página blanco', path: paths.dashboard.blank, icon: ICONS.blank },
    ],
  },
];
