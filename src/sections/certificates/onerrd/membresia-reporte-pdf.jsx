import { pdf, Page, Text, View, Image, Document, StyleSheet } from '@react-pdf/renderer';

import {
  fechaReporteRegistro,
  LEYENDA_REPORTE_REGISTRO,
} from 'src/utils/reporte-registro-membresia.mjs';

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 56,
    paddingBottom: 58,
    paddingHorizontal: 53,
    fontFamily: 'Helvetica',
    color: '#171b27',
  },
  titulo: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 3 },
  correo: { fontFamily: 'Helvetica-Oblique', fontSize: 10, marginBottom: 16 },
  subtitulo: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 10 },
  tabla: { borderTopWidth: 1, borderColor: '#1d3155' },
  fila: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#d8deea',
    paddingVertical: 5,
  },
  cabecera: { backgroundColor: '#eef2f8', fontFamily: 'Helvetica-Bold' },
  celda: { fontSize: 8.7, paddingHorizontal: 3 },
  registro: { width: '23%' },
  destacamento: { width: '13%' },
  fecha: { width: '16%' },
  region: { width: '16%' },
  registradoPor: { width: '32%' },
  nota: { fontSize: 8, color: '#58647a', lineHeight: 1.35, marginTop: 15 },
  bloqueFinal: { marginTop: 16, width: 360, alignSelf: 'center' },
  reconocimiento: { fontFamily: 'Helvetica-Oblique', fontSize: 8, marginBottom: 3 },
  leyendaTitulo: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 8.5,
    marginTop: 7,
    paddingBottom: 2,
    borderBottomWidth: 0.7,
    borderColor: '#171b27',
  },
  leyendaFila: { flexDirection: 'row', paddingVertical: 2 },
  leyendaCodigo: { width: 51, textAlign: 'right', fontSize: 8.5 },
  leyendaDescripcion: { flex: 1, fontFamily: 'Helvetica-Oblique', fontSize: 8.5, marginLeft: 12 },
  preparado: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginTop: 12,
  },
  preparadoTexto: { fontSize: 9, marginRight: 18, marginBottom: 13 },
  firmaCaja: { alignItems: 'center' },
  firma: { width: 100, height: 34, objectFit: 'contain' },
  firmante: { fontSize: 9, textAlign: 'center' },
  sello: { width: 83, height: 80, objectFit: 'contain', alignSelf: 'center', marginTop: 17 },
  pie: {
    position: 'absolute',
    bottom: 29,
    left: 53,
    right: 53,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#68758a',
  },
});

const TAMANO_PAGINA = 18;
const TAMANO_ULTIMA_PAGINA = 10;

function FilaPdf({ fila, cabecera = false }) {
  return (
    <View style={[estilos.fila, cabecera && estilos.cabecera]} wrap={false}>
      <Text style={[estilos.celda, estilos.registro]}>
        {cabecera ? 'Registro No.' : fila.registro}
      </Text>
      <Text style={[estilos.celda, estilos.destacamento]}>
        {cabecera ? 'Dest. No.' : fila.destacamento}
      </Text>
      <Text style={[estilos.celda, estilos.fecha]}>
        {cabecera ? 'Fecha reg.' : fechaReporteRegistro(fila.fecha)}
      </Text>
      <Text style={[estilos.celda, estilos.region]}>{cabecera ? 'Región' : fila.region}</Text>
      <Text style={[estilos.celda, estilos.registradoPor]}>
        {cabecera ? 'Registrado por' : fila.registradoPor}
      </Text>
    </View>
  );
}

function BloqueFinalPdf({ firma, sello }) {
  return (
    <View style={estilos.bloqueFinal} wrap={false}>
      <Text style={estilos.reconocimiento}>*Dest. Reconocido en último semestre de 2025</Text>
      <Text style={estilos.reconocimiento}>**Dest. Reconocido en 2026</Text>
      <Text style={estilos.leyendaTitulo}>Leyenda</Text>
      {LEYENDA_REPORTE_REGISTRO.map(({ codigo, descripcion }) => (
        <View key={codigo} style={estilos.leyendaFila}>
          <Text style={estilos.leyendaCodigo}>{codigo}</Text>
          <Text style={estilos.leyendaDescripcion}>{descripcion}</Text>
        </View>
      ))}
      <View style={estilos.preparado}>
        <Text style={estilos.preparadoTexto}>Preparado por:</Text>
        <View style={estilos.firmaCaja}>
          <Image src={firma} style={estilos.firma} />
          <Text style={estilos.firmante}>Eliezer García</Text>
          <Text style={estilos.firmante}>Administrador ONERRD</Text>
        </View>
      </View>
      <Image src={sello} style={estilos.sello} />
    </View>
  );
}

// `anio`, `subtitulo` y `nota`: el mismo reporte sirve para el de 2027 (las
// membresías confirmadas) y para la lista de inscritos de 2026.
export function ReporteRegistroPdf({
  filas,
  generadoEn,
  firma,
  sello,
  anio = 2027,
  subtitulo = `Reporte de registro anual de destacamentos · ${filas.length} confirmados`,
  nota = 'Se incluyen las membresías 2027 con pago confirmado. La fecha corresponde a la confirmación del pago. El nombre mostrado es la persona que registró el destacamento al pagar.',
}) {
  const paginas = [];
  let indiceFila = 0;
  while (filas.length - indiceFila > TAMANO_ULTIMA_PAGINA) {
    const restantes = filas.length - indiceFila;
    const cantidad =
      restantes <= TAMANO_ULTIMA_PAGINA * 2 ? Math.ceil(restantes / 2) : TAMANO_PAGINA;
    paginas.push(filas.slice(indiceFila, indiceFila + cantidad));
    indiceFila += cantidad;
  }
  paginas.push(filas.slice(indiceFila));

  return (
    <Document
      title={`Reporte de registro anual de destacamentos ${anio}`}
      author="Oficina Nacional de Exploradores del Rey"
    >
      {paginas.map((grupo, indice) => (
        <Page key={indice} size="LETTER" style={estilos.pagina}>
          <Text style={estilos.titulo}>
            Oficina Nacional de Exploradores del Rey, Rep. Dominicana {anio}
          </Text>
          <Text style={estilos.correo}>oficinanacional@errd.org.do</Text>
          <Text style={estilos.subtitulo}>{subtitulo}</Text>
          <View style={estilos.tabla}>
            <FilaPdf cabecera fila={{}} />
            {grupo.map((fila) => (
              <FilaPdf key={`${fila.id}-${fila.registro}`} fila={fila} />
            ))}
          </View>
          {indice === paginas.length - 1 && <BloqueFinalPdf firma={firma} sello={sello} />}
          {indice === paginas.length - 1 && !!nota && <Text style={estilos.nota}>{nota}</Text>}
          <View style={estilos.pie} fixed>
            <Text>Generado el {fechaReporteRegistro(generadoEn)}</Text>
            <Text>
              Página {indice + 1} de {paginas.length}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}

async function imagenDeReporte(ruta) {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) throw new Error('No se pudo cargar la firma o el sello del reporte.');
  const archivo = await respuesta.blob();
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = reject;
    lector.readAsDataURL(archivo);
  });
}

export async function crearReporteRegistroPdf(filas, generadoEn, imagenes, opciones = {}) {
  const [firma, sello] =
    imagenes ||
    (await Promise.all([
      imagenDeReporte('/marca/reportes/firma-eliezer-garcia.png'),
      imagenDeReporte('/marca/reportes/sello-oficina-nacional.png'),
    ]));
  return pdf(
    <ReporteRegistroPdf
      filas={filas}
      generadoEn={generadoEn}
      firma={firma}
      sello={sello}
      {...opciones}
    />
  ).toBlob();
}
