import dayjs from 'dayjs';

import { getAwardsProgressCache } from 'src/services/awards-progress-cache';

export function getCompletionGridLabel(file) {
    const { status: statusData = {}, data = {} } = getAwardsProgressCache(file.memberId);

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
