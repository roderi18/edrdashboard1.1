import { CompactEntityCardList } from 'src/sections/common/compact-entity-card-list';

import { RegionalCard } from './regional-card';

// ----------------------------------------------------------------------

export function RegionalCardList({ regionals, canManage = true }) {
  return (
    <CompactEntityCardList
      items={regionals}
      renderCard={(regional) => (
        <RegionalCard key={regional.id} regional={regional} canManage={canManage} />
      )}
    />
  );
}
