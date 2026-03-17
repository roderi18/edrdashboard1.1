import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';

import { SectionalCard } from './sectional-card';

// ----------------------------------------------------------------------

export function SectionalCardList({ sectionals }) {
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
        {sectionals
          .slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage)
          .map((sectional) => (
            <SectionalCard key={sectional.id} sectional={sectional} />
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
          count={Math.ceil(sectionals.length / rowsPerPage)}
          onChange={handleChangePage}
        />
      </Box>
    </>
  );
}
