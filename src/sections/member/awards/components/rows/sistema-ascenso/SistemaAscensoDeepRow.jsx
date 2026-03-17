import TableCell from '@mui/material/TableCell';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { useBoolean } from 'minimal-shared/hooks';
import { usePopover } from 'minimal-shared/hooks';
import MenuList from '@mui/material/MenuList';
import Divider from '@mui/material/Divider';
import { CustomPopover } from 'src/components/custom-popover';
import { StatusSelectCell } from 'src/sections/member/awards/components/status/StatusSelectCell';
import { CertificateActionCell } from 'src/sections/member/awards/components/certificate/CertificateActionCell';
import { PdfViewerDialog } from 'src/sections/member/awards/components/viewer/PdfViewerDialog';
import { DownloadCertificateMenuItem } from 'src/sections/member/awards/components/certificate/DownloadCertificateMenuItem';
import { CertificateMenuActions } from 'src/sections/member/awards/components/certificate/CertificateMenuActions';
import { AwardsActionCells } from 'src/sections/member/awards/components/AwardsActionCells';
import { useAwardsSync } from 'src/sections/member/awards/hooks/useAwardsSync';
import { createAwardsActions } from 'src/sections/member/awards/components/core/AwardsActionsCore';


export function SistemaAscensoDeepRow({
    memberId,
    rowId,
    parentId,
    sectionId,
    setStatus,
    completedDate,
    setCompletedDate,

    onCertificateUploaded,
    onCertificateDeleted,

}) {


    const [status, setLocalStatus] = useState('no_iniciado');
    const [certificateFile, setCertificateFile] = useState(null);
    const [hasCertificate, setHasCertificate] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [highlightUpload, setHighlightUpload] = useState(false);
    const [dateError, setDateError] = useState(false);
    const [timesCompleted, setTimesCompleted] = useState(0);

    const isCompleted = status === 'completado';
    const pdfViewer = useBoolean();
    if (typeof window === 'undefined') return null;

    const confirmDeleteForStatus = useBoolean();
    const menuActions = usePopover();

    const fileInputId = `cert-upload-${rowId}`;
    const statusKey = memberId ? `awards-status-${memberId}` : null;
    const dataKey = memberId ? `awards-data-${memberId}` : null;


    const [view, setView] = useState('year');


    const getRowData = (data) =>
        data?.sistemaAscenso
        ?.[sectionId]
        ?.[parentId]
        ?.[rowId] || {};

    const actions = createAwardsActions({
        system: 'sistemaAscenso',
        memberId,
        context: {
            sectionId,
            parentId,
            rowId,
        },
    });

    useAwardsSync({
        system: 'sistemaAscenso',
        memberId,
        context: { sectionId, parentId, rowId },
        setStatus: setLocalStatus,
        setCompletedDate,
        setTimesCompleted,
        hasCertificate,
        certificateFile,
        setHasCertificate,
        setCertificateFile,
        onCertificateUploaded,
        onCertificateDeleted,
    });


    const updateTimesCompleted = (value) => {
        const next = Math.min(10, Math.max(0, value));
        setTimesCompleted(next);
        const now = new Date().toISOString();

        if (!dataKey) return;
        const currentData = JSON.parse(localStorage.getItem(dataKey) || '{}');

        const updatedData = {
            ...currentData,
            sistemaAscenso: {
                ...(currentData.sistemaAscenso || {}),
                [sectionId]: {
                    ...((currentData.sistemaAscenso || {})[sectionId] || {}),
                    [parentId]: {
                        ...(((currentData.sistemaAscenso || {})[sectionId] || {})[parentId] || {}),
                        updatedAt: now, // actualiza Exploradores / Seguidores / etc
                        [rowId]: {
                            ...((((currentData.sistemaAscenso || {})[sectionId] || {})[parentId] || {})[rowId] || {}),
                            timesCompleted: next,
                            updatedAt: now,
                        },

                    },
                },
            },
        };

        console.log('[updateTimesCompleted] SAVE', {
            memberId,
            dataKey,
            sectionId,
            parentId,
            rowId,
        });



        // localStorage.setItem(dataKey, JSON.stringify(updatedData));
        localStorage.setItem(dataKey, JSON.stringify(updatedData));
    };


    const borderPulseKeyframes = `
@keyframes borderPulseTwice {
  0%   { box-shadow: 0 0 0 0 rgba(25,118,210, 0); }
  25%  { box-shadow: 0 0 0 3px rgba(25,118,210, 1); }
  50%  { box-shadow: 0 0 0 0 rgba(25,118,210, 0); }
  75%  { box-shadow: 0 0 0 3px rgba(25,118,210, 1); }
  100% { box-shadow: 0 0 0 0 rgba(25,118,210, 0); }
}
`;

    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (document.getElementById('border-pulse-keyframes')) return;

        const style = document.createElement('style');
        style.id = 'border-pulse-keyframes';
        style.innerHTML = borderPulseKeyframes;
        document.head.appendChild(style);
    }, []);

    return (
        <>
            {/* Estado */}
            {/* Completado en fecha */}
            {/* Veces completado */}
            {/* Certificado */}
            <AwardsActionCells
                state={{ status, completedDate, hasCertificate, timesCompleted }}
                actions={actions}
                fileInputId={fileInputId}
                pdfViewer={pdfViewer}
                certificateFile={certificateFile}
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

                            confirmDeleteForStatus.onFalse();
                            setPendingStatus(null);
                        }}

                    >
                        Eliminar y cambiar estado
                    </Button>
                }
            />

        </>
    );
}
