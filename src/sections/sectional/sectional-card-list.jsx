import { CompactEntityCardList } from 'src/sections/common/compact-entity-card-list';

import { SectionalCard } from './sectional-card';

// ----------------------------------------------------------------------

export function SectionalCardList({ sectionals }) {
  return (
    <CompactEntityCardList
      items={sectionals}
      renderCard={(sectional) => (
        <SectionalCard
          key={sectional.id}
          sectional={sectional}
          disabled={sectional.disabled}
          canViewRegionalDests={sectional.canViewRegionalDests}
        />
      )}
    />
  );
}
