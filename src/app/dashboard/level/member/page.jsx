import dynamic from 'next/dynamic';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';

import { CONFIG } from 'src/global-config';

const MemberListView = dynamic(
  () => import('src/sections/member/view').then((mod) => mod.MemberListView),
  { loading: () => <MemberPageSkeleton /> }
);

// ----------------------------------------------------------------------

export const metadata = { title: `Lista de miembros | Dashboard - ${CONFIG.appName}` };

function MemberPageSkeleton() {
  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Skeleton variant="text" width={260} height={44} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3, mb: 2 }}>
        <Skeleton variant="rounded" height={56} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" width={180} height={56} />
        <Skeleton variant="rounded" width={180} height={56} />
      </Stack>
      <Skeleton variant="rounded" height={520} />
    </Box>
  );
}

export default function Page() {
  return <MemberListView />;
}
