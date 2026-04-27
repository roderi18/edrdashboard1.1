import { useCallback } from 'react';
import { upperFirst } from 'es-toolkit';

import Chip from '@mui/material/Chip';

import { chipProps, FiltersBlock, FiltersResult } from 'src/components/filters-result';

// ----------------------------------------------------------------------

const FILTER_LABELS = {
  'in stock': 'En existencia',
  'low stock': 'Pocas existencias',
  'out of stock': 'Sin existencias',
  published: 'Publicado',
  draft: 'Borrador',
};

export function ProductTableFiltersResult({ filters, totalResults, sx }) {
  const { state: currentFilters, setState: updateFilters, resetState: resetFilters } = filters;

  const handleRemoveStock = useCallback(
    (inputValue) => {
      const newValue = currentFilters.stock.filter((item) => item !== inputValue);

      updateFilters({ stock: newValue });
    },
    [updateFilters, currentFilters.stock]
  );

  const handleRemovePublish = useCallback(
    (inputValue) => {
      const newValue = currentFilters.publish.filter((item) => item !== inputValue);

      updateFilters({ publish: newValue });
    },
    [updateFilters, currentFilters.publish]
  );

  return (
    <FiltersResult totalResults={totalResults} onReset={() => resetFilters()} sx={sx}>
      <FiltersBlock label="Existencias:" isShow={!!currentFilters.stock.length}>
        {currentFilters.stock.map((item) => (
          <Chip
            {...chipProps}
            key={item}
            label={FILTER_LABELS[item] || upperFirst(item)}
            onDelete={() => handleRemoveStock(item)}
          />
        ))}
      </FiltersBlock>

      <FiltersBlock label="Publicado:" isShow={!!currentFilters.publish.length}>
        {currentFilters.publish.map((item) => (
          <Chip
            {...chipProps}
            key={item}
            label={FILTER_LABELS[item] || upperFirst(item)}
            onDelete={() => handleRemovePublish(item)}
          />
        ))}
      </FiltersBlock>
    </FiltersResult>
  );
}
