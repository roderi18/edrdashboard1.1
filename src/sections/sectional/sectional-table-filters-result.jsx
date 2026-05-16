import { CompactEntityFiltersResult } from 'src/sections/common/compact-entity-filters-result';

// ----------------------------------------------------------------------

export function SectionalTableFiltersResult({ filters, onResetPage, totalResults, sx }) {
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
        { name: 'role', label: 'Role:' },
        { name: 'name', label: 'Keyword:', resetValue: '' },
      ]}
    />
  );
}
