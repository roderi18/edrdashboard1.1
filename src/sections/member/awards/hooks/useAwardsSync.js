'use client';

import dayjs from 'dayjs';
import { useEffect } from 'react';

import { getAwardsProgressCache } from 'src/services/awards-progress-cache';

// Busca el nodo de un ítem por su id recorriendo todas las divisiones/grupos del
// caché. Sirve de respaldo cuando la ruta división→grupo→ítem no coincide (p. ej.
// si al guardar en Firebase la división/grupo quedó vacía o distinta).
const findNodeByItemId = (tree = {}, itemId) => {
    if (!tree || !itemId) return null;

    // Academia: { [groupId]: { [itemId]: node } }
    // Sistema de Ascenso: { [divisionId]: { [groupId]: { [itemId]: node } } }
    const stack = [tree];

    while (stack.length) {
        const current = stack.pop();
        if (!current || typeof current !== 'object') continue;

        if (current[itemId] && current[itemId].status !== undefined) {
            return current[itemId];
        }

        Object.values(current).forEach((value) => {
            if (value && typeof value === 'object') stack.push(value);
        });
    }

    return null;
};

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
                    data?.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId] ||
                    findNodeByItemId(data?.sistemaAscenso, rowId);

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
                    data?.academia?.[parentId]?.[rowId] ||
                    findNodeByItemId(data?.academia, rowId);

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
