import { useRef, useState, useEffect, useCallback } from 'react';

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
  // EN EL TELÉFONO, SCROLL INFINITO. Los números de página obligaban a subir,
  // pulsar y volver a bajar; como en cualquier red social, al acercarse al final
  // se añade la página siguiente. `page` pasa a ser "cuántas páginas hay
  // cargadas", así que la vista que la guarda en la URL (Miembros) sigue
  // devolviendo al mismo sitio al volver atrás. En pantalla grande, paginación.
  const esTelefono = useMediaQuery(theme.breakpoints.down('md'));
  const centinelaRef = useRef(null);
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

  const pageItems = esTelefono
    ? items.slice(0, page * effectiveRowsPerPage)
    : items.slice((page - 1) * effectiveRowsPerPage, page * effectiveRowsPerPage);
  const quedanMas = esTelefono && !loading && page < pageCount;

  useEffect(() => {
    const centinela = centinelaRef.current;
    if (!quedanMas || !centinela || typeof IntersectionObserver === 'undefined') return undefined;

    // 600 px antes del final: la página siguiente ya está pintada al llegar.
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) handleChangePage(null, page + 1);
      },
      { rootMargin: '600px 0px' }
    );

    observador.observe(centinela);

    return () => observador.disconnect();
  }, [quedanMas, page, handleChangePage]);

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

        {quedanMas && [0, 1].map((indice) => <CompactEntityCardSkeleton key={`mas-${indice}`} />)}
      </Box>

      {quedanMas && <Box ref={centinelaRef} aria-hidden sx={{ height: 1 }} />}

      {!esTelefono && !loading && items.length > effectiveRowsPerPage && (
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
