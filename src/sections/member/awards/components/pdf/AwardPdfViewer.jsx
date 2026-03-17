import { PDFViewer } from '@react-pdf/renderer';
import { AwardPdfDocument } from './AwardPdfDocument';

export function AwardPdfViewer({ title, subtitle, fileBase64 }) {
    return (
        <PDFViewer width="100%" height="100%" style={{ border: 'none' }}>
            <AwardPdfDocument
                title={title}
                subtitle={subtitle}
                fileBase64={fileBase64}
            />
        </PDFViewer>
    );
}
