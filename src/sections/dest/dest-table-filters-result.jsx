import { useCallback } from 'react';

import Chip from '@mui/material/Chip';

import { chipProps, FiltersBlock, FiltersResult } from 'src/components/filters-result';

// ----------------------------------------------------------------------

export function DestTableFiltersResult({ filters, onResetPage, totalResults, sx }) {
  const { state: currentFilters, setState: updateFilters, resetState: resetFilters } = filters;

  const handleRemoveKeyword = useCallback(() => {
    onResetPage();
    updateFilters({ name: '' });
  }, [onResetPage, updateFilters]);

  const handleRemoveRegionalFullName = useCallback(() => {
    onResetPage();
    updateFilters({ regionalName: 'all' });
  }, [onResetPage, updateFilters]);

  const handleRemoveDestMembership = useCallback(
    (inputValue) => {
      const newValue = currentFilters.sectionalName.filter((item) => item !== inputValue);

      onResetPage();
      updateFilters({ sectionalName: newValue });
    },
    [onResetPage, updateFilters, currentFilters.sectionalName]
  );

  const getSectionalNameById = (name) => name;

  const handleReset = useCallback(() => {
    onResetPage();
    resetFilters();
  }, [onResetPage, resetFilters]);

  return (
    <FiltersResult totalResults={totalResults} onReset={handleReset} sx={sx}>
      <FiltersBlock label="Región:" isShow={currentFilters.regionalName !== 'all'}>
        <Chip
          {...chipProps}
          label={currentFilters.regionalName}
          onDelete={handleRemoveRegionalFullName}
          sx={{ textTransform: 'capitalize' }}
        />
      </FiltersBlock>

      <FiltersBlock label="Sección:" isShow={!!currentFilters.sectionalName.length}>
        {currentFilters.sectionalName.map((item) => (
          <Chip
            {...chipProps}
            key={item}
            label={item}
            onDelete={() => handleRemoveDestMembership(item)}
          />
        ))}
      </FiltersBlock>


      <FiltersBlock label="Keyword:" isShow={!!currentFilters.name}>
        <Chip {...chipProps} label={currentFilters.name} onDelete={handleRemoveKeyword} />
      </FiltersBlock>
    </FiltersResult>
  );
}
