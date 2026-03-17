'use client';

import { useEffect } from 'react';
import dayjs from 'dayjs';

export function useAwardsSync({
    system,        // 'sistemaAscenso' | 'academia'
    memberId,
    context,       // { sectionId?, parentId, rowId }
    setStatus,
    setCompletedDate,
    setTimesCompleted,
    hasCertificate,
    certificateFile,
    setHasCertificate,
    setCertificateFile,
    onCertificateUploaded,
    onCertificateDeleted,
}) {

    const sectionId = context?.sectionId ?? null;
    const parentId = context?.parentId ?? null;
    const rowId = context?.rowId ?? null;


    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!memberId || !rowId) return;

        const statusKey = `awards-status-${memberId}`;
        const dataKey = `awards-data-${memberId}`;

        const sync = () => {
            const statusData = JSON.parse(localStorage.getItem(statusKey) || '{}');
            const data = JSON.parse(localStorage.getItem(dataKey) || '{}');

            if (system === 'sistemaAscenso') {
                const { sectionId, parentId, rowId } = context;
                // const ROOT = 'sistema-de-ascenso';
                const ROOT = 'sistemaAscenso';

                const nextStatus =
                    statusData?.[ROOT]?.[sectionId]?.[parentId]?.[rowId];

                // if (nextStatus) setStatus(nextStatus);
                if (nextStatus) setStatus(nextStatus);

                const node =
                    data?.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId];

                if (!node) return;

                if (node.completedDate) {
                    setCompletedDate(dayjs(node.completedDate));
                }

                if (typeof node.timesCompleted === 'number') {
                    setTimesCompleted(node.timesCompleted);
                }

                if (node.certificate) {
                    setHasCertificate(true);
                    setCertificateFile(node.certificate);
                } else {
                    setHasCertificate(false);
                    setCertificateFile(null);
                }
            }

            if (system === 'academia') {
                const { parentId, rowId } = context;

                const nextStatus =
                    statusData?.academia?.[parentId]?.[rowId];

                if (nextStatus) setStatus(nextStatus);

                const node =
                    data?.academia?.[parentId]?.[rowId];

                if (!node) return;

                if (node.completedDate) {
                    setCompletedDate(dayjs(node.completedDate));
                }

                if (node.certificate) {
                    setHasCertificate(true);
                    setCertificateFile(node.certificate);
                } else {
                    setHasCertificate(false);
                    setCertificateFile(null);
                }
            }
        };

        sync();

        window.addEventListener('awards-status-changed', sync);
        window.addEventListener('storage', sync);

        return () => {
            window.removeEventListener('awards-status-changed', sync);
            window.removeEventListener('storage', sync);
        };
    }, [
        system,
        memberId,
        sectionId,
        parentId,
        rowId,
    ]);
    useEffect(() => {
        if (hasCertificate && certificateFile) {
            onCertificateUploaded?.(certificateFile);
        }

        if (!hasCertificate) {
            onCertificateDeleted?.();
        }
    }, [hasCertificate, certificateFile]);

}
