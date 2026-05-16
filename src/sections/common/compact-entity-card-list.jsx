import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';

import { CompactEntityCardSkeleton } from './compact-entity-card';

// ----------------------------------------------------------------------

export function CompactEntityCardList({
  items,
  loading = false,
  rowsPerPage = 12,
  renderCard,
  skeletonCount = rowsPerPage,
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items.length, loading]);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const pageItems = items.slice((page - 1) * rowsPerPage, page * rowsPerPage);

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
          ? Array.from({ length: skeletonCount }, (_, index) => (
              <CompactEntityCardSkeleton key={index} />
            ))
          : pageItems.map(renderCard)}
      </Box>

      {!loading && items.length > rowsPerPage && (
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
            count={Math.ceil(items.length / rowsPerPage)}
            onChange={handleChangePage}
          />
        </Box>
      )}
    </Box>
  );
}
