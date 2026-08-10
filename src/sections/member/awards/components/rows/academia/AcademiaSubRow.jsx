import { useState, useEffect } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Button from '@mui/material/Button';

import { toast } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useAwardsSync } from 'src/sections/member/awards/hooks/useAwardsSync';
import { useBorderPulse } from 'src/sections/member/awards/hooks/useBorderPulse';
import { AwardsActionCells } from 'src/sections/member/awards/components/AwardsActionCells';
import { PdfViewerDialog } from 'src/sections/member/awards/components/viewer/PdfViewerDialog';
import { createAwardsActions } from 'src/sections/member/awards/components/core/AwardsActionsCore';

import { useAuthContext } from 'src/auth/hooks';

export function AcademiaSubRow({
  memberId,
  rowId,
  parentId,
  metadata,
  completedDate,
  setCompletedDate,

  onCertificateUploaded,
  onCertificateDeleted,
  readOnly = false,
}) {
  const { user } = useAuthContext();
  const [localStatus, setLocalStatus] = useState('no_iniciado');
  const [certificateFile, setCertificateFile] = useState(null);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [timesCompleted, setTimesCompleted] = useState(0);

  const actions = createAwardsActions({
    system: 'academia',
    memberId,
    context: { parentId, rowId },
    metadata,
    user,
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
        readOnly={readOnly}
        // Academia Ministerial: el certificado es obligatorio para registrar el
        // adiestramiento como completado.
        requireCertificateToComplete={!readOnly}
        highlightUpload={highlightUpload}
        onMissingCertificate={() => {
          toast.error(
            'Adjunta el certificado para registrar este adiestramiento como completado.'
          );
          setHighlightUpload(true);
          setTimeout(() => setHighlightUpload(false), 2000);
        }}
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
