import { PDFDownloadLink } from '@react-pdf/renderer';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import { Iconify } from 'src/components/iconify';
import { AwardPdfDocument } from './AwardPdfDocument';

export function AwardPdfDownload({ title, subtitle, fileBase64, fileName }) {
    return (
        <PDFDownloadLink
            document={
                <AwardPdfDocument
                    title={title}
                    subtitle={subtitle}
                    fileBase64={fileBase64}
                />
            }
            fileName={fileName || 'certificado.pdf'}
            style={{ textDecoration: 'none' }}
        >
            {({ loading }) => (
                <Tooltip title="Descargar">
                    <IconButton>
                        {loading ? (
                            <CircularProgress size={24} />
                        ) : (
                            <Iconify icon="eva:cloud-download-fill" />
                        )}
                    </IconButton>
                </Tooltip>
            )}
        </PDFDownloadLink>
    );
}
