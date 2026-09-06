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
  page: pageProp,
  onPageChange,
}) {
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));
  const [internalPage, setInternalPage] = useState(1);
  // Cuando la vista dueña de la lista guarda la pagina (p. ej. en la URL, para
  // que volver atras no devuelva al usuario a la #1) manda ella; si no, la
  // paginacion se sigue llevando aqui dentro como siempre.
  const isControlled = pageProp !== undefined && pageProp !== null;
  const effectiveRowsPerPage = rowsPerPage || (isLargeScreen ? 18 : 12);
  const effectiveSkeletonCount = skeletonCount || effectiveRowsPerPage;
  const pageCount = Math.max(1, Math.ceil(items.length / effectiveRowsPerPage));
  const page = Math.min(isControlled ? pageProp : internalPage, pageCount);

  useEffect(() => {
    if (isControlled) return;

    setInternalPage(1);
  }, [isControlled, effectiveRowsPerPage, items.length, loading]);

  const handleChangePage = useCallback(
    (event, newPage) => {
      if (isControlled) {
        onPageChange?.(event, newPage);
        return;
      }

      setInternalPage(newPage);
    },
    [isControlled, onPageChange]
  );

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
            count={pageCount}
            onChange={handleChangePage}
          />
        </Box>
      )}
    </Box>
  );
}
