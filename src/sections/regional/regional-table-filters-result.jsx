import { CompactEntityFiltersResult } from 'src/sections/common/compact-entity-filters-result';

// ----------------------------------------------------------------------

export function RegionalTableFiltersResult({ filters, onResetPage, totalResults, sx }) {
  return (
    <CompactEntityFiltersResult
      filters={filters}
      totalResults={totalResults}
      onResetPage={onResetPage}
      sx={sx}
      configs={[
        {
          name: 'status',
          label: 'Status:',
          resetValue: 'all',
          chipSx: { textTransform: 'capitalize' },
        },
        { name: 'role', label: 'Role:' },
        { name: 'regionalXSectionalXDestCount', label: 'Destacamentos:' },
        { name: 'name', label: 'Keyword:', resetValue: '' },
      ]}
    />
  );
}
