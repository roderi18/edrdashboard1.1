import Chip from '@mui/material/Chip';

import { chipProps, FiltersBlock, FiltersResult } from 'src/components/filters-result';

// ----------------------------------------------------------------------

const getOptionLabel = (options, value) =>
  options?.find((option) => String(option.value) === String(value))?.label || value;

export function CompactEntityFiltersResult({ filters, configs, onResetPage, totalResults, sx }) {
  const { state: currentFilters, setState: updateFilters, resetState: resetFilters } = filters;

  const handleReset = () => {
    onResetPage();
    resetFilters();
  };

  const handleRemoveSingle = (name, resetValue) => {
    onResetPage();
    updateFilters({ [name]: resetValue });
  };

  const handleRemoveArrayItem = (name, inputValue) => {
    const currentValue = currentFilters[name];

    onResetPage();
    updateFilters({
      [name]: Array.isArray(currentValue)
        ? currentValue.filter((item) => item !== inputValue)
        : [],
    });
  };

  return (
    <FiltersResult totalResults={totalResults} onReset={handleReset} sx={sx}>
      {configs.map((config) => {
        const value = currentFilters[config.name];
        const isArray = Array.isArray(value);
        const arrayValue = isArray ? value : [];
        const isShow =
          config.isShow ??
          (isArray
            ? value.length > 0
            : value !== undefined && value !== config.resetValue && !!value);

        return (
          <FiltersBlock key={config.name} label={config.label} isShow={isShow}>
            {isArray ? (
              arrayValue.map((item, index) => (
                <Chip
                  {...chipProps}
                  key={`${config.name}-${item}-${index}`}
                  label={config.getLabel?.(item) ?? getOptionLabel(config.options, item)}
                  onDelete={() => handleRemoveArrayItem(config.name, item)}
                />
              ))
            ) : (
              <Chip
                {...chipProps}
                label={config.getLabel?.(value) ?? getOptionLabel(config.options, value)}
                onDelete={() => handleRemoveSingle(config.name, config.resetValue)}
                sx={config.chipSx}
              />
            )}
          </FiltersBlock>
        );
      })}
    </FiltersResult>
  );
}
