import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Pagination from '@mui/material/Pagination';

import { MemberCard } from './member-card';

// ----------------------------------------------------------------------

function MemberCardSkeleton() {
  return (
    <Card
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        minHeight: 88,
        p: theme.spacing(3, 2, 3, 3),
      })}
    >
      <Skeleton variant="circular" width={48} height={48} sx={{ flexShrink: 0, mr: 2 }} />
      <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
        <Skeleton variant="text" width="52%" height={24} />
        <Skeleton variant="text" width="42%" height={18} />
        <Skeleton variant="text" width="56%" height={18} />
      </Box>
    </Card>
  );
}

export function MemberCardList({ members, canManage = true, dests = [], loading = false }) {
  const [page, setPage] = useState(1);

  const rowsPerPage = 12;

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  return (
    <Box sx={{ mt: { xs: 2, md: 2.5 } }}>
      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        }}
      >
        {loading
          ? Array.from({ length: rowsPerPage }, (_, index) => <MemberCardSkeleton key={index} />)
          : members
              .slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage)
              .map((member) => (
                <MemberCard key={member.id} member={member} canManage={canManage} dests={dests} />
              ))}
      </Box>

      {!loading && members.length > rowsPerPage && (
        <Box
          sx={{
            mt: { xs: 2, md: 4 },
            mb: { xs: 2, md: 2 },
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Pagination
            page={page}
            shape="circular"
            count={Math.ceil(members.length / rowsPerPage)}
            onChange={handleChangePage}
          />
        </Box>
      )}
    </Box>
  );
}
