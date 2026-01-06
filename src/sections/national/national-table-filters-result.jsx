import { useCallback } from 'react';

import Chip from '@mui/material/Chip';

import { chipProps, FiltersBlock, FiltersResult } from 'src/components/filters-result';

// ----------------------------------------------------------------------

export function NationalTableFiltersResult({ filters, onResetPage, totalResults, sx }) {
  const { state: currentFilters, setState: updateFilters, resetState: resetFilters } = filters;

  const handleRemoveKeyword = useCallback(() => {
    onResetPage();
    updateFilters({ name: '' });
  }, [onResetPage, updateFilters]);

  const handleRemoveStatus = useCallback(() => {
    onResetPage();
    updateFilters({ status: 'all' });
  }, [onResetPage, updateFilters]);

  const handleRemoveRole = useCallback(
    (inputValue) => {
      const newValue = currentFilters.nationalXMemberPosition.filter((item) => item !== inputValue);

      onResetPage();
      updateFilters({ nationalXMemberPosition: newValue });
    },
    [onResetPage, updateFilters, currentFilters.nationalXMemberPosition]
  );

  const handleRemoveEstructure = useCallback(
    (inputValue) => {
      const newValue = currentFilters.nationalEstructure.filter((item) => item !== inputValue);

      onResetPage();
      updateFilters({ nationalEstructure: newValue });
    },
    [onResetPage, updateFilters, currentFilters.nationalEstructure]
  );

  const handleReset = useCallback(() => {
    onResetPage();
    resetFilters();
  }, [onResetPage, resetFilters]);

  return (
    <FiltersResult totalResults={totalResults} onReset={handleReset} sx={sx}>
      <FiltersBlock label="Status:" isShow={currentFilters.status !== 'all'}>
        <Chip
          {...chipProps}
          label={currentFilters.status}
          onDelete={handleRemoveStatus}
          sx={{ textTransform: 'capitalize' }}
        />
      </FiltersBlock>

      <FiltersBlock label="Posición" isShow={!!currentFilters.nationalXMemberPosition.length}>
        {currentFilters.nationalXMemberPosition.map((item) => (
          <Chip {...chipProps} key={item} label={item} onDelete={() => handleRemoveRole(item)} />
        ))}
      </FiltersBlock>

      <FiltersBlock label="Estructura" isShow={!!currentFilters.nationalEstructure.length}>
        {currentFilters.nationalEstructure.map((item, index) => (
          <Chip
            {...chipProps}
            key={`${item}-${index}`}
            label={item}
            onDelete={() => handleRemoveEstructure(item)}
          />
        ))}
      </FiltersBlock>

      <FiltersBlock label="Keyword:" isShow={!!currentFilters.name}>
        <Chip {...chipProps} label={currentFilters.name} onDelete={handleRemoveKeyword} />
      </FiltersBlock>
    </FiltersResult>
  );
}
