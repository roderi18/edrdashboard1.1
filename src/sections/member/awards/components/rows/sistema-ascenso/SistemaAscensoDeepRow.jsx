import { useState, useEffect } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Button from '@mui/material/Button';

import { toast } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useAwardsSync } from 'src/sections/member/awards/hooks/useAwardsSync';
import { AwardsActionCells } from 'src/sections/member/awards/components/AwardsActionCells';
import { PdfViewerDialog } from 'src/sections/member/awards/components/viewer/PdfViewerDialog';
import { createAwardsActions } from 'src/sections/member/awards/components/core/AwardsActionsCore';

import { useAuthContext } from 'src/auth/hooks';

const BORDER_PULSE_KEYFRAMES = `
@keyframes borderPulseTwice {
  0%   { box-shadow: 0 0 0 0 rgba(25,118,210, 0); }
  25%  { box-shadow: 0 0 0 3px rgba(25,118,210, 1); }
  50%  { box-shadow: 0 0 0 0 rgba(25,118,210, 0); }
  75%  { box-shadow: 0 0 0 3px rgba(25,118,210, 1); }
  100% { box-shadow: 0 0 0 0 rgba(25,118,210, 0); }
}
`;

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
  readOnly = false,
}) {
  const { user } = useAuthContext();
  const [status, setLocalStatus] = useState('no_iniciado');
  const [certificateFile, setCertificateFile] = useState(null);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [timesCompleted, setTimesCompleted] = useState(0);

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
    onRequireStatusChangeApproval: (change) => {
      setPendingStatus(change);
      confirmDeleteForStatus.onTrue();
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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('border-pulse-keyframes')) return;

    const style = document.createElement('style');
    style.id = 'border-pulse-keyframes';
    style.innerHTML = BORDER_PULSE_KEYFRAMES;
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
        readOnly={readOnly}
        onRequireDeleteCertificate={(nextStatus) => {
          setPendingStatus({ nextStatus, nextTimesCompleted: 0, hasCertificate });
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
        title="Solicitar cambio de estado"
        content="¿Estás seguro de que deseas cambiar un registro que ya está Completado? Si existe un documento anexo, se eliminará únicamente cuando la solicitud sea aprobada. El estado no cambiará hasta recibir esa aprobación."
        action={
          <Button
            variant="contained"
            loading={sendingRequest}
            onClick={async () => {
              if (!pendingStatus?.nextStatus) return;
              setSendingRequest(true);
              try {
                await actions.requestStatusChange(pendingStatus);
                toast.success('Solicitud enviada a los Coordinadores de Destacamento.');
                confirmDeleteForStatus.onFalse();
                setPendingStatus(null);
              } catch (error) {
                toast.error(error.message || 'No se pudo enviar la solicitud.');
              } finally {
                setSendingRequest(false);
              }
            }}
          >
            Enviar solicitud
          </Button>
        }
      />
    </>
  );
}
