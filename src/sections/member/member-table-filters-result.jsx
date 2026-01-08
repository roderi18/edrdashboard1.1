import { useCallback } from 'react';

import Chip from '@mui/material/Chip';

import { chipProps, FiltersBlock, FiltersResult } from 'src/components/filters-result';

// ----------------------------------------------------------------------

export function MemberTableFiltersResult({ filters, onResetPage, totalResults, sx }) {
  const { state: currentFilters, setState: updateFilters, resetState: resetFilters } = filters;

  const handleRemoveKeyword = useCallback(() => {
    onResetPage();
    updateFilters({ name: '' });
  }, [onResetPage, updateFilters]);

  const handleRemoveSectionalFullName = useCallback(() => {
    onResetPage();
    updateFilters({ sectionalFullName: 'all' });
  }, [onResetPage, updateFilters]);

  const handleRemoveState = useCallback(() => {
    onResetPage();
    updateFilters({ sectionalFullName: [] });
  }, [onResetPage, updateFilters]);

  const handleRemoveRole = useCallback(
    (inputValue) => {
      const newValue = currentFilters.memberPosition.filter((item) => item !== inputValue);

      onResetPage();
      updateFilters({ memberPosition: newValue });
    },
    [onResetPage, updateFilters, currentFilters.memberPosition]
  );

  const handleReset = useCallback(() => {
    onResetPage();
    resetFilters();
  }, [onResetPage, resetFilters]);

  return (
    <FiltersResult totalResults={totalResults} onReset={handleReset} sx={sx}>
      <FiltersBlock label="División:" isShow={currentFilters.memberDivision.length > 0}>
        {currentFilters.memberDivision.map((item) => (
          <Chip
            {...chipProps}
            key={item}
            label={item}
            onDelete={() =>
              updateFilters({
                memberDivision: currentFilters.memberDivision.filter((d) => d !== item),
              })
            }
          />
        ))}
      </FiltersBlock>


      <FiltersBlock label="Posición:" isShow={!!currentFilters.memberPosition.length}>
        {currentFilters.memberPosition.map((item) => (
          <Chip {...chipProps} key={item} label={item} onDelete={() => handleRemoveRole(item)} />
        ))}
      </FiltersBlock>

      {/* <FiltersBlock label="Estado" isShow={currentFilters.status && currentFilters.status !== 'all'}>
        <Chip
          {...chipProps}
          label={currentFilters.status}
          onDelete={handleRemoveState}
          sx={{ textTransform: 'capitalize' }}
        />
      </FiltersBlock> */}

      <FiltersBlock label="Sección:" isShow={currentFilters.sectionalFullName.length > 0}>
        {currentFilters.sectionalFullName.map((item) => (
          <Chip
            {...chipProps}
            key={item}
            label={item}
            onDelete={() => handleRemoveState(item)}
            sx={{ textTransform: 'capitalize' }}
          />
        ))}
      </FiltersBlock>


      <FiltersBlock label="Keyword:" isShow={!!currentFilters.name}>
        <Chip {...chipProps} label={currentFilters.name} onDelete={handleRemoveKeyword} />
      </FiltersBlock>
    </FiltersResult>
  );
}
