import { REGIONALS, SECTIONALS, DESTS } from 'src/_mock/assets';

/**
 * Resuelve la Regional a la que pertenece un miembro
 * recorriendo la jerarquía:
 *
 * member → regionalId directo
 * member → sectionalId → regionalId
 * member → destId → sectionalId → regionalId
 */

export function resolveRegionalFromMember(member) {
    if (!member) return null;

    // 1️⃣ Si tiene regionalId directo
    if (member.regionalId) {
        const regional = REGIONALS.find((r) => r.id === member.regionalId);
        if (regional) return regional;
    }

    // 2️⃣ Si tiene sectionalId
    if (member.sectionalId) {
        const sectional = SECTIONALS.find((s) => s.id === member.sectionalId);
        if (sectional) {
            const regional = REGIONALS.find((r) => r.id === sectional.regionalId);
            if (regional) return regional;
        }
    }

    // 3️⃣ Si tiene destId
    if (member.destId) {
        const dest = DESTS.find((d) => d.id === member.destId);
        if (dest) {
            const sectional = SECTIONALS.find((s) => s.id === dest.sectionalId);
            if (sectional) {
                const regional = REGIONALS.find((r) => r.id === sectional.regionalId);
                if (regional) return regional;
            }
        }
    }

    return null;
}