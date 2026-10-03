'use client';

import { mergeClasses } from 'minimal-shared/utils';

import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------

export function Logo({ sx, disabled, className, href = '/', isSingle = true, ...other }) {
  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label="EXPEDITION ™"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          width: 44,
          height: 44,
          ...(!isSingle && { width: 130, height: 44 }),
          ...(disabled && { pointerEvents: 'none' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <img
        // El isotipo de EXPEDITION: menú cerrado, inicio de sesión y demás.
        src="/marca/expedition-isotipo.webp?v=2"
        alt="EXPEDITION ™"
        width="100%"
        height="100%"
        draggable={false}
      />
    </LogoRoot>
  );
}

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  color: 'transparent',
  display: 'inline-flex',
  verticalAlign: 'middle',
  '& img': {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    imageRendering: 'auto',
  },
}));
