import { Text, View, Page, Image, Document, StyleSheet } from '@react-pdf/renderer';

// ----------------------------------------------------------------------
// LA LISTA DE PRECIOS, COMO LA IMPRIME LA OFICINA NACIONAL.
//
// Reproduce el documento oficial "TIENDA ERRD | Precios de insignias"
// (docs/2026_08_06_ERRD-TIENDA Precios de insignias.pdf): su estructura —renglon,
// articulo y los dos precios de venta, uno por tipo de destacamento—, su tamaño
// de pagina (Carta vertical) y sus colores, sacados del propio archivo:
//
//   #16365c  azul del titulo          #963634  rojo de la cabecera
//   #da9694  rosa de los encabezados  #f2dcdb  rosa de las filas restringidas
//   #eae7da  beige de las filas alternas
//
// La tipografia del original es Bahnschrift SemiBold, que no viaja con el
// documento; se usa Helvetica, que es la sans-serif que trae `@react-pdf` de
// serie. Registrar la fuente real exigiria meter el .ttf en el repositorio.
//
// El emblema va en PNG y no en el .webp del que salio: `@react-pdf` solo sabe
// leer PNG y JPEG, y con el webp la imagen no se dibuja —sin aviso—.
// ----------------------------------------------------------------------

export const LOGO_LISTA_PRECIOS = '/logo/watermark.png';

const COLORES = {
  azulTitulo: '#16365c',
  azulSubtitulo: '#213f75',
  rojoCabecera: '#963634',
  rosaCabecera: '#da9694',
  rosaRestringido: '#f2dcdb',
  beigeAlterno: '#eae7da',
  blanco: '#ffffff',
  texto: '#000000',
};

const styles = StyleSheet.create({
  page: { paddingHorizontal: 28, paddingVertical: 24, fontSize: 8, fontFamily: 'Helvetica' },
  encabezado: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORES.azulTitulo,
  },
  logo: { width: 32, height: 32, marginLeft: 10 },
  titulo: { fontSize: 14, color: COLORES.blanco, fontFamily: 'Helvetica-Bold' },
  subtitulo: { fontSize: 8, color: COLORES.blanco, marginTop: 2 },
  anio: { fontSize: 16, color: COLORES.blanco, fontFamily: 'Helvetica-Bold' },
  grupoCabecera: { flexDirection: 'row', backgroundColor: COLORES.rosaCabecera },
  grupoTexto: {
    padding: 4,
    fontSize: 7,
    textAlign: 'center',
    color: COLORES.blanco,
    fontFamily: 'Helvetica-Bold',
  },
  cabecera: { flexDirection: 'row', backgroundColor: COLORES.rojoCabecera },
  celdaCabecera: {
    padding: 5,
    fontSize: 8,
    color: COLORES.blanco,
    fontFamily: 'Helvetica-Bold',
  },
  fila: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLORES.blanco },
  celda: { padding: 5, color: COLORES.texto },
  precio: { padding: 5, textAlign: 'right', color: COLORES.texto },
  pie: {
    left: 28,
    right: 28,
    bottom: 12,
    fontSize: 7,
    position: 'absolute',
    color: COLORES.azulSubtitulo,
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
});

// Los mismos anchos para la cabecera y para cada fila, o las columnas bailan.
const ANCHOS = { renglon: '14%', articulo: '46%', precio: '20%' };

// "$ 2,700.00", como en el documento: el simbolo separado y siempre dos
// decimales, aunque el precio sea redondo.
const formatearPrecio = (valor) => {
  const numero = Number(valor || 0);

  if (!numero) return '';

  return `$ ${numero.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const etiquetaRenglon = (renglon) =>
  String(renglon || '').toLowerCase() === 'restringido' ? 'Restringido' : 'General';

export function ProductPriceListPdfDocument({
  title = 'TIENDA ERRD',
  anio = '',
  rows = [],
  // Ruta del emblema. Es prop para poder dibujar el documento fuera del
  // navegador —donde "/logo/..." no resuelve— sin tocar el componente.
  logo = LOGO_LISTA_PRECIOS,
}) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.encabezado} fixed>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View>
              <Text style={styles.titulo}>{title}</Text>
              <Text style={styles.subtitulo}>Precios de insignias y artículos</Text>
            </View>
            {!!logo && <Image src={logo} style={styles.logo} />}
          </View>
          {!!anio && <Text style={styles.anio}>{anio}</Text>}
        </View>

        {/* Los dos precios son de publicos distintos: el titulo de cada uno va
            encima de su columna, como en el original. */}
        <View style={styles.grupoCabecera} fixed>
          <Text style={[styles.grupoTexto, { width: ANCHOS.renglon }]} />
          <Text style={[styles.grupoTexto, { width: ANCHOS.articulo }]} />
          {/* En dos lineas escritas a mano: de una sola, "DESTACAMENTOS
              REGISTRADOS" no cabe en la columna y sale partido con guion. */}
          <View style={[styles.grupoTexto, { width: ANCHOS.precio }]}>
            <Text>DESTACAMENTOS</Text>
            <Text>REGISTRADOS</Text>
          </View>
          <View style={[styles.grupoTexto, { width: ANCHOS.precio }]}>
            <Text>DESTACAMENTOS</Text>
            <Text>No Registrados</Text>
          </View>
        </View>

        <View style={styles.cabecera} fixed>
          <Text style={[styles.celdaCabecera, { width: ANCHOS.renglon }]}>Renglón</Text>
          <Text style={[styles.celdaCabecera, { width: ANCHOS.articulo }]}>Artículo</Text>
          <Text style={[styles.celdaCabecera, { width: ANCHOS.precio, textAlign: 'right' }]}>
            Precio de venta
          </Text>
          <Text style={[styles.celdaCabecera, { width: ANCHOS.precio, textAlign: 'right' }]}>
            Precio de venta
          </Text>
        </View>

        {rows.map((row, index) => {
          const esRestringido = String(row?.renglon || '').toLowerCase() === 'restringido';
          // Lo restringido se distingue con su propio tono; el resto alterna
          // beige y blanco para que la fila no se pierda de largo.
          const fondo = esRestringido
            ? COLORES.rosaRestringido
            : index % 2
              ? COLORES.beigeAlterno
              : COLORES.blanco;

          return (
            <View
              key={row?.id || `${row?.name}-${index}`}
              style={[styles.fila, { backgroundColor: fondo }]}
              wrap={false}
            >
              <Text style={[styles.celda, { width: ANCHOS.renglon }]}>
                {etiquetaRenglon(row?.renglon)}
              </Text>
              <Text style={[styles.celda, { width: ANCHOS.articulo }]}>{row?.name || ''}</Text>
              <Text style={[styles.precio, { width: ANCHOS.precio }]}>
                {row?.precioPendiente ? 'Pendiente' : formatearPrecio(row?.precioRegistrado)}
              </Text>
              <Text style={[styles.precio, { width: ANCHOS.precio }]}>
                {/* Sin precio para los no registrados no es un cero: es que a
                    ellos no se les vende ese articulo. */}
                {row?.precioPendiente
                  ? 'Pendiente'
                  : formatearPrecio(row?.precioNoRegistrado) || 'N/A'}
              </Text>
            </View>
          );
        })}

        <View style={styles.pie} fixed>
          <Text>{title}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
