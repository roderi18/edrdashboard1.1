'use client';

import dayjs from 'dayjs';

import Button from '@mui/material/Button';
import TableCell from '@mui/material/TableCell';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { toast } from 'src/components/snackbar';

import { CertificateActionCell } from 'src/sections/member/awards/components/certificate/CertificateActionCell';
import {
  StatusSelectCell,
  ACADEMIA_STATUS_OPTIONS,
} from 'src/sections/member/awards/components/status/StatusSelectCell';

export function AwardsActionCells({
  state, // { status, completedDate, hasCertificate, timesCompleted }
  actions, // AwardsActionsCore
  menuActions,
  fileInputId,
  pdfViewer,
  certificateFile,
  showTimesCompleted = true,
  onRequireDeleteCertificate,
  readOnly = false, // Usuario Común: solo lectura (no puede agregar/cambiar).
  // Academia Ministerial: sin certificado adjunto NO se registra el estado
  // "Completado"; el cambio se descarta y se avisa al usuario.
  requireCertificateToComplete = false,
  onMissingCertificate,
  highlightUpload = false,
}) {
  const isCompleted = state.status === 'completado';

  return (
    <>
      {/* =========================
          ESTADO (DESPLEGABLE ORIGINAL)
         ========================= */}
      <StatusSelectCell
        value={state.status}
        // Sin certificado el estado no se puede tocar: lo determina el documento.
        // Al adjuntarlo el adiestramiento queda completado y el desplegable se
        // habilita (para poder volver a "No iniciado", que exige borrar el archivo).
        disabled={readOnly || (requireCertificateToComplete && !state.hasCertificate)}
        // En Academia solo caben dos estados: acreditado o no.
        options={requireCertificateToComplete ? ACADEMIA_STATUS_OPTIONS : undefined}
        hasCertificate={state.hasCertificate}
        onRequireDeleteCertificate={onRequireDeleteCertificate}
        onChange={(value) => {
          // Sin certificado no se registra "Completado": se descarta el cambio y
          // se le indica al usuario que primero adjunte el documento.
          if (requireCertificateToComplete && value === 'completado' && !state.hasCertificate) {
            onMissingCertificate?.();
            return;
          }

          actions.setStatus(value);

          if (value === 'completado' && !state.completedDate) {
            actions.setCompletedDate(new Date().toISOString());
          }
        }}
      />

      {/* =========================
          COMPLETADO EN FECHA (DATEPICKER)
         ========================= */}
      <TableCell>
        <DatePicker
          value={isCompleted && state.completedDate ? dayjs(state.completedDate) : null}
          onChange={(value) => {
            if (!value || !dayjs(value).isValid()) return;
            actions.setCompletedDate(value.toISOString());
          }}
          format="DD/MM/YYYY"
          views={['year', 'month', 'day']}
          openTo="year"
          minDate={dayjs('2000-01-01')}
          maxDate={dayjs()}
          disableFuture
          // Solo lectura: la fecha se consulta pero no se cambia.
          disabled={!isCompleted || readOnly}
          slotProps={{
            textField: {
              size: 'small',
              sx: {
                width: 163,
                '& input': {
                  padding: '6px 6px',
                  textAlign: 'center',
                },
              },
            },
          }}
        />
      </TableCell>

      {/* =========================
          N.º DE VECES (+ / - ORIGINAL)
         ========================= */}
      {showTimesCompleted && (
        <TableCell align="center" sx={{ p: 0 }}>
          <Button
            size="small"
            variant="outlined"
            disabled={!isCompleted || readOnly || state.timesCompleted <= 0}
            onClick={() => {
              const next = state.timesCompleted - 1;
              actions.updateTimesCompleted(next);
            }}
            sx={{ minWidth: 32 }}
          >
            −
          </Button>

          <span
            style={{
              margin: '0 12px',
              fontWeight: 600,
              opacity: isCompleted ? 1 : 0.4,
            }}
          >
            {state.timesCompleted >= 10 ? '+10' : state.timesCompleted}
          </span>

          <Button
            size="small"
            variant="outlined"
            disabled={!isCompleted || readOnly || state.timesCompleted >= 10}
            onClick={() => {
              const next = state.timesCompleted + 1;
              actions.updateTimesCompleted(next);
            }}
            sx={{ minWidth: 32 }}
          >
            +
          </Button>
        </TableCell>
      )}

      {/* =========================
          CERTIFICADO (BOTÓN ORIGINAL)
         ========================= */}
      <TableCell>
        {/* Sin `accept`: el certificado puede venir escaneado como imagen, en
            Word o en PDF, y el selector abria filtrado a PDF. */}
        <input
          id={fileInputId}
          type="file"
          hidden
          disabled={readOnly}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = () => {
              actions.uploadCertificate({
                name: file.name,
                type: file.type,
                size: file.size,
                fileBase64: reader.result,
                uploadedAt: new Date().toISOString(),
              });
              toast.success('Documento cargado exitosamente.');
            };

            reader.onerror = () => {
              toast.error('No se pudo leer el documento. Intentalo de nuevo.');
            };

            reader.readAsDataURL(file);
          }}
        />

        <CertificateActionCell
          isCompleted={isCompleted}
          hasCertificate={state.hasCertificate}
          completedDate={state.completedDate}
          inputId={fileInputId}
          onView={pdfViewer?.onTrue}
          certificateFile={certificateFile}
          onUpload={(cert) => actions.uploadCertificate(cert)}
          onDelete={actions.deleteCertificate}
          readOnly={readOnly}
          highlightUpload={highlightUpload}
          allowUploadBeforeCompleted={requireCertificateToComplete}
        />
      </TableCell>
    </>
  );
}
