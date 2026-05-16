import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';

import { RegionalCard } from './regional-card';

// ----------------------------------------------------------------------

export function RegionalCardList({ regionals }) {
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
        {regionals
          .slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage)
          .map((regional) => (
            <RegionalCard key={regional.id} regional={regional} />
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
          count={Math.ceil(regionals.length / rowsPerPage)}
          onChange={handleChangePage}
        />
      </Box>
    </Box>
  );
}
