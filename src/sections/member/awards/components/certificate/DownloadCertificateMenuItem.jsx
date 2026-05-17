import MenuItem from '@mui/material/MenuItem';
import { Iconify } from 'src/components/iconify';

export function DownloadCertificateMenuItem({ certificate, onClose }) {
  const href = certificate?.fileBase64 || certificate?.urlPdf || certificate?.pdfUrl;

  if (!href) return null;

  return (
    <MenuItem
      onClick={() => {
        onClose?.();

        const link = document.createElement('a');
        link.href = href;
        link.download = certificate.name || 'certificado.pdf';
        link.click();
      }}
    >
      <Iconify icon="solar:download-bold" />
      Descargar certificado
    </MenuItem>
  );
}
