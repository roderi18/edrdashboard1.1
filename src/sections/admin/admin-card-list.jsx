import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';

import { AdminCard } from './admin-card';

// ----------------------------------------------------------------------

export function AdminCardList({ admins }) {
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
        {admins
          .slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage)
          .map((admin) => (
            <AdminCard key={admin.id} admin={admin} />
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
          count={Math.ceil(admins.length / rowsPerPage)}
          onChange={handleChangePage}
        />
      </Box>
    </>
  );
}
