import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import { Iconify } from 'src/components/iconify';

export function CertificateActionCell({
    isCompleted,
    hasCertificate,
    completedDate,
    highlightUpload,
    onUpload,
    onView,
    inputId,
    readOnly = false,
    // Academia Ministerial: el certificado es OBLIGATORIO para dar por completado
    // un adiestramiento. Por eso hay que poder subirlo ANTES de completarlo (subir
    // el archivo es justo lo que lo marca como completado); si no, el registro
    // seria imposible: no se puede completar sin certificado ni subir sin estar
    // completado.
    allowUploadBeforeCompleted = false,
}) {
    const canUploadNow = !readOnly && (isCompleted || allowUploadBeforeCompleted);

    if (!isCompleted && !canUploadNow) {
        return (
            <Button size="small" variant="outlined" disabled>
                N/A
            </Button>
        );
    }

    // Solo lectura (p. ej. Pastor / Director Nacional / Consejo Nacional): puede
    // VER el certificado si existe, pero no puede subirlo. Sin certificado no hay
    // nada que ver ni subir, pero el botón NUNCA debe desaparecer (columna vacía
    // confunde); se muestra "N/A" deshabilitado, igual que cuando no está completado.
    if (readOnly && !hasCertificate) {
        return (
            <Button size="small" variant="outlined" disabled>
                N/A
            </Button>
        );
    }

    if (!hasCertificate) {
        return (
            <Box>
                <Button
                    size="small"
                    variant="contained"
                    startIcon={<Iconify icon="eva:cloud-upload-fill" />}
                    sx={{
                        animation: highlightUpload ? 'borderPulseTwice 2s' : 'none',
                        boxShadow: highlightUpload
                            ? '0 0 0 3px rgba(25,118,210,1)'
                            : undefined,
                    }}
                    onClick={() => {
                        // Cuando el certificado es obligatorio se sube antes de
                        // completar, asi que en ese caso no se exige la fecha.
                        if (!allowUploadBeforeCompleted && !completedDate) return;
                        document.getElementById(inputId)?.click();
                    }}
                >
                    Subir
                </Button>
            </Box>
        );
    }

    return (
        <Button
            size="small"
            variant="contained"
            startIcon={<Iconify icon="eva:eye-fill" />}
            onClick={onView}
        >
            Ver
        </Button>
    );
}
