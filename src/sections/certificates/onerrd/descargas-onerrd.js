import { urlDelPdfOnerrd, textosParaPintarOnerrd } from 'src/utils/certificado-onerrd.mjs';
import {
  datosDeFacturaOnerrd,
  facturaDePruebaOnerrd,
  PAGINA_FACTURA_ONERRD,
  valoresDeFacturaOnerrd,
  sanearDisenoFacturaOnerrd,
  nombreDeArchivoFacturaOnerrd,
} from 'src/utils/factura-onerrd.mjs';

import {
  leerDisenoFacturaOnerrd,
  leerImagenesFacturaOnerrd,
} from 'src/services/certificado-onerrd-service';

import {
  medirTextoOnerrd,
  cargarLetrasOnerrd,
  prepararTextosParaPdfOnerrd,
} from './imagenes-onerrd';

// ----------------------------------------------------------------------
// LAS DESCARGAS DE UN CERTIFICADO ONERRD YA EMITIDO, para la pestaña ONERRD y
// para "Certificados creados" (que no carga el editor ni su plantilla).
//
// - El certificado: el PDF que se guardó al emitirlo, el mismo que abre su QR.
// - La factura: se genera al momento con lo que se guardó al emitir (sus
//   datos y la copia de su diseño; sin copia, el diseño de hoy).
// ----------------------------------------------------------------------

export const descargarBlobOnerrd = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

export const tieneFacturaOnerrd = (emitido) => !!datosDeFacturaOnerrd(emitido);

export const tienePdfGuardadoOnerrd = (emitido) =>
  !!urlDelPdfOnerrd(emitido?.numeroRegistro, emitido?.claveAcceso);

// `diseno`: el que se está editando (la prueba); si no, el de la emisión.
export const descargarFacturaOnerrd = async (emitido, { diseno: enPantalla } = {}) => {
  const datos = datosDeFacturaOnerrd(emitido);
  if (!datos) throw new Error('Este certificado se emitió antes de que existiera la factura.');
  const diseno = sanearDisenoFacturaOnerrd(
    enPantalla || emitido.disenoFactura || (await leerDisenoFacturaOnerrd())
  );
  const valores = valoresDeFacturaOnerrd(datos, {
    ...emitido.valores,
    anio: emitido.anio,
    numeroRegistro: emitido.numeroRegistro,
  });
  // Medir con la fuente ya cargada: los que se encogen para caber, igual que en pantalla.
  await cargarLetrasOnerrd(diseno.campos);
  const textos = textosParaPintarOnerrd(
    diseno,
    valores,
    PAGINA_FACTURA_ONERRD.ancho,
    medirTextoOnerrd
  );
  const campos = await prepararTextosParaPdfOnerrd(textos, PAGINA_FACTURA_ONERRD);
  const imagenes = await leerImagenesFacturaOnerrd(diseno.imagenes.map((imagen) => imagen.id));
  const { generarFacturaOnerrdPdf } = await import('./factura-onerrd-pdf');
  descargarBlobOnerrd(
    await generarFacturaOnerrdPdf({ diseno, datos, campos, imagenes }),
    nombreDeArchivoFacturaOnerrd(emitido)
  );
};

export const descargarCertificadoOnerrdGuardado = async (emitido) => {
  const url = urlDelPdfOnerrd(emitido?.numeroRegistro, emitido?.claveAcceso, { descargar: true });
  if (!url)
    throw new Error(
      'Este certificado no tiene PDF guardado (se emitió antes de que se guardaran).'
    );
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(
      respuesta.status === 404
        ? 'Su PDF no se guardó al emitirlo.'
        : 'No se pudo descargar el certificado.'
    );
  }
  descargarBlobOnerrd(await respuesta.blob(), `certificado-onerrd-${emitido.numeroRegistro}.pdf`);
};

// La de "PDF de prueba": con los datos y el diseño en pantalla, sello PRUEBA y
// sin gastar número.
export const descargarFacturaDePruebaOnerrd = (valores, anio, diseno, numeroRegistro) =>
  descargarFacturaOnerrd(facturaDePruebaOnerrd(valores, { anio, numeroRegistro }), { diseno });
