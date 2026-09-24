'use client';

import { varAlpha } from 'minimal-shared/utils';
import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Paper from '@mui/material/Paper';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, usePathname } from 'src/routes/hooks';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const ITEMS = [
  {
    key: 'home',
    label: 'Inicio',
    href: paths.dashboard.principal,
    icon: 'solar:home-angle-linear',
  },
  {
    key: 'members',
    label: 'Miembros',
    href: paths.dashboard.level.member.root,
    icon: 'solar:users-group-rounded-linear',
  },
  {
    key: 'chat',
    label: 'Chats',
    href: paths.dashboard.chat,
    icon: 'solar:chat-round-dots-linear',
  },
  {
    key: 'profile',
    label: 'Mi perfil',
    href: paths.dashboard.user.account,
    icon: 'solar:user-id-linear',
  },
];

const normalizarRuta = (ruta = '') => ruta.replace(/\/+$/, '') || '/';

const rutaActiva = (pathname, href) => {
  const actual = normalizarRuta(pathname);
  const destino = normalizarRuta(href);

  return actual === destino || actual.startsWith(`${destino}/`);
};

// ----------------------------------------------------------------------

export function MobileQuickNav({
  unreadChats = 0,
  layoutQuery = 'lg',
  collapseOnRoutes = [],
  hiddenOnRoutes = [],
}) {
  const router = useRouter();
  const pathname = usePathname();
  const collapseOnThisRoute = collapseOnRoutes.some((route) => rutaActiva(pathname, route));
  const [expanded, setExpanded] = useState(!collapseOnThisRoute);
  const navRef = useRef(null);
  const lastScrollY = useRef(0);
  const scrollDistance = useRef(0);

  useEffect(() => {
    lastScrollY.current = Math.max(window.scrollY, 0);

    // Las rutas compactas se controlan con la casita y un toque exterior.
    // El desplazamiento no debe volver a abrirlas por su cuenta.
    if (collapseOnThisRoute) return undefined;

    const handleScroll = () => {
      // AL LLEGAR AL FINAL, LA BARRA SE QUEDA CONTRAIDA.
      //
      // En el iPhone el rebote del final pasa del maximo y vuelve: esa vuelta
      // parecia un desplazamiento hacia arriba y la abria sola. Se recorta la
      // posicion al maximo real, asi el rebote no cuenta y solo la abre un
      // arrastre de verdad.
      const maxScrollY = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      const currentScrollY = Math.min(Math.max(window.scrollY, 0), maxScrollY);
      const delta = currentScrollY - lastScrollY.current;

      if (currentScrollY <= 24) {
        scrollDistance.current = 0;
        setExpanded(true);
      } else if (delta !== 0) {
        const cambioDeDireccion = Math.sign(delta) !== Math.sign(scrollDistance.current);
        scrollDistance.current = cambioDeDireccion ? delta : scrollDistance.current + delta;

        if (scrollDistance.current > 24) {
          scrollDistance.current = 0;
          setExpanded(false);
        } else if (scrollDistance.current < -48) {
          // 48 px y no 16: al soltar el dedo al final, el ajuste de la barra de
          // Safari movia la pagina unos pixeles hacia arriba y bastaba para abrirla.
          scrollDistance.current = 0;
          setExpanded(true);
        }
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, [collapseOnThisRoute]);

  useEffect(() => {
    setExpanded(!collapseOnThisRoute);
    scrollDistance.current = 0;
  }, [collapseOnThisRoute, pathname]);

  useEffect(() => {
    if (!collapseOnThisRoute || !expanded) return undefined;

    const handleOutsidePress = (event) => {
      if (!navRef.current?.contains(event.target)) {
        setExpanded(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePress, true);

    return () => document.removeEventListener('pointerdown', handleOutsidePress, true);
  }, [collapseOnThisRoute, expanded]);

  const handleHomeClick = () => {
    if (!expanded) {
      scrollDistance.current = 0;
      lastScrollY.current = Math.max(window.scrollY, 0);
      setExpanded(true);
      return;
    }

    if (rutaActiva(pathname, paths.dashboard.principal)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    router.push(paths.dashboard.principal);
  };

  // En el chat la barra no se pinta: la pantalla es para la conversacion y la
  // caja de escribir baja hasta el borde. Se decide aqui, despues de los hooks.
  if (hiddenOnRoutes.some((route) => rutaActiva(pathname, route))) return null;

  return (
    <Box
      sx={(theme) => ({
        left: '50%',
        zIndex: theme.zIndex.appBar + 1,
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        width: 'calc(100vw - 24px)',
        height: 72,
        display: 'block',
        position: 'fixed',
        maxWidth: 430,
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        [theme.breakpoints.up(layoutQuery)]: { display: 'none' },
      })}
    >
      <Paper
        ref={navRef}
        component="nav"
        aria-label="Navegación rápida"
        elevation={0}
        sx={(theme) => ({
          p: 0.5,
          left: expanded ? 0 : 'calc(12.5% - 27px)',
          bottom: 0,
          width: expanded ? '100%' : 54,
          height: expanded ? 72 : 54,
          display: 'flex',
          position: 'absolute',
          overflow: 'hidden',
          borderRadius: '999px',
          alignItems: 'stretch',
          color: theme.vars.palette.text.primary,
          pointerEvents: 'auto',
          border: `1px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.26)}`,
          boxShadow: [
            `0 12px 32px ${varAlpha(theme.vars.palette.common.blackChannel, 0.24)}`,
            `inset 0 1px 0 ${varAlpha(theme.vars.palette.common.whiteChannel, 0.42)}`,
            `inset 0 -1px 0 ${varAlpha(theme.vars.palette.common.whiteChannel, 0.12)}`,
          ].join(', '),
          backdropFilter: 'blur(10px) saturate(190%) brightness(1.08)',
          WebkitBackdropFilter: 'blur(14px) saturate(190%) brightness(1.08)',
          backgroundColor: varAlpha(theme.vars.palette.background.paperChannel, 0.22),
          backgroundImage: `linear-gradient(145deg, ${varAlpha(
            theme.vars.palette.common.whiteChannel,
            0.18
          )} 0%, ${varAlpha(theme.vars.palette.common.whiteChannel, 0.05)} 42%, transparent 72%)`,
          transition: theme.transitions.create(
            ['left', 'width', 'height', 'border-radius', 'background-color'],
            { duration: 280, easing: theme.transitions.easing.easeInOut }
          ),
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        })}
      >
        {ITEMS.map((item) => {
          const active = rutaActiva(pathname, item.href);
          const isHome = item.key === 'home';
          const icon = (
            <Iconify
              icon={item.icon}
              width={25}
              sx={{
                transition: 'transform 220ms ease',
                transform: !expanded && isHome ? 'scale(1.08)' : 'scale(1)',
              }}
            />
          );

          return (
            <ButtonBase
              key={item.key}
              {...(!isHome && { component: RouterLink, href: item.href })}
              onClick={isHome ? handleHomeClick : undefined}
              aria-label={!expanded && isHome ? 'Abrir navegación rápida' : item.label}
              aria-current={expanded && active ? 'page' : undefined}
              aria-expanded={!expanded && isHome ? false : undefined}
              aria-hidden={!expanded && !isHome ? true : undefined}
              tabIndex={!expanded && !isHome ? -1 : 0}
              sx={(theme) => ({
                my: 0,
                mx: expanded ? 0.25 : 0,
                gap: expanded ? 0.25 : 0,
                minWidth: 0,
                borderRadius: '999px',
                flex: expanded ? '1 1 0' : isHome ? '0 0 44px' : '0 0 0px',
                width: expanded ? 'auto' : isHome ? 44 : 0,
                opacity: expanded || isHome ? 1 : 0,
                overflow: 'hidden',
                visibility: expanded || isHome ? 'visible' : 'hidden',
                color: theme.vars.palette.text.primary,
                pointerEvents: expanded || isHome ? 'auto' : 'none',
                flexDirection: 'column',
                backgroundColor:
                  expanded && active
                    ? varAlpha(theme.vars.palette.text.primaryChannel, 0.13)
                    : 'transparent',
                transition: theme.transitions.create(
                  ['flex-basis', 'width', 'opacity', 'margin', 'background-color', 'color'],
                  { duration: 240, easing: theme.transitions.easing.easeInOut }
                ),
                '&:hover': {
                  backgroundColor: varAlpha(
                    theme.vars.palette.text.primaryChannel,
                    active ? 0.17 : 0.07
                  ),
                },
                '&:focus-visible': {
                  outline: `2px solid ${theme.vars.palette.primary.main}`,
                  outlineOffset: -2,
                },
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              })}
            >
              {item.key === 'chat' ? (
                <Badge
                  color="error"
                  badgeContent={unreadChats > 99 ? '99+' : unreadChats}
                  invisible={!unreadChats}
                  max={99}
                >
                  {icon}
                </Badge>
              ) : (
                icon
              )}

              <Typography
                component="span"
                variant="caption"
                sx={(theme) => ({
                  px: 0.25,
                  width: '100%',
                  opacity: expanded ? 1 : 0,
                  maxHeight: expanded ? 16 : 0,
                  overflow: 'hidden',
                  fontSize: '0.69rem',
                  fontWeight: active ? 700 : 600,
                  lineHeight: expanded ? 1.15 : 0,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  transition: theme.transitions.create(['opacity', 'max-height', 'line-height'], {
                    duration: expanded ? 220 : 140,
                  }),
                })}
              >
                {item.label}
              </Typography>
            </ButtonBase>
          );
        })}
      </Paper>
    </Box>
  );
}
