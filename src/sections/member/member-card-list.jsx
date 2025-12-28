import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';

import { MemberCard } from './member-card';

// ----------------------------------------------------------------------

export function MemberCardList({ members }) {
  const [page, setPage] = useState(1);

  const rowsPerPage = 12;

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  return (
    <>
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
            <MemberCard key={member.id} member={member} />
          ))}
      </Box>

      <Pagination
        page={page}
        shape="circular"
        count={Math.ceil(members.length / rowsPerPage)}
        onChange={handleChangePage}
        sx={{ mt: { xs: 5, md: 8 }, mx: 'auto' }}
      />
    </>
  );
}
