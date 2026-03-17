import { useCallback } from 'react';
import { resolveById } from 'src/utils/resolve-display-name';
import { DESTS, SECTIONALS } from 'src/_mock/assets';

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
    updateFilters({ sectionalName: 'all' });
  }, [onResetPage, updateFilters]);

  const handleRemoveState = useCallback(() => {
    onResetPage();
    updateFilters({ sectionalName: [] });
  }, [onResetPage, updateFilters]);

  const handleRemovedestName = useCallback(
    (inputValue) => {
      onResetPage();
      updateFilters({
        destName: currentFilters.destName.filter((item) => item !== inputValue),
      });
    },
    [onResetPage, updateFilters, currentFilters.destName]
  );

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
        {/* {currentFilters.memberDivision.map((item) => ( */}
        {currentFilters.memberDivision.map((item, index) => (
          <Chip
            {...chipProps}
            // key={item
            key={`division-${item}-${index}`}
            label={item}
            onDelete={() =>
              updateFilters({
                memberDivision: currentFilters.memberDivision.filter((d) => d !== item),
              })
            }
          />
        ))}
      </FiltersBlock>

      <FiltersBlock label="Destacamento:" isShow={!!currentFilters.destName.length}>
        {/* {currentFilters.destName.map((item) => ( */}
        {currentFilters.destName.map((item, index) => (
          <Chip
            {...chipProps}
            key={`dest-${item}-${index}`}
            label={resolveById(DESTS, item)}
            onDelete={() => handleRemovedestName(item)}
          />
        ))}
      </FiltersBlock>


      <FiltersBlock label="Posición:" isShow={!!currentFilters.memberPosition.length}>
        {currentFilters.memberPosition.map((item) => (
          <Chip {...chipProps} key={item} label={item} onDelete={() => handleRemoveRole(item)} />
        ))}
      </FiltersBlock>

      <FiltersBlock label="Sección:" isShow={currentFilters.sectionalId.length > 0}>
        {currentFilters.sectionalId.map((item) => (
          <Chip
            {...chipProps}
            key={item}
            label={resolveById(SECTIONALS, item)}
            onDelete={() => handleRemoveState(item)}
          />
        ))}
      </FiltersBlock>



      <FiltersBlock label="Keyword:" isShow={!!currentFilters.name}>
        <Chip {...chipProps} label={currentFilters.name} onDelete={handleRemoveKeyword} />
      </FiltersBlock>
    </FiltersResult>
  );
}
