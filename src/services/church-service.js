export const saveChurch = (church) => {
    const stored = JSON.parse(localStorage.getItem('churches') || '[]');

    const updated = [...stored, church];

    localStorage.setItem('churches', JSON.stringify(updated));

    return church;
};

export const getChurches = () => {
    const stored = JSON.parse(localStorage.getItem('churches') || '[]');
    return stored;
};