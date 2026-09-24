// ----------------------------------------------------------------------
// EXPORTAR UNA TABLA A PDF, CARGANDO LA LIBRERÍA SOLO AL PULSAR.
//
// `@react-pdf/renderer` pesa cerca de medio megabyte. Importada arriba, viajaba
// con cada lista que tiene el botón "Descargar" (regiones, secciones,
// destacamentos, órdenes, tienda) aunque nadie lo pulsara. Ahora estas dos
// funciones traen el documento y la librería (`download-table-pdf-documento`)
// en el momento de usarlas; la firma no cambia.
// ----------------------------------------------------------------------

const cargarDocumento = () => import('./download-table-pdf-documento');

export const downloadTablePdf = async (opciones) =>
  (await cargarDocumento()).downloadTablePdf(opciones);

export const printTablePdf = async (opciones) => (await cargarDocumento()).printTablePdf(opciones);
