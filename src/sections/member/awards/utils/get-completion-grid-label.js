import dayjs from 'dayjs';

export function getCompletionGridLabel(file) {
    if (typeof window === 'undefined') return 'No completado';

    const statusRaw = localStorage.getItem(`awards-status-${file.memberId}`);
    const dataRaw = localStorage.getItem(`awards-data-${file.memberId}`);

    if (!statusRaw || !dataRaw) return 'No completado';

    const statusData = JSON.parse(statusRaw);
    const data = JSON.parse(dataRaw);

    let isCompleted = false;
    let completedDate = null;

    const walkStatus = (node) => {
        if (!node || typeof node !== 'object') return;

        Object.entries(node).forEach(([k, v]) => {
            if (k === file.id && v === 'completado') isCompleted = true;
            else if (typeof v === 'object') walkStatus(v);
        });
    };

    const walkDate = (node) => {
        if (!node || typeof node !== 'object') return;

        Object.entries(node).forEach(([k, v]) => {
            if (k === file.id && v?.completedDate) completedDate = v.completedDate;
            else if (typeof v === 'object') walkDate(v);
        });
    };

    walkStatus(statusData);
    walkDate(data);

    if (isCompleted && completedDate) {
        return `Completado en fecha ${dayjs(completedDate).format('DD/MM/YYYY')}`;
    }

    return 'No completado';
}
