import { useCallback } from 'react';
import { upperFirst } from 'es-toolkit';

import Chip from '@mui/material/Chip';

import { chipProps, FiltersBlock, FiltersResult } from 'src/components/filters-result';

import { etiquetaDeCategoria } from './product-table-row';

// ----------------------------------------------------------------------

const FILTER_LABELS = {
  'in stock': 'En existencia',
  'low stock': 'Pocas existencias',
  'out of stock': 'Sin existencias',
  general: 'General',
  restringido: 'Restringido',
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

  const handleRemoveCategoria = useCallback(
    (inputValue) => {
      const newValue = (currentFilters.categoria || []).filter((item) => item !== inputValue);

      updateFilters({ categoria: newValue });
    },
    [updateFilters, currentFilters.categoria]
  );

  const handleRemoveRenglon = useCallback(
    (inputValue) => {
      const newValue = currentFilters.renglon.filter((item) => item !== inputValue);

      updateFilters({ renglon: newValue });
    },
    [updateFilters, currentFilters.renglon]
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

      <FiltersBlock label="Categoría:" isShow={!!currentFilters.categoria?.length}>
        {(currentFilters.categoria || []).map((item) => (
          <Chip
            {...chipProps}
            key={item}
            // La misma etiqueta que bajo el nombre del producto.
            label={etiquetaDeCategoria(item)}
            onDelete={() => handleRemoveCategoria(item)}
          />
        ))}
      </FiltersBlock>

      <FiltersBlock label="Renglón:" isShow={!!currentFilters.renglon.length}>
        {currentFilters.renglon.map((item) => (
          <Chip
            {...chipProps}
            key={item}
            label={FILTER_LABELS[item] || upperFirst(item)}
            onDelete={() => handleRemoveRenglon(item)}
          />
        ))}
      </FiltersBlock>
    </FiltersResult>
  );
}
