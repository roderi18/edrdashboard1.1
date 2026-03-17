import MenuItem from '@mui/material/MenuItem';
import { Iconify } from 'src/components/iconify';

export function DownloadCertificateMenuItem({
    certificate,
    onClose,
}) {
    if (!certificate?.fileBase64) return null;

    return (
        <MenuItem
            onClick={() => {
                onClose?.();

                const link = document.createElement('a');
                link.href = certificate.fileBase64;
                link.download = certificate.name || 'certificado.pdf';
                link.click();
            }}
        >
            <Iconify icon="solar:download-bold" />
            Descargar certificado
        </MenuItem>
    );
}
