'use client';

import { merge } from 'es-toolkit';
import { useBoolean } from 'minimal-shared/hooks';
import { useRef, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { iconButtonClasses } from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { usePathname, useSearchParams } from 'src/routes/hooks';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { sonarAviso } from 'src/utils/sonidos-de-aviso.mjs';
import { getMemberFullName } from 'src/utils/get-member-fullname';
import { setModuloActivo, moduloDesdeRuta } from 'src/utils/modulo-activo';
import { canManageStoreProducts, filterDashboardNavDataByUser } from 'src/utils/member-access';

import { _notifications } from 'src/_mock';
import { useGetLabels } from 'src/actions/mail';
import { getMembers } from 'src/services/member-service';
import { useCargarSonidosDeAviso } from 'src/actions/sonidos';
import { useGetDashboardChatSummary } from 'src/actions/chat-summary';
import {
  marcarNotificacionComoLeida,
  marcarNotificacionComoAtendida,
  escucharNotificacionesDelUsuario,
  listarNotificacionesDrawerParaUsuario,
  marcarNotificacionesComoLeidasPorUsuario,
} from 'src/services/notification-service';

import { Logo } from 'src/components/logo';
import { Label } from 'src/components/label';
import { useSettingsContext } from 'src/components/settings';

import { buzonesQueAtiende } from 'src/sections/chat/utils/buzones-del-chat';

import { useAuthContext } from 'src/auth/hooks';
import { puedeUsarSelectorDeRol } from 'src/auth/permissions/admin-role-switch-policy';

import { NavMobile } from './nav-mobile';
import { VerticalDivider } from './content';
import { NavVertical } from './nav-vertical';
import { NavHorizontal } from './nav-horizontal';
import { _account } from '../nav-config-account';
import { Searchbar } from '../components/searchbar';
import { MobileQuickNav } from './mobile-quick-nav';
import { _workspaces } from '../nav-config-workspace';
import { MenuButton } from '../components/menu-button';
import { AccountDrawer } from '../components/account-drawer';
import { SettingsButton } from '../components/settings-button';
import { ContactsPopover } from '../components/contacts-popover';
import { WorkspacesPopover } from '../components/workspaces-popover';
import { dashboardLayoutVars, dashboardNavColorVars } from './css-vars';
import { NotificationsDrawer } from '../components/notifications-drawer';
import { RoleCombinationPopover } from '../components/role-combination-popover';
import { SesionComoUsuarioBanner } from '../components/sesion-como-usuario-banner';
import { ProbarComoUsuarioDialog } from '../components/probar-como-usuario-dialog';
import { MainSection, layoutClasses, HeaderSection, LayoutSection } from '../core';
import {
  navDataDesarrollo,
  conEverestDesigner,
  conTiendaDeAdministracion,
  navData as dashboardNavData,
} from '../nav-config-dashboard';

// ----------------------------------------------------------------------

const agregarIndicadoresMensajes = (
  sections = [],
  { chatUnreadCount = 0, mailUnreadCount = 0 } = {}
) =>
  sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.title === 'Mail') {
        return {
          ...item,
          info: mailUnreadCount ? (
            <Label color="error" variant="filled">
              {mailUnreadCount > 99 ? '99+' : mailUnreadCount}
            </Label>
          ) : null,
        };
      }

      if (item.title !== 'Chats') {
        return item;
      }

      return {
        ...item,
        info: chatUnreadCount ? (
          <Label color="error" variant="filled">
            {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
          </Label>
        ) : null,
      };
    }),
  }));

const LOCAL_REPORT_NOTIFICATIONS_KEY = 'dashboard_post_report_notifications';
const MOBILE_QUICK_NAV_COLLAPSE_ROUTES = [paths.dashboard.chat];

const obtenerNotificacionesReportesLocales = () => {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_REPORT_NOTIFICATIONS_KEY) || '[]');
  } catch (error) {
    console.error('[notifications] no se pudieron leer los reportes locales', error);
    return [];
  }
};

export function DashboardLayout({ sx, cssVars, children, slotProps, layoutQuery = 'lg' }) {
  const theme = useTheme();
  const pathname = usePathname();

  // QUE MODULO SE ESTA MIRANDO, para que los guardas de acceso sepan cual de sus
  // cargos manda aqui (ver `modulo-activo`). Se apunta durante el render y no en
  // un efecto a proposito: los hijos preguntan por sus permisos mientras se
  // pintan, y con un efecto llegaria tarde por un render entero.
  setModuloActivo(moduloDesdeRuta(pathname));

  const searchParams = useSearchParams();
  const isChatRoute = pathname?.startsWith(paths.dashboard.chat);
  const isMailRoute = pathname?.startsWith(paths.dashboard.mail);

  const { user } = useAuthContext();
  const [contactosDelDestacamento, setContactosDelDestacamento] = useState([]);
  const [cargaSecundariaLista, setCargaSecundariaLista] = useState(false);
  // La cuenta administrativa de siempre (admin001) llega con `role: 'admin'`;
  // una sesion que es administrativa por ocupar un cargo, no.
  const esAdministradorGlobal =
    isAdminGlobal(user) ||
    String(user?.role ?? user?.rol ?? '')
      .trim()
      .toLowerCase() === 'admin';
  // Prueba de dos cargos en curso: la enciende el Administrador Global y, hasta
  // que la apague, esta sesion ejerce esa pareja y no la suya.
  const pruebaDeRolesActiva = Boolean(user?.simulacion?.activa);
  const { labels: mailLabels } = useGetLabels(isMailRoute);
  const chatMemberId = Number(user?.idMiembros ?? user?.memberId ?? 0) || null;
  const chatSummaryEnabled = Boolean(
    cargaSecundariaLista && user?.accessToken && chatMemberId
  );

  // El primer pintado solo necesita la sesión y la estructura del panel. Los
  // contadores, contactos, notificaciones y sonidos esperan a que el navegador
  // quede libre para no competir con el JS y CSS iniciales.
  useEffect(() => {
    let activo = true;
    const iniciarCargaSecundaria = () => {
      if (activo) setCargaSecundariaLista(true);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(iniciarCargaSecundaria, { timeout: 2200 });
      return () => {
        activo = false;
        window.cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(iniciarCargaSecundaria, 1800);
    return () => {
      activo = false;
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (!cargaSecundariaLista) return undefined;

    let vigente = true;

    const cargarContactos = async () => {
      try {
        const miembros = await getMembers();
        if (!vigente) return;

        const idMiembroActual = String(user?.idMiembros ?? user?.memberId ?? user?.id ?? '');
        const miembroActual = miembros.find((miembro) =>
          [miembro?.id, miembro?.idMiembros, miembro?.memberId, miembro?.codigoMiembro].some(
            (id) => String(id ?? '') === idMiembroActual
          )
        );
        const idDestacamento = String(
          miembroActual?.destId ??
            miembroActual?.idDestacamento ??
            miembroActual?.destacamentoId ??
            user?.destId ??
            user?.idDestacamento ??
            user?.alcance?.destacamentos?.[0] ??
            ''
        );

        if (!idDestacamento) {
          setContactosDelDestacamento([]);
          return;
        }

        setContactosDelDestacamento(
          miembros
            .filter((miembro) => {
              const mismoDestacamento = String(
                miembro?.destId ?? miembro?.idDestacamento ?? miembro?.destacamentoId ?? ''
              ) === idDestacamento;
              const esLaPersonaActual = [
                miembro?.id,
                miembro?.idMiembros,
                miembro?.memberId,
                miembro?.codigoMiembro,
              ].some((id) => String(id ?? '') === idMiembroActual);

              return mismoDestacamento && !esLaPersonaActual;
            })
            .map((miembro) => ({
              ...miembro,
              id: miembro.id ?? miembro.idMiembros ?? miembro.memberId,
              idMiembros: miembro.idMiembros ?? miembro.id ?? miembro.memberId,
              name:
                getMemberFullName(miembro) ||
                miembro.name ||
                [miembro.nombres, miembro.apellidos].filter(Boolean).join(' ') ||
                'Miembro',
              avatarUrl: miembro.avatarUrl || miembro.photoURL || miembro.urlFoto || '',
            }))
        );
      } catch (error) {
        console.error('Error cargando contactos del destacamento:', error);
        if (vigente) setContactosDelDestacamento([]);
      }
    };

    cargarContactos();
    return () => {
      vigente = false;
    };
  }, [cargaSecundariaLista, user]);

  // Los sonidos de aviso, listos antes del primer mensaje. Se leen una vez por
  // sesion: los eligio el Administrador Global y valen para toda la aplicacion.
  useCargarSonidosDeAviso(cargaSecundariaLista);

  // Un solo resumen para la persona y todos sus buzones. Fuera de /chat no se
  // abren listeners de conversaciones ni se publica presencia: el contador se
  // repasa cada minuto y el tiempo real completo vive en la pantalla de chat.
  const buzonesQueAtiendo = useMemo(() => buzonesQueAtiende(user), [user]);
  const mailboxIds = useMemo(
    () => buzonesQueAtiendo.map((buzon) => buzon.idMiembros),
    [buzonesQueAtiendo]
  );
  const { unreadByConversation } = useGetDashboardChatSummary({
    memberId: chatMemberId,
    mailboxIds,
    enabled: chatSummaryEnabled,
  });

  const activeChatId = isChatRoute ? searchParams.get('id') : null;
  const chatsSinLeer = Object.keys(unreadByConversation).filter(
    (conversationId) => conversationId !== activeChatId
  ).length;
  const mailsSinLeer = Number(mailLabels.find((label) => label.id === 'inbox')?.unreadCount || 0);
  const [notificacionesDrawer, setNotificacionesDrawer] = useState(_notifications);
  // LO QUE SE ACABA DE MARCAR NO VUELVE ATRAS.
  //
  // Las notificaciones se recargan cada 30 segundos. Si la recarga llegaba antes
  // de que Firestore guardara la marca, el aviso volvia a "no leido" y parecia
  // que el clic no habia servido. Aqui se apunta lo marcado y se aplica encima de
  // cada recarga durante un minuto, que sobra para que la escritura llegue.
  const marcasPendientesRef = useRef(new Map());

  const apuntarMarca = (ids, cambios) => {
    const hasta = Date.now() + 60000;

    ids.forEach((id) => marcasPendientesRef.current.set(String(id), { cambios, hasta }));
  };

  const conMarcasPendientes = (lista) => {
    const ahora = Date.now();
    const pendientes = marcasPendientesRef.current;

    pendientes.forEach((marca, id) => {
      if (marca.hasta < ahora) pendientes.delete(id);
    });

    if (!pendientes.size) return lista;

    return lista.map((notification) => {
      const marca = pendientes.get(String(notification.id));

      return marca ? { ...notification, ...marca.cambios } : notification;
    });
  };

  const settings = useSettingsContext();

  const navEnBlanco = Boolean(settings.state.navBlanco);
  const navVars = dashboardNavColorVars(
    theme,
    settings.state.navColor,
    settings.state.navLayout,
    navEnBlanco
  );

  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();
  const probarComoUsuario = useBoolean();

  const handleMarcarTodasComoLeidas = async () => {
    const notificacionesActualizadas = notificacionesDrawer.map((notification) => ({
      ...notification,
      isUnRead: false,
      estado: notification.estado === 'archivada' ? 'archivada' : 'leida',
    }));

    setNotificacionesDrawer(notificacionesActualizadas);
    notificacionesActualizadas.forEach((notification) =>
      apuntarMarca([notification.id], { isUnRead: false, estado: notification.estado })
    );

    if (!user?.uid) {
      return;
    }

    try {
      await marcarNotificacionesComoLeidasPorUsuario(user.uid);
    } catch (error) {
      console.error('[notifications test] no se pudieron marcar como leidas', error);
    }
  };

  const handleMarcarNotificacionComoLeida = async (notificationId) => {
    const notificationIds = Array.isArray(notificationId) ? notificationId : [notificationId];

    setNotificacionesDrawer((prevState) =>
      prevState.map((notification) =>
        notificationIds.includes(notification.id)
          ? { ...notification, isUnRead: false, estado: 'leida' }
          : notification
      )
    );
    apuntarMarca(notificationIds, { isUnRead: false, estado: 'leida' });

    try {
      await marcarNotificacionComoLeida(notificationId, user?.uid);
    } catch (error) {
      console.error('[notifications] no se pudo marcar como leída', error);
    }
  };

  const handleMarcarNotificacionComoAtendida = async (notificationId) => {
    const notificationIds = Array.isArray(notificationId) ? notificationId : [notificationId];

    setNotificacionesDrawer((prevState) =>
      prevState.map((notification) =>
        notificationIds.includes(notification.id)
          ? { ...notification, isUnRead: false, estado: 'atendida' }
          : notification
      )
    );
    apuntarMarca(notificationIds, { isUnRead: false, estado: 'atendida' });

    try {
      await marcarNotificacionComoAtendida(notificationId, user?.uid);
    } catch (error) {
      console.error('[notifications] no se pudo marcar como atendida', error);
    }
  };

  useEffect(() => {
    if (!cargaSecundariaLista) return undefined;

    let isMounted = true;

    const cargarNotificaciones = async () => {
      if (!user?.uid) {
        if (isMounted) {
          setNotificacionesDrawer(_notifications);
        }
        return;
      }

      const notificacionesReportesLocales = obtenerNotificacionesReportesLocales();

      try {
        const notificacionesFirestore = await listarNotificacionesDrawerParaUsuario(user);

        if (!isMounted) return;

        setNotificacionesDrawer(
          conMarcasPendientes([
            ...notificacionesReportesLocales,
            ...notificacionesFirestore,
            ..._notifications,
          ])
        );
      } catch (error) {
        console.error('[notifications test] no se pudo cargar la prueba', error);

        if (isMounted) {
          setNotificacionesDrawer([...notificacionesReportesLocales, ..._notifications]);
        }
      }
    };

    cargarNotificaciones();
    window.addEventListener('notificaciones:actualizar', cargarNotificaciones);

    // LA CAMPANA, EN TIEMPO REAL. Solo se recargaba cada 30 segundos: un aviso
    // —un mensaje para la Tienda o la Oficina, una aprobacion— tardaba hasta
    // medio minuto en aparecer. Ahora un aviso nuevo para esta cuenta la recarga
    // al instante; la recarga periodica queda como red de seguridad.
    //
    // Y el sonido va AQUI, no donde se cuenta lo no leido: esto es lo primero
    // que se entera de que llego un aviso. Esperar a que la lista se recargue
    // metia una vuelta mas —y el sonido llegaba despues de la bolita—.
    const cancelarEscucha = escucharNotificacionesDelUsuario(user?.uid, (cambio) => {
      if (cambio?.nuevas > 0) sonarAviso('campana');
      cargarNotificaciones();
    });
    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      cargarNotificaciones();
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('notificaciones:actualizar', cargarNotificaciones);
      cancelarEscucha();
    };
  }, [cargaSecundariaLista, user]);

  // CON ROLES COMBINADOS, EL MENU SIGUE SIENDO EL DEL ADMINISTRADOR GLOBAL.
  // La prueba solo la enciende el; si el menu se recortaba a la pareja probada,
  // perdia las pestañas para moverse. Los permisos de la pareja los siguen
  // aplicando los guardas de cada pantalla.
  const usuarioDelMenu = (pruebaDeRolesActiva && user?.sesionSinPrueba) || user;
  const menuDeAdministradorGlobal =
    isAdminGlobal(usuarioDelMenu) ||
    String(usuarioDelMenu?.role ?? usuarioDelMenu?.rol ?? '')
      .trim()
      .toLowerCase() === 'admin';

  const navData = useMemo(() => {
    // EL ADMINISTRADOR GLOBAL SIGUE VIENDO TODO.
    //
    // El menu se reorganizo en seis grupos por area de trabajo y los modulos de la
    // plantilla y las pantallas "- DEV" se quedaron fuera: para el resto de la
    // organizacion eran entradas que llevaban a datos de mentira.
    //
    // Para quien desarrolla si sirven, asi que se le devuelven al final, en dos
    // grupos propios y marcados como "Desarrollo". Van al final a proposito: lo de
    // trabajar primero, lo de probar despues.
    //
    // No se usa `allowedRoles` porque esa comprobacion es una lista de EXCLUSION
    // —oculta a quien aparezca en ella— y aqui hace falta lo contrario.
    const baseNavData = slotProps?.nav?.data ?? dashboardNavData;
    // "Mi usuario" (Cuenta y Perfil) ya no va aqui: "Mi cuenta" y "Mi perfil"
    // estan en el menu de la foto, a la derecha, para todo el mundo.
    const conDesarrollo = menuDeAdministradorGlobal
      ? [...baseNavData, ...navDataDesarrollo]
      : baseNavData;
    const navDataConIndicadores = agregarIndicadoresMensajes(conDesarrollo, {
      chatUnreadCount: chatsSinLeer,
      mailUnreadCount: mailsSinLeer,
    });
    const navDataFiltrada = filterDashboardNavDataByUser(navDataConIndicadores, usuarioDelMenu);

    // LA TIENDA ENTERA PARA QUIEN LA ADMINISTRA: el Administrador Global y el de
    // Gestion de Tienda ven Tienda Virtual, Ordenes y Recibos debajo de "Tienda".
    // Se pone DESPUES del filtro a proposito: el filtro convierte cualquier
    // entrada de la tienda en el desplegable de cliente —"Mis ordenes", "Mis
    // recibos"— y, puesta antes, podia deshacerla. El resto de los miembros se
    // queda con ese desplegable.
    const conTienda =
      menuDeAdministradorGlobal || canManageStoreProducts(usuarioDelMenu)
        ? conTiendaDeAdministracion(navDataFiltrada)
        : navDataFiltrada;

    // EXPLORA DESIGNER, debajo de "Administradores", solo para el Administrador
    // Global de verdad —no la cuenta administrativa antigua—: es la misma
    // comprobacion que hace la pantalla, asi que nadie ve un enlace que le cierra.
    return isAdminGlobal(usuarioDelMenu) ? conEverestDesigner(conTienda) : conTienda;
  }, [chatsSinLeer, menuDeAdministradorGlobal, mailsSinLeer, slotProps?.nav?.data, usuarioDelMenu]);

  const isNavMini = settings.state.navLayout === 'mini';
  const isNavHorizontal = settings.state.navLayout === 'horizontal';
  const isNavVertical = isNavMini || settings.state.navLayout === 'vertical';

  const canDisplayItemByRole = (allowedRoles) => !allowedRoles?.includes(user?.role);

  const renderHeader = () => {
    const headerSlotProps = {
      container: {
        maxWidth: false,
        sx: {
          ...(isNavVertical && { px: { [layoutQuery]: 5 } }),
          ...(isNavHorizontal && {
            bgcolor: 'var(--layout-nav-bg)',
            height: { [layoutQuery]: 'var(--layout-nav-horizontal-height)' },
            [`& .${iconButtonClasses.root}`]: { color: 'var(--layout-nav-text-secondary-color)' },
          }),
        },
      },
    };

    const headerSlots = {
      topArea: <SesionComoUsuarioBanner />,
      bottomArea: isNavHorizontal ? (
        <NavHorizontal
          data={navData}
          layoutQuery={layoutQuery}
          cssVars={navVars.section}
          checkPermissions={canDisplayItemByRole}
        />
      ) : null,
      leftArea: (
        <>
          {/** @slot Nav mobile */}
          <MenuButton
            onClick={onOpen}
            sx={{ mr: 1, ml: -1, [theme.breakpoints.up(layoutQuery)]: { display: 'none' } }}
          />
          <NavMobile
            data={navData}
            open={open}
            isNavLight={navEnBlanco}
            onClose={onClose}
            cssVars={navVars.section}
            checkPermissions={canDisplayItemByRole}
          />

          {/** @slot Logo */}
          {isNavHorizontal && (
            <Logo
              sx={{
                display: 'none',
                [theme.breakpoints.up(layoutQuery)]: { display: 'inline-flex' },
              }}
            />
          )}

          {/** @slot Divider */}
          {isNavHorizontal && (
            <VerticalDivider sx={{ [theme.breakpoints.up(layoutQuery)]: { display: 'flex' } }} />
          )}

          {/** @slot Searchbar
           *
           * A LA IZQUIERDA Y ABIERTO. Estaba a la derecha, apretado entre los seis
           * iconos de la cabecera y reducido a una lupa: para buscar habia que
           * saber que esa lupa buscaba y abrir un dialogo encima de todo.
           *
           * Va ANTES que los selectores de rol a proposito. Detras de ellos el
           * campo empezaba a mitad de la cabecera —esos dos selectores son anchos
           * y solo los ve el Administrador Global—, asi que la busqueda quedaba
           * descolocada para quien mas la usa y centrada para nadie. Buscar se
           * hace mas veces que cambiarse de rol.
           */}
          <Searchbar abierto data={navData} sx={{ ml: { sm: 1.5, md: 2 } }} />

          {/** @slot Workspace popover */}
          {/* Solo el Administrador Global: es el unico que cambia de rol. Para el
              resto era un adorno que ademas decia un solo cargo, y hay quien
              tiene dos; los suyos salen bajo su nombre, en la barra lateral. */}
          {(esAdministradorGlobal || pruebaDeRolesActiva || user?.selectorRolAdminGlobal) && (
            <WorkspacesPopover
              data={_workspaces}
              // SEPARADO DEL BUSCADOR. Iba pegado al borde del campo y el nombre
              // del rol se leia como parte de la busqueda. El margen va aqui y no
              // en el buscador: el buscador lo ve todo el mundo y este selector
              // solo el Administrador Global, asi que sin el nadie hereda un
              // hueco vacio.
              // Durante la prueba sigue a la vista, tachado: dice cual es el rol
              // de verdad y que ahora mismo no manda el.
              nombreForzado={pruebaDeRolesActiva ? 'Administrador Global' : ''}
              // Con una PAREJA de cargos encendida manda ella: el selector de un
              // solo rol se queda a la vista pero sin efecto, para que no haya
              // dos mandos discutiendo por la misma sesion.
              disabled={pruebaDeRolesActiva}
              sx={{
                ml: { sm: 2, md: 3 },
                ...(isNavHorizontal && { color: 'var(--layout-nav-text-primary-color)' }),
              }}
            />
          )}

          {/* Probar dos cargos a la vez. Sigue visible durante la prueba —la
              sesion ya no es Administrador Global— porque es el unico camino de
              vuelta. */}
          {(esAdministradorGlobal || pruebaDeRolesActiva || user?.selectorRolAdminGlobal) && (
            <RoleCombinationPopover
              sx={{ ...(isNavHorizontal && { color: 'var(--layout-nav-text-primary-color)' }) }}
            />
          )}
        </>
      ),
      rightArea: (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 0.75 } }}>
          {/** @slot Notifications popover */}
          <NotificationsDrawer
            data={notificacionesDrawer}
            onMarkAsRead={handleMarcarNotificacionComoLeida}
            onMarkAsAttended={handleMarcarNotificacionComoAtendida}
            onMarkAllAsRead={handleMarcarTodasComoLeidas}
          />

          {/** @slot Contacts popover */}
          <ContactsPopover data={contactosDelDestacamento} />

          {/** @slot Settings button */}
          <SettingsButton />

          {/** @slot Account drawer */}
          <AccountDrawer
            data={_account}
            onProbarComoUsuario={
              puedeUsarSelectorDeRol(user?.email ?? user?.correo) && esAdministradorGlobal
                ? probarComoUsuario.onTrue
                : undefined
            }
          />
        </Box>
      ),
    };

    // LA CABECERA ES NAVY, COMO LA BARRA LATERAL Y LA PORTADA.
    //
    // No basta con pintarle el fondo: dentro hay botones de icono que traen su
    // propio color del tema (`action.active`, un gris pensado para fondos claros)
    // y sobre navy se volvian ilegibles. Por eso se recolorean los hijos aqui, en
    // un solo sitio, en vez de tocar cada componente de la cabecera.
    //
    // El velo del scroll se apaga: existia para dar fondo a una cabecera
    // transparente cuando el contenido pasaba por debajo. Con la cabecera ya
    // opaca lo unico que hacia era aclararla al bajar.
    const cabeceraDeMarca = {
      '--offset-color': 'var(--layout-header-text)',
      backgroundColor: 'var(--layout-header-bg)',
      // El degradado encima del color: si un dia se quita, la cabecera se queda
      // en navy plano y no en blanco.
      backgroundImage: 'var(--layout-header-bg-image)',
      color: 'var(--layout-header-text)',
      '&::before': { display: 'none' },
      // Los iconos y su texto. `color: inherit` no basta: los `IconButton` del
      // tema declaran el suyo.
      '& .MuiIconButton-root': { color: 'var(--layout-header-text-secondary)' },
      '& .MuiIconButton-root:hover': {
        color: 'var(--layout-header-text)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
      },
      '& .MuiTypography-root': { color: 'inherit' },
      // La lupa y su campo de busqueda, que en claro iban sobre blanco.
      '& .MuiInputBase-root': { color: 'var(--layout-header-text)' },
      '& .MuiDivider-root': { borderColor: 'rgba(255, 255, 255, 0.16)' },
    };

    return (
      <HeaderSection
        layoutQuery={layoutQuery}
        disableElevation={isNavVertical}
        {...slotProps?.header}
        slots={{ ...headerSlots, ...slotProps?.header?.slots }}
        slotProps={merge(headerSlotProps, slotProps?.header?.slotProps ?? {})}
        sx={[
          cabeceraDeMarca,
          ...(Array.isArray(slotProps?.header?.sx) ? slotProps.header.sx : [slotProps?.header?.sx]),
        ]}
      />
    );
  };

  const renderSidebar = () => (
    <NavVertical
      data={navData}
      isNavMini={isNavMini}
      isNavLight={navEnBlanco}
      layoutQuery={layoutQuery}
      cssVars={navVars.section}
      checkPermissions={canDisplayItemByRole}
      onToggleNav={() =>
        settings.setField(
          'navLayout',
          settings.state.navLayout === 'vertical' ? 'mini' : 'vertical'
        )
      }
    />
  );

  const renderFooter = () => null;

  const renderMain = () => <MainSection {...slotProps?.main}>{children}</MainSection>;

  return (
    <LayoutSection
      /** **************************************
       * @Header
       *************************************** */
      headerSection={renderHeader()}
      /** **************************************
       * @Sidebar
       *************************************** */
      sidebarSection={isNavHorizontal ? null : renderSidebar()}
      /** **************************************
       * @Footer
       *************************************** */
      footerSection={renderFooter()}
      /** **************************************
       * @Styles
       *************************************** */
      cssVars={{ ...dashboardLayoutVars(theme, navEnBlanco), ...navVars.layout, ...cssVars }}
      sx={[
        {
          [`& .${layoutClasses.sidebarContainer}`]: {
            [theme.breakpoints.up(layoutQuery)]: {
              pl: isNavMini ? 'var(--layout-nav-mini-width)' : 'var(--layout-nav-vertical-width)',
              transition: theme.transitions.create(['padding-left'], {
                easing: 'var(--layout-transition-easing)',
                duration: 'var(--layout-transition-duration)',
              }),
            },
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {renderMain()}
      <MobileQuickNav
        unreadChats={chatsSinLeer}
        layoutQuery={layoutQuery}
        collapseOnRoutes={MOBILE_QUICK_NAV_COLLAPSE_ROUTES}
      />
      <ProbarComoUsuarioDialog
        open={probarComoUsuario.value}
        onClose={probarComoUsuario.onFalse}
      />
    </LayoutSection>
  );
}
