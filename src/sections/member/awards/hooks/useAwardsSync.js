'use client';

import dayjs from 'dayjs';
import { useEffect } from 'react';

import { getAwardsProgressCache } from 'src/services/awards-progress-cache';

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
        if (typeof window === 'undefined') return undefined;
        if (!memberId || !rowId) return undefined;

        const sync = () => {
            const { status: statusData = {}, data = {} } = getAwardsProgressCache(memberId);

            if (system === 'sistemaAscenso') {
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

        return () => {
            window.removeEventListener('awards-status-changed', sync);
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
