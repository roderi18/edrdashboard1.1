import { useState, useEffect } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Button from '@mui/material/Button';

import { ConfirmDialog } from 'src/components/custom-dialog';

import { useAwardsSync } from 'src/sections/member/awards/hooks/useAwardsSync';
import { AwardsActionCells } from 'src/sections/member/awards/components/AwardsActionCells';
import { PdfViewerDialog } from 'src/sections/member/awards/components/viewer/PdfViewerDialog';
import { createAwardsActions } from 'src/sections/member/awards/components/core/AwardsActionsCore';

import { useAuthContext } from 'src/auth/hooks';

export function SistemaAscensoDeepRow({
  memberId,
  rowId,
  parentId,
  sectionId,
  metadata,
  setStatus,
  completedDate,
  setCompletedDate,

  onCertificateUploaded,
  onCertificateDeleted,
}) {
  const { user } = useAuthContext();
  const [status, setLocalStatus] = useState('no_iniciado');
  const [certificateFile, setCertificateFile] = useState(null);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [highlightUpload, setHighlightUpload] = useState(false);
  const [dateError, setDateError] = useState(false);
  const [timesCompleted, setTimesCompleted] = useState(0);

  const isCompleted = status === 'completado';
  const pdfViewer = useBoolean();

  const confirmDeleteForStatus = useBoolean();

  const fileInputId = `cert-upload-${rowId}`;

  const actions = createAwardsActions({
    system: 'sistemaAscenso',
    memberId,
    context: {
      sectionId,
      parentId,
      rowId,
    },
    metadata,
    user,
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
        urlPdf={certificateFile?.urlPdf || certificateFile?.pdfUrl}
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
