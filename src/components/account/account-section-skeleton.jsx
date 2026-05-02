'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';

// ----------------------------------------------------------------------

function AccountProfileSkeleton({ sx, ...other }) {
  return (
    <Grid container spacing={3} sx={sx} {...other}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card sx={{ pt: 5, pb: 4, px: 3, textAlign: 'center' }}>
          <Skeleton variant="circular" width={96} height={96} sx={{ mx: 'auto', mb: 2 }} />
          <Skeleton variant="text" width="62%" height={30} sx={{ mx: 'auto' }} />
          <Skeleton variant="text" width="46%" height={22} sx={{ mx: 'auto' }} />
          <Skeleton variant="text" width="34%" height={18} sx={{ mx: 'auto', mb: 3 }} />
          <Skeleton variant="rounded" width={132} height={36} sx={{ mx: 'auto' }} />
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 8 }}>
        <Card sx={{ p: 3 }}>
          <Box
            sx={{
              rowGap: 3,
              columnGap: 2,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
            }}
          >
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton
                key={index}
                variant="rounded"
                height={56}
                sx={{ gridColumn: index === 8 || index === 9 ? '1 / -1' : 'auto' }}
              />
            ))}

            <Skeleton variant="rounded" height={220} sx={{ gridColumn: '1 / -1' }} />
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
            <Skeleton variant="rounded" width={150} height={36} />
            <Skeleton variant="rounded" width={148} height={36} />
          </Box>
        </Card>
      </Grid>
    </Grid>
  );
}

function AccountHistorySkeleton({ rows = 3, sx, ...other }) {
  return (
    <Card sx={sx} {...other}>
      <Skeleton variant="text" width={180} height={32} sx={{ mx: 3, mt: 2.5 }} />

      <Box
        sx={{
          px: 3,
          pt: 3,
          gap: 1.5,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {Array.from({ length: rows }).map((_, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ flex: '1 1 auto' }}>
              <Skeleton variant="text" width="55%" height={24} />
              <Skeleton variant="text" width="36%" height={18} />
            </Box>

            <Skeleton variant="text" width={64} height={24} sx={{ mr: 5 }} />
            <Skeleton variant="text" width={28} height={24} />
          </Box>
        ))}

        <Skeleton variant="rounded" height={1} sx={{ mt: 1, opacity: 0.35 }} />
      </Box>
    </Card>
  );
}

export function AccountSectionSkeleton({ variant = 'profile', ...other }) {
  if (variant === 'history') {
    return <AccountHistorySkeleton {...other} />;
  }

  return <AccountProfileSkeleton {...other} />;
}
