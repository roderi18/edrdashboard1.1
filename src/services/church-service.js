export const saveChurch = (church) => {
    const stored = JSON.parse(localStorage.getItem('churches') || '[]');

    const updated = [...stored, church];

    localStorage.setItem('churches', JSON.stringify(updated));

    return church;
};