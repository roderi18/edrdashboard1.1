import { LEADERSHIP_ASSIGNMENTS } from 'src/_mock/leadershipAssignments';
import { _allLeadershipRoles } from 'src/_mock/_leadership';

export function getMemberLeadership(memberId) {


    const leadership = LEADERSHIP_ASSIGNMENTS.find(
        (l) =>
            l.memberId === memberId &&
            (l.status === 'active' || !l.status)
    );


    if (!leadership) return 'N/A';

    const roleInfo = _allLeadershipRoles.find(
        (r) => r.value === leadership.role
    );


    return roleInfo?.label || leadership.role;
}