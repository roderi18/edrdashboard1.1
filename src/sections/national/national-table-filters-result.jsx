import { CompactEntityFiltersResult } from 'src/sections/common/compact-entity-filters-result';

// ----------------------------------------------------------------------

export function NationalTableFiltersResult({ filters, options, onResetPage, totalResults, sx }) {
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
        {
          name: 'nationalXMemberPosition',
          label: 'Posición',
          options: options?.nationalXMemberPosition,
        },
        {
          name: 'nationalEstructure',
          label: 'Nivel organizacional',
          options: options?.nationalEstructure,
        },
        { name: 'name', label: 'Keyword:', resetValue: '' },
      ]}
    />
  );
}
