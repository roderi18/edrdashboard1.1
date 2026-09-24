import { CompactEntityCardList } from 'src/sections/common/compact-entity-card-list';

import { NationalCard } from './national-card';

// ----------------------------------------------------------------------

export function NationalCardList({ nationals, canManage = true, loading = false }) {
  return (
    <CompactEntityCardList
      items={nationals}
      loading={loading}
      renderCard={(national) => (
        <NationalCard key={national.id} national={national} canManage={canManage} />
      )}
    />
  );
}
