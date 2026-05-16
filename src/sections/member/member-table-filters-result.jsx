import { CompactEntityFiltersResult } from 'src/sections/common/compact-entity-filters-result';

// ----------------------------------------------------------------------

export function MemberTableFiltersResult({ filters, options, onResetPage, totalResults, sx }) {
  return (
    <CompactEntityFiltersResult
      filters={filters}
      totalResults={totalResults}
      onResetPage={onResetPage}
      sx={sx}
      configs={[
        { name: 'memberDivision', label: 'División:' },
        { name: 'destName', label: 'Destacamento:', options: options?.destName },
        { name: 'memberPosition', label: 'Posición:', options: options?.memberPosition },
        { name: 'sectionalId', label: 'Sección:', options: options?.sectionalId },
        { name: 'name', label: 'Keyword:', resetValue: '' },
      ]}
    />
  );
}
