import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/global-config';

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
  certificate: icon('ic-certificate'),
  disabled: icon('ic-disabled'),
  external: icon('ic-external'),
  subpaths: icon('ic-subpaths'),
  menuItem: icon('ic-menu-item'),
  ecommerce: icon('ic-ecommerce'),
  analytics: icon('ic-analytics'),
  dashboard: icon('ic-dashboard'),
  designer: <Iconify width={24} icon="solar:paint-brush-bold-duotone" />,
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
 * - `marcaActiva`: función opcional `({ pathname, searchParams })` para las
 *   entradas que no se distinguen solo por la ruta.
 */

// EL PERFIL DE UN CUATRIENIO PASADO ES DEL CONSEJO NACIONAL, NO DE MIEMBROS.
//
// Vive bajo /level/member/<id>/edit porque reutiliza esa pantalla, pero no es la
// ficha de un miembro: es la instantanea de quien ocupo un cargo entonces. Al
// abrirlo desde el Consejo Nacional el menu saltaba a "Miembros" y se perdia de
// vista de donde venia. Lo delatan los dos parametros que ya miran la pagina y
// el layout del miembro.
const RUTA_MIEMBROS = paths.dashboard.level.member.list;
const RUTA_NACIONAL = paths.dashboard.level.national.list;

const dentroDe = (pathname, ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`);

const esPerfilDeCuatrienio = ({ pathname, searchParams }) =>
  dentroDe(pathname, RUTA_MIEMBROS) &&
  Boolean(searchParams?.get('cuatrienio') && searchParams?.get('integrante'));

const esDelConsejoNacional = (contexto) =>
  dentroDe(contexto.pathname, RUTA_NACIONAL) || esPerfilDeCuatrienio(contexto);

const esDeMiembros = (contexto) =>
  dentroDe(contexto.pathname, RUTA_MIEMBROS) && !esPerfilDeCuatrienio(contexto);

export const navData = [
  /**
   * EL MENU, POR LO QUE HACE LA GENTE.
   *
   * Antes eran dos bloques —"Principal" y "Management"— con veintitantas entradas
   * mezcladas: los modulos de la plantilla sin conectar (Ecommerce, Analytics,
   * Banking, Blog, Job, Tour) al lado de los reales, y las pantallas de demo
   * marcadas "- DEV" dentro de los desplegables de Tienda, Ordenes y Recibos.
   * Para llegar a la tienda habia que abrir "Tienda Virtual" y elegir "Lista".
   *
   * Ahora son seis grupos por AREA DE TRABAJO, y cada entrada lleva a la pantalla
   * de verdad en un solo clic. Lo de la plantilla se queda fuera: sigue en el
   * codigo y se llega por url, pero no ocupa sitio en el menu de nadie.
   */
  {
    subheader: 'Principal',
    items: [{ title: 'Inicio', path: paths.dashboard.principal, icon: ICONS.dashboard }],
  },
  {
    subheader: 'Organización',
    items: [
      {
        title: 'Niveles Organizacionales',
        path: paths.dashboard.level.root,
        icon: ICONS.user,
        activePaths: [
          paths.dashboard.level.national.list,
          paths.dashboard.level.regional.list,
          paths.dashboard.level.sectional.list,
          paths.dashboard.level.dest.list,
          paths.dashboard.level.member.list,
        ],
        children: [
          {
            title: 'Consejo Nacional',
            path: paths.dashboard.level.national.root,
            deepMatch: true,
            marcaActiva: esDelConsejoNacional,
          },
          { title: 'Regiones', path: paths.dashboard.level.regional.root, deepMatch: true },
          { title: 'Secciones', path: paths.dashboard.level.sectional.root, deepMatch: true },
          { title: 'Destacamentos', path: paths.dashboard.level.dest.root, deepMatch: true },
          {
            title: 'Miembros',
            path: paths.dashboard.level.member.root,
            deepMatch: true,
            marcaActiva: esDeMiembros,
          },
        ],
      },
      {
        title: 'Asistencias',
        path: paths.dashboard.level.attendance,
        icon: ICONS.calendar,
        deepMatch: true,
      },
    ],
  },
  {
    subheader: 'Tienda',
    items: [
      // Directo a la lista. El desplegable que habia encima solo servia para
      // ofrecer las pantallas de demo de la plantilla.
      {
        title: 'Tienda Virtual',
        path: paths.dashboard.product.root,
        icon: ICONS.product,
        deepMatch: true,
      },
      {
        title: 'Mi carrito',
        path: paths.dashboard.checkout,
        icon: ICONS.order,
        info: <CheckoutCartNavInfo />,
      },
    ],
  },
  {
    subheader: 'Formación',
    items: [
      { title: 'Certificados', path: paths.dashboard.certificates, icon: ICONS.certificate },
      { title: 'Documentos Ministeriales', path: paths.dashboard.fileManager, icon: ICONS.folder },
      // SIN DESTINO TODAVIA. Se deja a la vista porque el area existe y esta
      // decidida, pero deshabilitada: lo unico que hay hoy es el modulo `course`
      // de la plantilla, y mandar a la gente ahi seria ensenarle datos de mentira.
      {
        title: 'Capacitación',
        path: paths.dashboard.general.course,
        icon: ICONS.course,
        disabled: true,
        caption: 'Pendiente de pantalla propia',
      },
    ],
  },
  {
    subheader: 'Comunicación',
    items: [
      { title: 'Mail', path: paths.dashboard.mail, icon: ICONS.mail },
      { title: 'Chats', path: paths.dashboard.chat, icon: ICONS.chat },
    ],
  },
  {
    subheader: 'Planificación',
    items: [
      { title: 'Calendario actividades', path: paths.dashboard.calendar, icon: ICONS.calendar },
      { title: 'Flujo de trabajo', path: paths.dashboard.kanban, icon: ICONS.kanban },
    ],
  },
  {
    // NO ESTA EN LA MAQUETA, y se queda a proposito: es la unica via de menu a
    // /dashboard/admin. El propio layout de esa zona ya la cierra a la Oficina
    // Nacional y a los administradores global y funcional, asi que a quien no le
    // toca no le sirve de nada verla.
    subheader: 'Administración',
    items: [
      {
        title: 'Administradores',
        path: paths.dashboard.admin.root,
        icon: ICONS.lock,
        deepMatch: true,
      },
    ],
  },
];

// ----------------------------------------------------------------------
// LA TIENDA DE QUIEN LA ADMINISTRA.
//
// Al reorganizar el menu, "Tienda" se quedo en un enlace directo a la lista y
// Ordenes y Recibos bajaron al grupo de Desarrollo, al final de todo. Para quien
// administra la tienda entera eso lo dejaba sin la vista de pedidos y recibos
// donde la buscaba: debajo de "Tienda", como estaba antes.
//
// `layout.jsx` pone estas entradas en lugar de "Tienda Virtual" SOLO para el
// Administrador Global y el Administrador de Gestion de Tienda. El resto de los
// miembros sigue con su desplegable de cliente —Lista de productos, Mis ordenes,
// Mis recibos—, que arma el filtro del menu.
// ----------------------------------------------------------------------

export const tiendaDeAdministracion = [
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
    title: 'Órdenes',
    path: paths.dashboard.order.root,
    icon: ICONS.ecommerce,
    children: [
      { title: 'Lista', path: paths.dashboard.order.root },
      { title: 'Detalles', path: paths.dashboard.order.demo.details },
    ],
  },
  {
    title: 'Recibos',
    path: paths.dashboard.invoice.root,
    icon: ICONS.invoice,
    children: [
      { title: 'Lista', path: paths.dashboard.invoice.root },
      { title: 'Detalles', path: paths.dashboard.invoice.demo.details },
      { title: 'Crear', path: paths.dashboard.invoice.new },
      { title: 'Editar', path: paths.dashboard.invoice.demo.edit },
    ],
  },
];

// Pone la tienda de administracion en lugar de "Tienda Virtual", dentro del
// grupo "Tienda". Lo demas del grupo —"Mi carrito"— se queda donde esta.
// ----------------------------------------------------------------------
// EXPLORA DESIGNER, DEBAJO DE "ADMINISTRADORES".
//
// Cambia la portada de toda la organizacion, asi que en su primera version es
// solo del Administrador Global. No va dentro de las pestañas de Administracion
// —alli entran tambien la Oficina Nacional y el Administrador Funcional— sino
// como entrada propia del menu, justo debajo de "Administradores".
//
// `layout.jsx` la añade DESPUES del filtro del menu y solo para el Administrador
// Global, igual que la tienda de administracion: el filtro es una lista de
// permisos pensada para otras entradas y no tiene por que conocer esta.
// ----------------------------------------------------------------------

export const entradaEverestDesigner = {
  title: 'EXPLORA Designer',
  path: paths.dashboard.everest,
  icon: ICONS.designer,
};

export const conEverestDesigner = (secciones = []) =>
  secciones.map((seccion) =>
    seccion.subheader === 'Administración'
      ? {
        ...seccion,
        items: (seccion.items ?? []).flatMap((item) =>
          item.path === paths.dashboard.admin.root ? [item, entradaEverestDesigner] : [item]
        ),
      }
      : seccion
  );

export const conTiendaDeAdministracion = (secciones = []) =>
  secciones.map((seccion) =>
    seccion.subheader === 'Tienda'
      ? {
        ...seccion,
        items: (seccion.items ?? []).flatMap((item) =>
          item.path === paths.dashboard.product.root ? tiendaDeAdministracion : [item]
        ),
      }
      : seccion
  );

// ----------------------------------------------------------------------
// LO QUE SOLO VE EL ADMINISTRADOR GLOBAL.
//
// Al reorganizar el menu en seis grupos por area de trabajo, estas entradas se
// quedaron fuera: son los modulos de la plantilla sin conectar y las pantallas de
// demostracion marcadas "- DEV". Ocupaban sitio en el menu de todo el mundo para
// llevar a datos de mentira.
//
// Pero siguen siendo utiles para quien desarrolla y prueba, asi que vuelven aqui,
// en dos grupos aparte que `layout.jsx` añade SOLO cuando quien entra es el
// Administrador Global. Para el resto, el menu queda como esta arriba.
//
// Van al final del menu a proposito: lo de trabajar primero, lo de probar despues.
// ----------------------------------------------------------------------

export const navDataDesarrollo = [
  {
    subheader: 'Desarrollo · plantilla',
    items: [
      { title: 'Aplicación', path: paths.dashboard.root, icon: ICONS.dashboard },
      { title: 'Ecommerce', path: paths.dashboard.general.ecommerce, icon: ICONS.ecommerce },
      { title: 'Analytics', path: paths.dashboard.general.analytics, icon: ICONS.analytics },
      { title: 'Banking', path: paths.dashboard.general.banking, icon: ICONS.banking },
      {
        title: 'Booking',
        path: paths.dashboard.general.booking,
        icon: ICONS.booking,
        disabled: true,
      },
      { title: 'File', path: paths.dashboard.general.file, icon: ICONS.file },
      { title: 'Course', path: paths.dashboard.general.course, icon: ICONS.course },
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
      { title: 'Cartas', path: paths.dashboard.user.cards, icon: ICONS.user },
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
    ],
  },
];

// Ejemplos de la plantilla, comentados desde siempre. Se conservan como
// referencia de la forma que admite `navData` (permisos, hijos anidados,
// deshabilitados); no los lee nadie.
const EJEMPLOS_DE_LA_PLANTILLA = [
  /**
   * Item state
   */
  // {
  //   subheader: 'Misc',
  //   items: [
  //     // {
  //     /**
  //      * Permissions can be set for each item by using the `allowedRoles` property.
  //      * - If `allowedRoles` is not set (default), all roles can see the item.
  //      * - If `allowedRoles` is an empty array `[]`, no one can see the item.
  //      * - If `allowedRoles` contains specific roles, only those roles can see the item.
  //      *
  //      * Examples:
  //      * - `allowedRoles: ['user']` - only users with the 'user' role can see this item.
  //      * - `allowedRoles: ['admin']` - only users with the 'admin' role can see this item.
  //      * - `allowedRoles: ['admin', 'manager']` - only users with the 'admin' or 'manager' roles can see this item.
  //      *
  //      * Combine with the `checkPermissions` prop to build conditional expressions.
  //      * Example usage can be found in: src/sections/_examples/extra/navigation-bar-view/nav-vertical.{jsx | tsx}
  //      */
  //     //   title: 'Permisos - ejemplo',
  //     //   path: paths.dashboard.permission,
  //     //   icon: ICONS.lock,
  //     //   allowedRoles: ['admin', 'manager'],
  //     //   caption: 'Only admin can see this item.',
  //     // },
  //     // {
  //     //   title: 'Ejemplo children npm run dev',
  //     //   path: '#/dashboard/menu-level',
  //     //   icon: ICONS.menuItem,
  //     //   children: [
  //     //     {
  //     //       title: 'Level 1a',
  //     //       path: '#/dashboard/menu-level/1a',
  //     //       children: [
  //     //         { title: 'Level 2a', path: '#/dashboard/menu-level/1a/2a' },
  //     //         {
  //     //           title: 'Level 2b',
  //     //           path: '#/dashboard/menu-level/1a/2b',
  //     //           children: [
  //     //             {
  //     //               title: 'Level 3a',
  //     //               path: '#/dashboard/menu-level/1a/2b/3a',
  //     //             },
  //     //             {
  //     //               title: 'Level 3b',
  //     //               path: '#/dashboard/menu-level/1a/2b/3b',
  //     //             },
  //     //           ],
  //     //         },
  //     //       ],
  //     //     },
  //     //     { title: 'Level 1b', path: '#/dashboard/menu-level/1b' },
  //     //   ],
  //     // },
  //     // {
  //     //   title: 'Deshabilitado',
  //     //   path: '#disabled',
  //     //   icon: ICONS.disabled,
  //     //   disabled: true,
  //     // },
  //     // {
  //     //   title: 'Label',
  //     //   path: '#label',
  //     //   icon: ICONS.label,
  //     //   info: (
  //     //     <Label
  //     //       color="info"
  //     //       variant="inverted"
  //     //       startIcon={<Iconify icon="solar:bell-bing-bold-duotone" />}
  //     //     >
  //     //       NEW
  //     //     </Label>
  //     //   ),
  //     // },
  //     // {
  //     //   title: 'Caption',
  //     //   path: '#caption',
  //     //   icon: ICONS.menuItem,
  //     //   caption:
  //     //     'Quisque malesuada placerat nisl. In hac habitasse platea dictumst. Cras id dui. Pellentesque commodo eros a enim. Morbi mollis tellus ac sapien.',
  //     // },
  //     // {
  //     //   title: 'Params',
  //     //   path: '/dashboard/params?id=e99f09a7-dd88-49d5-b1c8-1daf80c2d7b1',
  //     //   icon: ICONS.params,
  //     // },
  //     // {
  //     //   title: 'Subpaths',
  //     //   path: '/dashboard/subpaths',
  //     //   icon: ICONS.subpaths,
  //     //   deepMatch: true,
  //     // },
  //     // {
  //     //   title: 'Enlaces externos',
  //     //   path: 'https://www.google.com/',
  //     //   icon: ICONS.external,
  //     //   info: <Iconify width={18} icon="eva:external-link-fill" />,
  //     // },
  //     // { title: 'Página blanco', path: paths.dashboard.blank, icon: ICONS.blank },
  //   ],
  // },
];
