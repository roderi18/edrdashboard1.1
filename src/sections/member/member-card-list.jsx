import { CompactEntityCardList } from 'src/sections/common/compact-entity-card-list';

import { MemberCard } from './member-card';

// ----------------------------------------------------------------------

export function MemberCardList({
  members,
  dests = [],
  loading = false,
  memberPhotoUrls = {},
  page,
  onPageChange,
}) {
  return (
    <CompactEntityCardList
      items={members}
      loading={loading}
      page={page}
      onPageChange={onPageChange}
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
