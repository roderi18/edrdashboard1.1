import Box from '@mui/material/Box';
import Link from '@mui/material/Link';

import { RouterLink } from 'src/routes/components';

import { isUnknownLabel } from 'src/utils/is-unknown-label';

export function UnderlineLink({ href, underline = 'always', sx, children, ...props }) {
  const text = String(children || '')
    .toLowerCase()
    .trim();

  const isDisabled = !text || text === '-' || text === 'n/a' || isUnknownLabel(text);

  // 🔴 SI ESTÁ DESHABILITADO → NO LINK
  if (isDisabled) {
    return (
      <Box
        component="span"
        sx={{
          typography: 'body2',
          cursor: 'default',
          ...sx,
          color: 'text.disabled',
        }}
      >
        {children}
      </Box>
    );
  }

  // ✅ SI ES VÁLIDO → LINK NORMAL
  return (
    <Link
      component={RouterLink}
      href={href}
      underline={underline}
      sx={(theme) => ({
        cursor: 'pointer',

        color: theme.palette.mode === 'dark' ? '#ffffff' : 'inherit',

        textUnderlineOffset: '3px',

        textDecorationColor: 'rgba(128,128,128,0.5)',

        '&:hover': {
          textDecorationColor: 'rgba(128,128,128,0.5)',
        },

        ...sx,
      })}
      {...props}
    >
      {children}
    </Link>
  );
}
