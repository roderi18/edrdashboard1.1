import dynamic from 'next/dynamic';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';

import { CONFIG } from 'src/global-config';

const MemberChangeRequestsView = dynamic(
  () => import('src/sections/member/view').then((mod) => mod.MemberChangeRequestsView),
  { loading: () => <ChangeRequestsPageSkeleton /> }
);

// ----------------------------------------------------------------------

export const metadata = {
  title: `Solicitudes de cambio | Dashboard - ${CONFIG.appName}`,
};

function ChangeRequestsPageSkeleton() {
  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Skeleton variant="text" width={260} height={44} />
      <Stack spacing={2} sx={{ mt: 3 }}>
        <Skeleton variant="rounded" height={92} />
        <Skeleton variant="rounded" height={92} />
        <Skeleton variant="rounded" height={92} />
      </Stack>
    </Box>
  );
}

export default function Page() {
  return <MemberChangeRequestsView />;
}
