import { pdf, Text, View, Page, Image, Document, StyleSheet } from '@react-pdf/renderer';

// ----------------------------------------------------------------------
// EL DOCUMENTO PDF DE LAS FICHAS DE REGIÓN, SECCIÓN Y DESTACAMENTO, APARTE DEL MENÚ QUE LO PIDE.
//
// El menú se pinta con la ficha; si importaba `@react-pdf/renderer` (cerca de
// medio megabyte), la librería viajaba con cada ficha aunque nadie descargara.
// El menú trae este archivo con `import()` al pulsar "Descargar".
// ----------------------------------------------------------------------

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', gap: 16, marginBottom: 20, alignItems: 'center' },
  avatar: { width: 82, height: 82, borderRadius: 41, objectFit: 'cover' },
  title: { fontSize: 18, marginBottom: 4, fontWeight: 700 },
  subtitle: { color: '#52606d' },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e4e7ec' },
  label: { width: '34%', padding: 5, fontWeight: 700, backgroundColor: '#f6f8fb' },
  value: { width: '66%', padding: 5 },
});

const getValue = (value) => {
  if (value === 0) return '0';
  if (value instanceof Date) return value.toLocaleDateString();
  if (value?.format) return value.format('DD/MM/YYYY');
  return value ? String(value) : '-';
};

function InfoRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{getValue(value)}</Text>
    </View>
  );
}

function EntityInfoPdfDocument({ title, subtitle, avatarUrl, sections, selectedSections }) {
  const avatarSrc = typeof avatarUrl === 'string' ? avatarUrl : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {avatarSrc && <Image src={avatarSrc} style={styles.avatar} />}
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        {sections
          .filter((section) => selectedSections.includes(section.value))
          .map((section) => (
            <View key={section.value} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              {section.rows.map((row) => (
                <InfoRow key={`${section.value}-${row.label}`} label={row.label} value={row.value} />
              ))}
            </View>
          ))}
      </Page>
    </Document>
  );
}

export const generarPdfDeEntidad = (props) => pdf(<EntityInfoPdfDocument {...props} />).toBlob();
