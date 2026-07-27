import { CompactEntityCardList } from 'src/sections/common/compact-entity-card-list';

import { MemberCard } from './member-card';

// ----------------------------------------------------------------------

export function MemberCardList({
  members,
  dests = [],
  loading = false,
  memberPhotoUrls = {},
}) {
  return (
    <CompactEntityCardList
      items={members}
      loading={loading}
      renderCard={(member) => (
        <MemberCard
          key={member.id}
          member={member}
          avatarUrl={memberPhotoUrls[String(member.id)]}
          dests={dests}
        />
      )}
    />
  );
}
