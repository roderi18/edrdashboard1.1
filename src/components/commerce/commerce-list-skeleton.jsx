'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import TableBody from '@mui/material/TableBody';

import { Scrollbar } from 'src/components/scrollbar';
import { TableSkeleton } from 'src/components/table/table-skeleton';

// ----------------------------------------------------------------------

export function CommerceListSkeleton({
  showAnalytics = false,
  showTabs = true,
  rowCount = 6,
  cellCount = 7,
}) {
  return (
    <>
      {showAnalytics && (
        <Card sx={{ mb: { xs: 3, md: 5 } }}>
          <Stack
            divider={<Divider orientation="vertical" flexItem sx={{ borderStyle: 'dashed' }} />}
            sx={{ py: 2, flexDirection: 'row' }}
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <Box key={index} sx={{ px: 3, py: 1, flex: 1 }}>
                <Skeleton variant="text" width="42%" height={24} />
                <Skeleton variant="text" width="58%" height={34} />
                <Skeleton variant="text" width="34%" height={18} />
              </Box>
            ))}
          </Stack>
        </Card>
      )}

      <Card>
        {showTabs && (
          <Box sx={{ px: { md: 2.5 }, py: 1.5, display: 'flex', gap: 1.5 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" width={110} height={38} />
            ))}
          </Box>
        )}

        <Box
          sx={{
            px: 2.5,
            pb: 2.5,
            pt: showTabs ? 0.5 : 2.5,
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Skeleton variant="rounded" width={220} height={54} />
          <Skeleton variant="rounded" width={220} height={54} />
          <Skeleton variant="rounded" width={220} height={54} />
        </Box>

        <Scrollbar>
          <Table sx={{ minWidth: 800 }}>
            <TableBody>
              <TableSkeleton rowCount={rowCount} cellCount={cellCount} />
            </TableBody>
          </Table>
        </Scrollbar>

        <Box sx={{ px: 2.5, py: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton variant="text" width={120} height={28} />
          <Skeleton variant="text" width={180} height={28} />
        </Box>
      </Card>
    </>
  );
}
