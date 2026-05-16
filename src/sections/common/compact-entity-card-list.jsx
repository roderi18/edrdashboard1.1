import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';
import { useTheme, useMediaQuery } from '@mui/material';

import { CompactEntityCardSkeleton } from './compact-entity-card';

// ----------------------------------------------------------------------

export function CompactEntityCardList({
  items,
  loading = false,
  rowsPerPage,
  renderCard,
  skeletonCount,
}) {
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));
  const [page, setPage] = useState(1);
  const effectiveRowsPerPage = rowsPerPage || (isLargeScreen ? 18 : 12);
  const effectiveSkeletonCount = skeletonCount || effectiveRowsPerPage;

  useEffect(() => {
    setPage(1);
  }, [effectiveRowsPerPage, items.length, loading]);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const pageItems = items.slice(
    (page - 1) * effectiveRowsPerPage,
    page * effectiveRowsPerPage
  );

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
          ? Array.from({ length: effectiveSkeletonCount }, (_, index) => (
              <CompactEntityCardSkeleton key={index} />
            ))
          : pageItems.map(renderCard)}
      </Box>

      {!loading && items.length > effectiveRowsPerPage && (
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
            count={Math.ceil(items.length / effectiveRowsPerPage)}
            onChange={handleChangePage}
          />
        </Box>
      )}
    </Box>
  );
}
