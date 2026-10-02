'use client';

import { m } from 'framer-motion';

import { styled } from '@mui/material/styles';

import { Logo } from '../logo';

// ----------------------------------------------------------------------

// LA PANTALLA DE CARGA: EL LOGOTIPO DE EXPEDITION, QUIETO.
//
// Antes era el isotipo de EXPLORA girando dentro de dos marcos que también
// giraban. Ahora es el logotipo completo y no gira: solo respira (opacidad),
// para que se note que la aplicación sigue cargando. Texto oscuro en el tema
// claro y claro en el oscuro, como en el menú lateral.
export function AnimateLogoZoom({ logo, slotProps, sx, ...other }) {
  return (
    <LogoZoomRoot sx={sx} {...other}>
      <m.span
        animate={{ opacity: [1, 0.55, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ display: 'inline-flex' }}
      >
        {logo ?? (
          <>
            <LoadingLogotipo
              src="/marca/expedition-logotipo.webp?v=1"
              alt="EXPEDITION"
              width={200}
              height={139}
              data-tema="claro"
              {...slotProps?.logo}
            />
            <LoadingLogotipo
              src="/marca/expedition-logotipo-claro.webp?v=1"
              alt=""
              aria-hidden="true"
              width={200}
              height={139}
              data-tema="oscuro"
              {...slotProps?.logo}
            />
          </>
        )}
      </m.span>
    </LogoZoomRoot>
  );
}

const LogoZoomRoot = styled('div')(() => ({
  width: 200,
  height: 139,
  alignItems: 'center',
  position: 'relative',
  display: 'inline-flex',
  justifyContent: 'center',
}));

// Las dos variantes van en la página y el tema decide cuál se ve: así no hay
// parpadeo esperando a saber el tema.
const LoadingLogotipo = styled('img')(({ theme }) => ({
  width: 200,
  height: 139,
  objectFit: 'contain',
  '&[data-tema="oscuro"]': { display: 'none' },
  ...theme.applyStyles('dark', {
    '&[data-tema="claro"]': { display: 'none' },
    '&[data-tema="oscuro"]': { display: 'block' },
  }),
}));

// ----------------------------------------------------------------------

export function AnimateLogoRotate({ logo, sx, slotProps, ...other }) {
  return (
    <LogoRotateRoot sx={sx} {...other}>
      {logo ?? (
        <Logo
          {...slotProps?.logo}
          sx={[
            { zIndex: 9, width: 40, height: 40 },
            ...(Array.isArray(slotProps?.logo?.sx) ? slotProps.logo.sx : [slotProps?.logo?.sx]),
          ]}
        />
      )}

      <LogoRotateBackground
        animate={{ rotate: 360 }}
        transition={{ duration: 10, ease: 'linear', repeat: Infinity }}
      />
    </LogoRotateRoot>
  );
}

const LogoRotateRoot = styled('div')(() => ({
  width: 96,
  height: 96,
  alignItems: 'center',
  position: 'relative',
  display: 'inline-flex',
  justifyContent: 'center',
}));

const LogoRotateBackground = styled(m.span)(({ theme }) => ({
  width: '100%',
  height: '100%',
  opacity: 0.16,
  borderRadius: '50%',
  position: 'absolute',
  backgroundImage: `linear-gradient(135deg, transparent 50%, ${theme.vars.palette.primary.main} 100%)`,
  transition: theme.transitions.create(['opacity'], {
    easing: theme.transitions.easing.easeInOut,
    duration: theme.transitions.duration.shorter,
  }),
}));
