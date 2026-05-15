import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';

import { MemberCard } from './member-card';

// ----------------------------------------------------------------------

export function MemberCardList({ members, canManage = true, dests = [] }) {
  const [page, setPage] = useState(1);

  const rowsPerPage = 12;

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, pt: { xs: 2, md: 2.5 } }}>
      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        }}
      >
        {members
          .slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage)
          .map((member) => (
            <MemberCard key={member.id} member={member} canManage={canManage} dests={dests} />
          ))}
      </Box>

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
    </Box>
  );
}
