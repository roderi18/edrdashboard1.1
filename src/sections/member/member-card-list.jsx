import { isMinorMember } from 'src/utils/member-access';

import { CompactEntityCardList } from 'src/sections/common/compact-entity-card-list';

import { MemberCard } from './member-card';

// ----------------------------------------------------------------------

export function MemberCardList({
  members,
  canManage = true,
  dests = [],
  loading = false,
  memberPhotoUrls = {},
  restrictMinors = false,
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
          canManage={canManage}
          restricted={restrictMinors && isMinorMember(member)}
          dests={dests}
        />
      )}
    />
  );
}
