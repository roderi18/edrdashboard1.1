const STORAGE_KEY = 'sectionals';

export const getSectionals = () => {
    if (typeof window === 'undefined') return [];

    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (error) {
        console.error('Error reading sectionals from localStorage:', error);
        return [];
    }
};

export const saveSectional = (sectional) => {
    if (typeof window === 'undefined') return sectional;

    const stored = getSectionals();
    const updated = [...stored, sectional];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return sectional;
};

export const updateSectional = (updatedSectional) => {
    if (typeof window === 'undefined') return updatedSectional;

    const stored = getSectionals();
    const updated = stored.map((item) =>
        item.id === updatedSectional.id ? updatedSectional : item
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return updatedSectional;
};

export const deleteSectional = (sectionalId) => {
    if (typeof window === 'undefined') return;

    const stored = getSectionals();
    const updated = stored.filter((item) => item.id !== sectionalId);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};