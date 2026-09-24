import { pdf, Text, View, Page, Document, StyleSheet } from '@react-pdf/renderer';

// ----------------------------------------------------------------------
// EL PDF DE LA LISTA DE MIEMBROS, EN SU PROPIO ARCHIVO.
//
// Vivía con las utilidades de descarga, que la barra de la lista importa al
// cargar: con él viajaba `@react-pdf/renderer` (cerca de medio megabyte) aunque
// nadie pulsara "Descargar". Ahora la barra lo trae con `import()` al pulsar.
// ----------------------------------------------------------------------

const pdfStyles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 6, fontWeight: 700 },
  subtitle: { fontSize: 9, marginBottom: 16, color: '#52606d' },
  table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#d9e2ec' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d9e2ec' },
  header: { backgroundColor: '#f0f4f8', fontWeight: 700 },
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: '#d9e2ec' },
  code: { width: '16%' },
  name: { width: '24%' },
  phone: { width: '14%' },
  email: { width: '20%' },
  dest: { width: '16%' },
  section: { width: '10%', borderRightWidth: 0 },
});

const getValue = (value) => value || '-';

export function MembersPdfDocument({ members }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>Lista de miembros</Text>
        <Text style={pdfStyles.subtitle}>Total de miembros: {members.length}</Text>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.row, pdfStyles.header]}>
            <Text style={[pdfStyles.cell, pdfStyles.code]}>Código</Text>
            <Text style={[pdfStyles.cell, pdfStyles.name]}>Nombre</Text>
            <Text style={[pdfStyles.cell, pdfStyles.phone]}>Teléfono</Text>
            <Text style={[pdfStyles.cell, pdfStyles.email]}>Correo</Text>
            <Text style={[pdfStyles.cell, pdfStyles.dest]}>Destacamento</Text>
            <Text style={[pdfStyles.cell, pdfStyles.section]}>Sección</Text>
          </View>

          {members.map((member, index) => (
            <View key={`${member.id || member.memberId || index}`} style={pdfStyles.row}>
              <Text style={[pdfStyles.cell, pdfStyles.code]}>
                {getValue(member.memberId || member.codigoMiembro)}
              </Text>
              <Text style={[pdfStyles.cell, pdfStyles.name]}>
                {getValue(
                  member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim()
                )}
              </Text>
              <Text style={[pdfStyles.cell, pdfStyles.phone]}>{getValue(member.phoneNumber)}</Text>
              <Text style={[pdfStyles.cell, pdfStyles.email]}>{getValue(member.email)}</Text>
              <Text style={[pdfStyles.cell, pdfStyles.dest]}>
                {getValue(member.destName || member.destamento || member.idDestacamento)}
              </Text>
              <Text style={[pdfStyles.cell, pdfStyles.section]}>
                {getValue(member.sectionalName)}
              </Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export const generarPdfDeMiembros = (members) =>
  pdf(<MembersPdfDocument members={members} />).toBlob();
