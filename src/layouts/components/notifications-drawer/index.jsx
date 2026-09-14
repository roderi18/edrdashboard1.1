'use client';

import { m } from 'framer-motion';
import { useBoolean } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Badge from '@mui/material/Badge';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { varTap, varHover, transitionTap } from 'src/components/animate';

import { NotificationItem } from './notification-item';

// ----------------------------------------------------------------------

const TABS = [
  { value: 'all', label: 'Todos', count: 22 },
  { value: 'Unread', label: 'No leídas', count: 12 },
  { value: 'attended', label: 'Atendidas', count: 0 },
  { value: 'archived', label: 'Archivadas', count: 10 },
];

// LA LISTA SE PINTA POR TANDAS, NO ENTERA.
//
// Al pulsar la campana el panel tardaba en aparecer: React pintaba TODAS las
// filas —cada una con su HTML, sus botones y, las de producto, sus fotos— antes
// de dejar que el cajon se abriera. Ahora el cajon sale en el acto con la
// cabecera y unas filas de espera; la lista llega en el siguiente fotograma y de
// quince en quince, y la siguiente tanda se pide al acercarse al final.
const TANDA = 15;

function FilasDeEspera() {
  return (
    <Box sx={{ px: 2.5, py: 1 }}>
      {[0, 1, 2, 3].map((fila) => (
        <Box key={fila} sx={{ gap: 2, py: 1.5, display: 'flex' }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ flexShrink: 0 }} />
          <Box sx={{ flex: '1 1 auto' }}>
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="40%" />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ----------------------------------------------------------------------

export function NotificationsDrawer({
  data = [],
  onMarkAsRead,
  onMarkAsAttended,
  onMarkAllAsRead,
  sx,
  ...other
}) {
  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();

  const [currentTab, setCurrentTab] = useState('all');
  const [notifications, setNotifications] = useState(data);
  // Si la lista ya se puede pintar (un fotograma despues de abrir) y cuantas
  // filas van pintadas.
  const [listaLista, setListaLista] = useState(false);
  const [filasVisibles, setFilasVisibles] = useState(TANDA);
  const [finDeLista, setFinDeLista] = useState(null);

  useEffect(() => {
    if (!open) {
      setListaLista(false);
      setFilasVisibles(TANDA);
      return undefined;
    }

    // Dos fotogramas: en el primero el navegador pinta el cajon abierto; en el
    // segundo ya se puede cargar la lista sin frenar esa animacion.
    let segundo = 0;
    const primero = window.requestAnimationFrame(() => {
      segundo = window.requestAnimationFrame(() => setListaLista(true));
    });

    return () => {
      window.cancelAnimationFrame(primero);
      window.cancelAnimationFrame(segundo);
    };
  }, [open]);

  useEffect(() => {
    setNotifications(data);
  }, [data]);

  const handleChangeTab = useCallback((event, newValue) => {
    setCurrentTab(newValue);
    setFilasVisibles(TANDA);
  }, []);

  const totalUnRead = notifications.filter((item) => item.isUnRead === true).length;
  const totalArchivadas = notifications.filter((item) => item.estado === 'archivada').length;
  const totalAtendidas = notifications.filter((item) => item.estado === 'atendida').length;

  const notificationsFiltradas = notifications.filter((notification) => {
    if (currentTab === 'Unread') {
      return notification.isUnRead === true;
    }

    if (currentTab === 'archived') {
      return notification.estado === 'archivada';
    }

    if (currentTab === 'attended') {
      return notification.estado === 'atendida';
    }

    return true;
  });

  const handleMarkAllAsRead = () => {
    setNotifications((prevState) =>
      prevState.map((notification) => ({
        ...notification,
        isUnRead: false,
        estado: notification.estado === 'no_leida' ? 'leida' : notification.estado,
      }))
    );
    Promise.resolve(onMarkAllAsRead?.()).catch((error) => {
      console.error('[notifications] no se pudieron marcar todas como leidas', error);
    });
  };

  // LEIDO AL INSTANTE. Antes se esperaba a que Firestore confirmara la escritura
  // para cerrar el cajon y navegar: durante ese viaje la fila seguia igual y
  // parecia que el clic no habia hecho nada. La marca se ve ya y la escritura va
  // por detras; si falla, quien la persiste lo registra.
  const handleClickNotification = (notification) => {
    setNotifications((prevState) =>
      prevState.map((item) =>
        item.id === notification.id ? { ...item, isUnRead: false, estado: 'leida' } : item
      )
    );

    Promise.resolve(onMarkAsRead?.(notification.idsNotificaciones || notification.id)).catch(
      (error) => {
        console.error('[notifications] no se pudo marcar como leida', error);
      }
    );
    setCurrentTab('all');
    onClose();
  };

  // La marca es INMEDIATA. La escritura en la base viaja por detras: esperarla
  // dejaba el boton igual que antes durante el viaje de ida y vuelta, y quien lo
  // pulsaba no sabia si habia pasado algo. Si falla, quien persiste ya lo
  // registra; nada que deshacer aqui.
  const handleMarkAsAttended = (notification) => {
    setNotifications((prevState) =>
      prevState.map((item) =>
        item.id === notification.id ? { ...item, isUnRead: false, estado: 'atendida' } : item
      )
    );
    setCurrentTab('all');

    Promise.resolve(onMarkAsAttended?.(notification.idsNotificaciones || notification.id)).catch(
      (error) => {
        console.error('[notifications] no se pudo marcar como atendida', error);
      }
    );
  };

  const renderHead = () => (
    <Box
      sx={{
        py: 2,
        pr: 1,
        pl: 2.5,
        minHeight: 68,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Typography variant="h6" sx={{ flexGrow: 1 }}>
        Notificaciones
      </Typography>

      {!!totalUnRead && (
        <Tooltip title="Mark all as read">
          <IconButton color="primary" onClick={handleMarkAllAsRead}>
            <Iconify icon="eva:done-all-fill" />
          </IconButton>
        </Tooltip>
      )}

      <IconButton onClick={onClose} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
        <Iconify icon="mingcute:close-line" />
      </IconButton>

      <IconButton>
        <Iconify icon="solar:settings-bold-duotone" />
      </IconButton>
    </Box>
  );

  const renderTabs = () => (
    <Tabs variant="fullWidth" value={currentTab} onChange={handleChangeTab} indicatorColor="custom">
      {TABS.map((tab) => {
        const count =
          (tab.value === 'all' && notifications.length) ||
          (tab.value === 'Unread' && totalUnRead) ||
          (tab.value === 'archived' && totalArchivadas) ||
          (tab.value === 'attended' && totalAtendidas) ||
          0;

        return (
          <Tab
            key={tab.value}
            iconPosition="end"
            value={tab.value}
            label={tab.label}
            icon={
              <Label
                variant={((tab.value === 'all' || tab.value === currentTab) && 'filled') || 'soft'}
                color={
                  (tab.value === 'Unread' && 'info') ||
                  (tab.value === 'archived' && 'success') ||
                  (tab.value === 'attended' && 'success') ||
                  'default'
                }
              >
                {count}
              </Label>
            }
          />
        );
      })}
    </Tabs>
  );

  // Pide la siguiente tanda cuando el final de la lista asoma en pantalla.
  useEffect(() => {
    const vigia = finDeLista;

    if (!vigia || typeof IntersectionObserver === 'undefined') return undefined;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setFilasVisibles((actual) => actual + TANDA);
        }
      },
      { rootMargin: '200px' }
    );

    observador.observe(vigia);
    return () => observador.disconnect();
  }, [finDeLista]);

  const hayMasFilas = notificationsFiltradas.length > filasVisibles;

  const renderList = () => (
    <Scrollbar>
      {!listaLista && <FilasDeEspera />}

      <Box component="ul" sx={{ display: listaLista ? 'block' : 'none' }}>
        {listaLista && notificationsFiltradas.slice(0, filasVisibles).map((notification) => (
          <Box component="li" key={notification.id} sx={{ display: 'flex' }}>
            <NotificationItem
              notification={notification}
              onClickNotification={handleClickNotification}
              onMarkAsAttended={handleMarkAsAttended}
            />
          </Box>
        ))}
      </Box>

      {listaLista && hayMasFilas && (
        <Box ref={setFinDeLista} sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
          <Skeleton variant="rounded" width="80%" height={48} />
        </Box>
      )}
    </Scrollbar>
  );

  return (
    <>
      <IconButton
        component={m.button}
        whileTap={varTap(0.96)}
        whileHover={varHover(1.04)}
        transition={transitionTap()}
        aria-label="Notifications button"
        onClick={onOpen}
        sx={sx}
        {...other}
      >
        <Badge badgeContent={totalUnRead} color="error">
          <Iconify width={24} icon="solar:bell-bing-bold-duotone" />
        </Badge>
      </IconButton>

      <Drawer
        open={open}
        onClose={onClose}
        anchor="right"
        slotProps={{
          backdrop: { invisible: true },
          paper: { sx: { width: 1, maxWidth: 420 } },
        }}
      >
        {renderHead()}
        {renderTabs()}
        {renderList()}

        <Box sx={{ p: 1 }}>
          <Button fullWidth size="large" onClick={handleMarkAllAsRead} disabled={!totalUnRead}>
            Marcar todo como leído
          </Button>
        </Box>
      </Drawer>
    </>
  );
}
