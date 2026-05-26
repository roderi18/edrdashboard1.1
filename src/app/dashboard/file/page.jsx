import dynamic from 'next/dynamic';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';

import { CONFIG } from 'src/global-config';

const OverviewFileView = dynamic(
  () => import('src/sections/overview/file/view').then((mod) => mod.OverviewFileView),
  { loading: () => <FilePageSkeleton /> }
);

// ----------------------------------------------------------------------

export const metadata = { title: `Archivos | Dashboard - ${CONFIG.appName}` };

function FilePageSkeleton() {
  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Grid container spacing={3}>
        {[1, 2, 3].map((item) => (
          <Grid key={item} size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rounded" height={160} />
          </Grid>
        ))}
        <Grid size={{ xs: 12, md: 8 }}>
          <Skeleton variant="rounded" height={380} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={96} />
            <Skeleton variant="rounded" height={280} />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function Page() {
  return <OverviewFileView />;
}
