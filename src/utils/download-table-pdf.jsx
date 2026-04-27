import { pdf, Text, View, Page, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 6, fontWeight: 700 },
  subtitle: { fontSize: 9, marginBottom: 16, color: '#52606d' },
  table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#d9e2ec' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d9e2ec' },
  header: { backgroundColor: '#f0f4f8', fontWeight: 700 },
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: '#d9e2ec' },
});

const getValue = (value) => {
  if (value === 0) return '0';
  return value ? String(value) : '-';
};

function TablePdfDocument({ title, rows, columns }) {
  const width = `${100 / columns.length}%`;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Total de registros: {rows.length}</Text>

        <View style={styles.table}>
          <View style={[styles.row, styles.header]}>
            {columns.map((column, index) => (
              <Text
                key={column.label}
                style={[styles.cell, { width, borderRightWidth: index === columns.length - 1 ? 0 : 1 }]}
              >
                {column.label}
              </Text>
            ))}
          </View>

          {rows.map((row, rowIndex) => (
            <View key={`${row.id || row.idDestacamento || rowIndex}`} style={styles.row}>
              {columns.map((column, columnIndex) => (
                <Text
                  key={`${column.label}-${rowIndex}`}
                  style={[
                    styles.cell,
                    { width, borderRightWidth: columnIndex === columns.length - 1 ? 0 : 1 },
                  ]}
                >
                  {getValue(column.value(row))}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export const downloadTablePdf = async ({ title, fileName, rows, columns }) => {
  const blob = await pdf(<TablePdfDocument title={title} rows={rows} columns={columns} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const printTablePdf = async ({ title, rows, columns }) => {
  const blob = await pdf(<TablePdfDocument title={title} rows={rows} columns={columns} />).toBlob();
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');

  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };

  document.body.appendChild(iframe);

  setTimeout(() => {
    document.body.removeChild(iframe);
    URL.revokeObjectURL(url);
  }, 60000);
};
