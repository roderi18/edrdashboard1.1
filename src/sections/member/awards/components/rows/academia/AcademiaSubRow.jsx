
import Button from '@mui/material/Button';
import { useEffect, useState } from 'react';

import { useBoolean } from 'minimal-shared/hooks';

import { ConfirmDialog } from 'src/components/custom-dialog';
import { PdfViewerDialog } from 'src/sections/member/awards/components/viewer/PdfViewerDialog';
import { useBorderPulse } from 'src/sections/member/awards/hooks/useBorderPulse';
import { AwardsActionCells } from 'src/sections/member/awards/components/AwardsActionCells';
import { useAwardsSync } from 'src/sections/member/awards/hooks/useAwardsSync';
import { createAwardsActions } from 'src/sections/member/awards/components/core/AwardsActionsCore';

export function AcademiaSubRow({
    memberId,
    rowId,
    parentId,
    completedDate,
    setCompletedDate,

    onCertificateUploaded,
    onCertificateDeleted,
}) {
    const [localStatus, setLocalStatus] = useState('no_iniciado');
    const [certificateFile, setCertificateFile] = useState(null);
    const [hasCertificate, setHasCertificate] = useState(false);
    const [timesCompleted, setTimesCompleted] = useState(0);

    const actions = createAwardsActions({
        system: 'academia',
        memberId,
        context: { parentId, rowId },
    });

    useAwardsSync({
        system: 'academia',
        memberId,
        context: { parentId, rowId },
        setStatus: setLocalStatus,
        setCompletedDate,
        setTimesCompleted, // no se usa en academia, pero se mantiene por compatibilidad
        hasCertificate,
        certificateFile,
        setHasCertificate,
        setCertificateFile,
        onCertificateUploaded,
        onCertificateDeleted,
    });



    const isCompleted = localStatus === 'completado';
    const fileInputId = `cert-upload-${rowId}`;
    const [dateError, setDateError] = useState(false);
    const [highlightUpload, setHighlightUpload] = useState(false);

    const pdfViewer = useBoolean();
    const [pendingStatus, setPendingStatus] = useState(null);
    const confirmDeleteForStatus = useBoolean();

    const statusKey = memberId ? `awards-status-${memberId}` : null;
    const dataKey = memberId ? `awards-data-${memberId}` : null;


    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!dataKey) return;

        const syncCertificate = () => {

            const savedData = JSON.parse(localStorage.getItem(dataKey) || '{}');

            const cert =
                savedData?.academia
                    ?.[parentId]
                    ?.[rowId]
                    ?.certificate;

            if (cert?.fileBase64) {
                setHasCertificate(true);
                setCertificateFile(cert);
            } else {
                setHasCertificate(false);
                setCertificateFile(null);
            }
        };

        syncCertificate();

        window.addEventListener('storage', syncCertificate);

        return () => {
            window.removeEventListener('storage', syncCertificate);
        };
    }, [dataKey, parentId, rowId]);


    const handleCertificateDeleted = () => {
        setHasCertificate(false);
        setCertificateFile(null);
        onCertificateDeleted?.();
    };

    useEffect(() => {
        const handleHighlight = () => {
            setHighlightUpload(true);
            setTimeout(() => setHighlightUpload(false), 2000);
        };

        window.addEventListener('highlight-upload', handleHighlight);

        return () => {
            window.removeEventListener('highlight-upload', handleHighlight);
        };
    }, []);

    useBorderPulse();


    return (
        <>
            {/* Estado */}
            {/* Fecha */}
            {/* Certificado */}
            <AwardsActionCells
                state={{
                    status: localStatus,
                    completedDate,
                    hasCertificate,
                    timesCompleted,
                }}
                actions={actions}
                fileInputId={fileInputId}
                pdfViewer={pdfViewer}
                certificateFile={certificateFile}
                showTimesCompleted={false}
                onRequireDeleteCertificate={(nextStatus) => {
                    setPendingStatus(nextStatus);
                    confirmDeleteForStatus.onTrue();
                }}
            />

            <PdfViewerDialog
                open={pdfViewer.value}
                onClose={pdfViewer.onFalse}
                fileBase64={certificateFile?.fileBase64}
            />

            <ConfirmDialog
                open={confirmDeleteForStatus.value}
                onClose={() => {
                    confirmDeleteForStatus.onFalse();
                    setPendingStatus(null);
                }}
                title="Eliminar certificado"
                content="Has cargado un certificado. Para cambiar el estado debes eliminar el archivo primero. ¿Deseas eliminarlo?"
                action={
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => {
                            const confirmAction = actions.requireCertificateDeletion({
                                hasCertificate,
                                nextStatus: pendingStatus,
                                onConfirm: () => {
                                    setHasCertificate(false);
                                    setCertificateFile(null);
                                    onCertificateDeleted?.();
                                },
                            });

                            confirmAction?.();

                            setPendingStatus(null);
                            confirmDeleteForStatus.onFalse();
                        }}
                    >
                        Eliminar y cambiar estado
                    </Button>
                }
            />

        </>
    );
}
