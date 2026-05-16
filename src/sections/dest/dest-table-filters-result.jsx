import { CompactEntityFiltersResult } from 'src/sections/common/compact-entity-filters-result';

// ----------------------------------------------------------------------

export function DestTableFiltersResult({ filters, options, onResetPage, totalResults, sx }) {
  return (
    <CompactEntityFiltersResult
      filters={filters}
      totalResults={totalResults}
      onResetPage={onResetPage}
      sx={sx}
      configs={[
        {
          name: 'regionalName',
          label: 'Región:',
          resetValue: 'all',
          chipSx: { textTransform: 'capitalize' },
        },
        { name: 'sectionalName', label: 'Sección:', options: options?.sectionalName },
        { name: 'name', label: 'Keyword:', resetValue: '' },
      ]}
    />
  );
}
