import { CompactEntityCardList } from 'src/sections/common/compact-entity-card-list';

import { NationalCard } from './national-card';

// ----------------------------------------------------------------------

export function NationalCardList({ nationals, canManage = true }) {
  return (
    <CompactEntityCardList
      items={nationals}
      renderCard={(national) => (
        <NationalCard key={national.id} national={national} canManage={canManage} />
      )}
    />
  );
}
