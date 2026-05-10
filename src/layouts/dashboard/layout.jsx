'use client';

import { merge } from 'es-toolkit';
import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { useTheme } from '@mui/material/styles';
import { iconButtonClasses } from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { usePathname, useSearchParams } from 'src/routes/hooks';

import { isMemberSessionUser, filterDashboardNavDataForMember } from 'src/utils/member-access';

import { allLangs } from 'src/locales';
import { useGetLabels } from 'src/actions/mail';
import { _contacts, _notifications } from 'src/_mock';
import { useGetContacts, useGetConversations } from 'src/actions/chat';
import {
  marcarNotificacionComoLeida,
  listarNotificacionesDrawerParaUsuario,
  marcarNotificacionesComoLeidasPorUsuario,
} from 'src/services/notification-service';

import { Logo } from 'src/components/logo';
import { Label } from 'src/components/label';
import { useSettingsContext } from 'src/components/settings';

import { useChatCurrentContact } from 'src/sections/chat/hooks/use-chat-current-contact';

import { useAuthContext } from 'src/auth/hooks';

import { NavMobile } from './nav-mobile';
import { VerticalDivider } from './content';
import { NavVertical } from './nav-vertical';
import { NavHorizontal } from './nav-horizontal';
import { _account } from '../nav-config-account';
import { Searchbar } from '../components/searchbar';
import { _workspaces } from '../nav-config-workspace';
import { MenuButton } from '../components/menu-button';
import { AccountDrawer } from '../components/account-drawer';
import { SettingsButton } from '../components/settings-button';
import { LanguagePopover } from '../components/language-popover';
import { ContactsPopover } from '../components/contacts-popover';
import { WorkspacesPopover } from '../components/workspaces-popover';
import { navData as dashboardNavData } from '../nav-config-dashboard';
import { dashboardLayoutVars, dashboardNavColorVars } from './css-vars';
import { NotificationsDrawer } from '../components/notifications-drawer';
import { MainSection, layoutClasses, HeaderSection, LayoutSection } from '../core';

// ----------------------------------------------------------------------

const agregarIndicadoresMensajes = (sections = [], { chatUnreadCount = 0, mailUnreadCount = 0 } = {}) =>
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

export function DashboardLayout({ sx, cssVars, children, slotProps, layoutQuery = 'lg' }) {
  const theme = useTheme();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { user } = useAuthContext();
  const { contacts } = useGetContacts();
  const { labels: mailLabels } = useGetLabels();
  const currentContact = useChatCurrentContact(contacts);
  const { conversations } = useGetConversations(currentContact.idMiembros);
  const activeChatId = pathname?.startsWith(paths.dashboard.chat) ? searchParams.get('id') : null;
  const chatsSinLeer = conversations.allIds.reduce(
    (total, conversationId) =>
      total +
      (conversationId !== activeChatId &&
      Number(conversations.byId[conversationId]?.unreadCount || 0) > 0
        ? 1
        : 0),
    0
  );
  const mailsSinLeer = Number(mailLabels.find((label) => label.id === 'inbox')?.unreadCount || 0);
  const [notificacionesDrawer, setNotificacionesDrawer] = useState(_notifications);

  const settings = useSettingsContext();

  const navVars = dashboardNavColorVars(theme, settings.state.navColor, settings.state.navLayout);

  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();

  const handleMarcarTodasComoLeidas = async () => {
    const notificacionesActualizadas = notificacionesDrawer.map((notification) => ({
      ...notification,
      isUnRead: false,
      estado: notification.estado === 'archivada' ? 'archivada' : 'leida',
    }));

    setNotificacionesDrawer(notificacionesActualizadas);

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

    try {
      await marcarNotificacionComoLeida(notificationId, user?.uid);
    } catch (error) {
      console.error('[notifications] no se pudo marcar como leída', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const cargarNotificaciones = async () => {
      if (!user?.uid) {
        if (isMounted) {
          setNotificacionesDrawer(_notifications);
        }
        return;
      }

      try {
        const notificacionesFirestore = await listarNotificacionesDrawerParaUsuario(user);

        if (!isMounted) return;

        setNotificacionesDrawer([...notificacionesFirestore, ..._notifications]);
      } catch (error) {
        console.error('[notifications test] no se pudo cargar la prueba', error);

        if (isMounted) {
          setNotificacionesDrawer(_notifications);
        }
      }
    };

    cargarNotificaciones();
    window.addEventListener('notificaciones:actualizar', cargarNotificaciones);
    const intervalId = window.setInterval(cargarNotificaciones, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('notificaciones:actualizar', cargarNotificaciones);
    };
  }, [user]);

  const navData = useMemo(() => {
    const baseNavData = slotProps?.nav?.data ?? dashboardNavData;
    const navDataConIndicadores = agregarIndicadoresMensajes(baseNavData, {
      chatUnreadCount: chatsSinLeer,
      mailUnreadCount: mailsSinLeer,
    });

    if (!isMemberSessionUser(user)) {
      return navDataConIndicadores;
    }

    return filterDashboardNavDataForMember(navDataConIndicadores, user);
  }, [chatsSinLeer, mailsSinLeer, slotProps?.nav?.data, user]);

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
      topArea: (
        <Alert severity="info" sx={{ display: 'none', borderRadius: 0 }}>
          This is an info Alert.
        </Alert>
      ),
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

          {/** @slot Workspace popover */}
          <WorkspacesPopover
            data={_workspaces}
            sx={{ ...(isNavHorizontal && { color: 'var(--layout-nav-text-primary-color)' }) }}
          />
        </>
      ),
      rightArea: (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 0.75 } }}>
          {/** @slot Searchbar */}
          <Searchbar data={navData} />

          {/** @slot Language popover */}
          <LanguagePopover data={allLangs} />

          {/** @slot Notifications popover */}
          <NotificationsDrawer
            data={notificacionesDrawer}
            onMarkAsRead={handleMarcarNotificacionComoLeida}
            onMarkAllAsRead={handleMarcarTodasComoLeidas}
          />

          {/** @slot Contacts popover */}
          <ContactsPopover data={_contacts} />

          {/** @slot Settings button */}
          <SettingsButton />

          {/** @slot Account drawer */}
          <AccountDrawer data={_account} />
        </Box>
      ),
    };

    return (
      <HeaderSection
        layoutQuery={layoutQuery}
        disableElevation={isNavVertical}
        {...slotProps?.header}
        slots={{ ...headerSlots, ...slotProps?.header?.slots }}
        slotProps={merge(headerSlotProps, slotProps?.header?.slotProps ?? {})}
        sx={slotProps?.header?.sx}
      />
    );
  };

  const renderSidebar = () => (
    <NavVertical
      data={navData}
      isNavMini={isNavMini}
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
      cssVars={{ ...dashboardLayoutVars(theme), ...navVars.layout, ...cssVars }}
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
    </LayoutSection>
  );
}
