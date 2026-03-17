import {
    Page,
    Text,
    View,
    Document,
    PDFViewer,
    StyleSheet,
} from '@react-pdf/renderer';

export function AwardPdfDocument({ title, subtitle, fileBase64 }) {
    return (
        <Document>
            <Page size="A4">
                <Text>{title}</Text>
                <Text>{subtitle}</Text>
            </Page>
        </Document>
    );
}
