import { getMembers } from 'src/services/member-service';

export async function generateMemberId() {

    const members = await getMembers();

    const numbers = (Array.isArray(members) ? members : [])
        .map((m) => {
            if (!m.memberId) return null;

            const parts = m.memberId.split('-');
            const number = Number(parts[2]);

            return isNaN(number) ? null : number;
        })
        .filter(Boolean);

    const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 10001;

    return `DO-SD-${String(nextNumber).padStart(5, '0')}`;
}