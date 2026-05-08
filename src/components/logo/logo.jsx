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
      aria-label="Exploradores del Rey"
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
        src="/logo/exploradores-del-rey-logo.png"
        alt="Exploradores del Rey"
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
