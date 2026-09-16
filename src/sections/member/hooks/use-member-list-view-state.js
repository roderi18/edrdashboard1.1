import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

import { useTheme, useMediaQuery } from '@mui/material';

import { useTable } from 'src/components/table';

export function useMemberListViewState() {
  const searchParams = useSearchParams();
  const pageFromUrl = Math.max(0, (Number(searchParams.get('p')) || 1) - 1);
  const table = useTable({ defaultCurrentPage: pageFromUrl });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [selectedDisplayMode, setSelectedDisplayMode] = useState(null);
  const displayMode = selectedDisplayMode || (isMobile ? 'grid' : 'panel');

  const setDisplayMode = useCallback((nextMode) => {
    setSelectedDisplayMode(nextMode);
  }, []);

  const syncPageInUrl = useCallback((zeroBasedPage) => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);

    if (zeroBasedPage > 0) {
      params.set('p', String(zeroBasedPage + 1));
    } else {
      params.delete('p');
    }

    const queryString = params.toString();

    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${queryString ? `?${queryString}` : ''}`
    );
  }, []);

  const handleChangePage = useCallback(
    (event, newPage) => {
      table.onChangePage(event, newPage);
      syncPageInUrl(newPage);
    },
    [table, syncPageInUrl]
  );

  const handleChangeCardPage = useCallback(
    (event, newPage) => handleChangePage(event, newPage - 1),
    [handleChangePage]
  );

  const handleResetPage = useCallback(() => {
    table.onResetPage();
    syncPageInUrl(0);
  }, [table, syncPageInUrl]);

  return {
    table,
    isMobile,
    displayMode,
    setDisplayMode,
    pageFromUrl,
    handleChangePage,
    handleChangeCardPage,
    handleResetPage,
    memberIdFromUrl: searchParams.get('member'),
    destFromUrl: searchParams.get('dest'),
    sectionFromUrl: searchParams.get('sectional'),
  };
}
