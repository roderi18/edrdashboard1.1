'use client';

import { Fragment } from 'react';

import Box from '@mui/material/Box';
import Portal from '@mui/material/Portal';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { AnimateLogoZoom } from '../animate';

// ----------------------------------------------------------------------

export function SplashScreen({
  portal = false,
  title,
  description,
  slots,
  slotProps,
  sx,
  ...other
}) {
  const PortalWrapper = portal ? Portal : Fragment;

  return (
    <PortalWrapper>
      <LoadingWrapper {...slotProps?.wrapper}>
        <LoadingContent sx={sx} {...other}>
          <Box
            sx={{
              px: 3,
              width: 1,
              maxWidth: 360,
              display: 'flex',
              textAlign: 'center',
              alignItems: 'center',
              flexDirection: 'column',
            }}
          >
            {slots?.logo ?? <AnimateLogoZoom {...slotProps?.logo} />}

            {(title || description) && (
              <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {!!title && <Typography variant="h6">{title}</Typography>}

                {!!description && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {description}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </LoadingContent>
      </LoadingWrapper>
    </PortalWrapper>
  );
}

// ----------------------------------------------------------------------

const LoadingWrapper = styled('div')({
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
});

const LoadingContent = styled('div')(({ theme }) => ({
  right: 0,
  bottom: 0,
  zIndex: 9998,
  flexGrow: 1,
  width: '100%',
  height: '100%',
  display: 'flex',
  position: 'fixed',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.vars.palette.background.default,
}));
