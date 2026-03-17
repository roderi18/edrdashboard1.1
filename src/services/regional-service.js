const STORAGE_KEY = 'regionals';

export const getRegionals = () => {
    if (typeof window === 'undefined') return [];

    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (error) {
        console.error('Error reading regionals from localStorage:', error);
        return [];
    }
};

export const saveRegional = (regional) => {
    if (typeof window === 'undefined') return regional;

    const stored = getRegionals();
    const updated = [...stored, regional];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return regional;
};

export const updateRegional = (updatedRegional) => {
    if (typeof window === 'undefined') return updatedRegional;

    const stored = getRegionals();
    const updated = stored.map((item) =>
        item.id === updatedRegional.id ? updatedRegional : item
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return updatedRegional;
};

export const deleteRegional = (regionalId) => {
    if (typeof window === 'undefined') return;

    const stored = getRegionals();
    const updated = stored.filter((item) => item.id !== regionalId);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};