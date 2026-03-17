const STORAGE_KEY = 'members';

/**
 * Obtener miembros guardados en localStorage
 */
export function getStoredMembers() {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error reading members from localStorage:', error);
        return [];
    }
}

/**
 * Guardar lista completa de miembros
 */
export function setStoredMembers(members) {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
    } catch (error) {
        console.error('Error saving members to localStorage:', error);
    }
}

/**
 * Agregar un miembro nuevo
 */
export function addStoredMember(member) {
    const members = getStoredMembers();
    const updated = [...members, member];
    setStoredMembers(updated);
    return updated;
}

/**
 * Actualizar miembro existente
 */
export function updateStoredMember(updatedMember) {
    const members = getStoredMembers();

    const updated = members.map((member) =>
        member.id === updatedMember.id ? updatedMember : member
    );

    setStoredMembers(updated);
    return updated;
}

/**
 * Eliminar miembro
 */
export function deleteStoredMember(memberId) {
    const members = getStoredMembers();

    const updated = members.filter((member) => member.id !== memberId);

    setStoredMembers(updated);
    return updated;
}

/**
 * Obtener TODOS los miembros (mock + localStorage)
 */
export function getAllMembers(mockMembers = []) {
    const stored = getStoredMembers();
    return [...mockMembers, ...stored];
}