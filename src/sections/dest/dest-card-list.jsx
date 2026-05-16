import { CompactEntityCardList } from 'src/sections/common/compact-entity-card-list';

import { DestCard } from './dest-card';

// ----------------------------------------------------------------------

export function DestCardList({ dests }) {
  return (
    <CompactEntityCardList
      items={dests}
      renderCard={(dest) => (
        <DestCard key={`${dest.id || dest.idDestacamento}-${dest.name}`} dest={dest} />
      )}
    />
  );
}
