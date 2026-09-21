import { useEffect } from 'react';
import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';

import { paths } from 'src/routes/paths';
import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { Scrollbar } from 'src/components/scrollbar';
import { NavSectionVertical } from 'src/components/nav-section';

import { layoutClasses } from '../core';
import { NavUpgrade } from '../components/nav-upgrade';

// ----------------------------------------------------------------------

export function NavMobile({
  sx,
  data,
  open,
  slots,
  onClose,
  className,
  isNavLight,
  checkPermissions,
  ...other
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (open) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          className: mergeClasses([layoutClasses.nav.root, layoutClasses.nav.vertical, className]),
          sx: [
            {
              overflow: 'unset',
              bgcolor: 'var(--layout-nav-bg)',
              width: 'var(--layout-nav-mobile-width)',
            },
            ...(Array.isArray(sx) ? sx : [sx]),
          ],
        },
      }}
    >
      {slots?.topArea ?? (
        <Box
          component={RouterLink}
          href={paths.dashboard.principal}
          aria-label="Ir a Principal"
          sx={{ pl: 3.5, pt: 2.5, pb: 1, display: 'block', width: 'fit-content' }}
        >
          <Box
            component="img"
            src={
              isNavLight
                ? '/logo/explora-wordmark.webp?v=2'
                : '/logo/explora-wordmark-light.webp?v=2'
            }
            alt="EXPLORA"
            width={170}
            height={36}
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            sx={{
              width: 170,
              height: 36,
              display: 'block',
              objectFit: 'contain',
              objectPosition: 'left center',
            }}
          />
        </Box>
      )}

      <Scrollbar fillContent>
        <NavSectionVertical
          data={data}
          checkPermissions={checkPermissions}
          sx={{ px: 2, flex: '1 1 auto' }}
          {...other}
        />
        <NavUpgrade />
      </Scrollbar>

      {slots?.bottomArea}
    </Drawer>
  );
}
