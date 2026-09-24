import {
  pdf,
  Text,
  Document,
  StyleSheet,
  View as PdfView,
  Page as PdfPage,
  Image as PdfImage,
} from '@react-pdf/renderer';

// ----------------------------------------------------------------------
// EL PDF DEL ORGANIGRAMA DEL DESTACAMENTO, APARTE DE LA PESTAÑA.
//
// Vivía dentro de la página de la Directiva, que importaba `@react-pdf/renderer`
// (cerca de medio megabyte) al abrirse. La página lo trae con `import()` al
// pulsar "Descargar".
// ----------------------------------------------------------------------

const pdfStyles = StyleSheet.create({
  page: {
    padding: 18,
    fontFamily: 'Helvetica',
    color: '#1C252E',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    marginBottom: 14,
    fontWeight: 700,
    textAlign: 'center',
  },
  chart: {
    position: 'relative',
    width: 806,
    height: 520,
    marginHorizontal: 'auto',
  },
  line: {
    position: 'absolute',
    backgroundColor: '#637381',
  },
  personCard: {
    position: 'absolute',
    width: 128,
    height: 64,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDE3EA',
    backgroundColor: '#F9FAFB',
  },
  divisionCard: {
    position: 'absolute',
    width: 128,
    height: 36,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDE3EA',
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 7,
    objectFit: 'cover',
  },
  avatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 7,
    backgroundColor: '#DFE3E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 9,
    fontWeight: 700,
    color: '#637381',
  },
  logo: {
    width: 24,
    height: 24,
    objectFit: 'contain',
    marginRight: 8,
  },
  name: {
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 4,
  },
  role: {
    fontSize: 6.5,
    color: '#637381',
  },
  divisionName: {
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 3,
  },
  divisionRole: {
    fontSize: 6.5,
    color: '#637381',
  },
  textColumn: {
    flex: 1,
  },
});

const PDF_POSITIONS = {
  center: 403,
  personWidth: 128,
  personHeight: 64,
  divisionWidth: 128,
  divisionHeight: 36,
  pastorY: 0,
  coordinatorY: 78,
  assistantY: 156,
  sideY: 250,
  branchY: 238,
  divisionsY: 322,
  leadersY: 380,
  assistantsY: 458,
  sideCenters: [286, 520],
  divisionCenters: [160, 322, 484, 646],
};

const getCenteredLeft = (center, width) => center - width / 2;

const PdfLine = ({ x, y, width = 1, height = 1 }) => (
  <PdfView style={[pdfStyles.line, { left: x, top: y, width, height }]} />
);

const PdfAvatar = ({ src, name }) =>
  src ? (
    <PdfImage src={src} style={pdfStyles.avatar} />
  ) : (
    <PdfView style={pdfStyles.avatarFallback}>
      <Text style={pdfStyles.avatarFallbackText}>{String(name || '?').charAt(0)}</Text>
    </PdfView>
  );

const PdfPersonNode = ({ node, x, y }) => (
  <PdfView style={[pdfStyles.personCard, { left: x, top: y }]}>
    <PdfAvatar src={node.avatarUrl} name={node.name} />
    <Text style={pdfStyles.name}>{node.name}</Text>
    <Text style={pdfStyles.role}>{node.role}</Text>
  </PdfView>
);

const PdfDivisionNode = ({ node, x, y }) => (
  <PdfView style={[pdfStyles.divisionCard, { left: x, top: y }]}>
    {node.avatarUrl ? <PdfImage src={node.avatarUrl} style={pdfStyles.logo} /> : null}
    <PdfView style={pdfStyles.textColumn}>
      <Text style={pdfStyles.divisionName}>{node.name}</Text>
      <Text style={pdfStyles.divisionRole}>{node.role}</Text>
    </PdfView>
  </PdfView>
);

function LeadershipPdfDocument({ destName, chartData }) {
  const personLeft = (center) => getCenteredLeft(center, PDF_POSITIONS.personWidth);
  const divisionLeft = (center) => getCenteredLeft(center, PDF_POSITIONS.divisionWidth);
  const pastorBottom = PDF_POSITIONS.pastorY + PDF_POSITIONS.personHeight;
  const coordinatorBottom = PDF_POSITIONS.coordinatorY + PDF_POSITIONS.personHeight;
  const assistantBottom = PDF_POSITIONS.assistantY + PDF_POSITIONS.personHeight;
  const divisionBottom = PDF_POSITIONS.divisionsY + PDF_POSITIONS.divisionHeight;
  const leaderBottom = PDF_POSITIONS.leadersY + PDF_POSITIONS.personHeight;

  return (
    <Document>
      <PdfPage size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>
          {destName && destName !== 'Destacamento' ? `Destacamento ${destName}` : 'Destacamento'}
        </Text>

        <PdfView style={pdfStyles.chart}>
          <PdfLine
            x={PDF_POSITIONS.center}
            y={pastorBottom}
            height={PDF_POSITIONS.coordinatorY - pastorBottom}
          />
          <PdfLine
            x={PDF_POSITIONS.center}
            y={coordinatorBottom}
            height={PDF_POSITIONS.assistantY - coordinatorBottom}
          />
          <PdfLine
            x={PDF_POSITIONS.center}
            y={assistantBottom}
            height={PDF_POSITIONS.branchY - assistantBottom}
          />
          <PdfLine
            x={PDF_POSITIONS.sideCenters[0]}
            y={PDF_POSITIONS.branchY}
            width={PDF_POSITIONS.sideCenters[1] - PDF_POSITIONS.sideCenters[0]}
          />
          {PDF_POSITIONS.sideCenters.map((center) => (
            <PdfLine
              key={`side-line-${center}`}
              x={center}
              y={PDF_POSITIONS.branchY}
              height={PDF_POSITIONS.sideY - PDF_POSITIONS.branchY}
            />
          ))}
          {PDF_POSITIONS.divisionCenters.map((center) => (
            <PdfView key={`division-lines-${center}`}>
              <PdfLine
                x={center}
                y={divisionBottom}
                height={PDF_POSITIONS.leadersY - divisionBottom}
              />
              <PdfLine
                x={center}
                y={leaderBottom}
                height={PDF_POSITIONS.assistantsY - leaderBottom}
              />
            </PdfView>
          ))}

          <PdfPersonNode
            node={chartData.pastor}
            x={personLeft(PDF_POSITIONS.center)}
            y={PDF_POSITIONS.pastorY}
          />
          <PdfPersonNode
            node={chartData.coordinator}
            x={personLeft(PDF_POSITIONS.center)}
            y={PDF_POSITIONS.coordinatorY}
          />
          <PdfPersonNode
            node={chartData.assistantCoordinator}
            x={personLeft(PDF_POSITIONS.center)}
            y={PDF_POSITIONS.assistantY}
          />
          <PdfPersonNode
            node={chartData.council}
            x={personLeft(PDF_POSITIONS.sideCenters[0])}
            y={PDF_POSITIONS.sideY}
          />
          <PdfPersonNode
            node={chartData.chaplain}
            x={personLeft(PDF_POSITIONS.sideCenters[1])}
            y={PDF_POSITIONS.sideY}
          />

          {chartData.divisions.map((division, index) => (
            <PdfView key={division.name}>
              <PdfDivisionNode
                node={division}
                x={divisionLeft(PDF_POSITIONS.divisionCenters[index])}
                y={PDF_POSITIONS.divisionsY}
              />
              <PdfPersonNode
                node={division.leader}
                x={personLeft(PDF_POSITIONS.divisionCenters[index])}
                y={PDF_POSITIONS.leadersY}
              />
              <PdfPersonNode
                node={division.assistant}
                x={personLeft(PDF_POSITIONS.divisionCenters[index])}
                y={PDF_POSITIONS.assistantsY}
              />
            </PdfView>
          ))}
        </PdfView>
      </PdfPage>
    </Document>
  );
}

export const generarPdfDeLaDirectiva = ({ destName, chartData }) =>
  pdf(<LeadershipPdfDocument destName={destName} chartData={chartData} />).toBlob();
