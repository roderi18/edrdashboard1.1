import QRCode from 'qrcode';
import { loadImage } from '@napi-rs/canvas';
import { FieldValue } from 'firebase-admin/firestore';

import { direccionPublica } from 'src/utils/direccion-publica.mjs';
import { armarEmision } from 'src/utils/valores-membresia-onerrd.mjs';
import {
  COLECCION_MEMBRESIA,
  DOC_CONFIGURACION_MEMBRESIA,
  sanearConfiguracionMembresia,
} from 'src/utils/membresia-onerrd.mjs';
import {
  anioActualOnerrd,
  datosDeFacturaOnerrd,
  PAGINA_FACTURA_ONERRD,
  valoresDeFacturaOnerrd,
  ID_DISENO_FACTURA_ONERRD,
  disenoFacturaParaGuardar,
  idContadorFacturasOnerrd,
  sanearDisenoFacturaOnerrd,
  formatearNumeroFacturaOnerrd,
} from 'src/utils/factura-onerrd.mjs';
import {
  regionOnerrd,
  rutaPdfOnerrd,
  idContadorOnerrd,
  sanearDisenoOnerrd,
  urlDeFacturaOnerrd,
  rutaFacturaPdfOnerrd,
  formatearNumeroOnerrd,
  textosParaPintarOnerrd,
  esIdImagenSubidaOnerrd,
  urlDelCertificadoOnerrd,
  siguienteSecuenciaOnerrd,
  PAGINA_ONERRD_POR_DEFECTO,
  idDocumentoIconoRegionOnerrd,
} from 'src/utils/certificado-onerrd.mjs';

import { COLECCIONES } from 'src/config/esquema-firestore.mjs';
import { COLECCION_MEMBRESIAS } from 'src/server/membresias-onerrd.mjs';
import { enviarDocumentosDeLaMembresia } from 'src/server/enviar-documentos-membresia-onerrd.mjs';
import {
  crearLienzoOnerrd,
  lineaBaseServidorOnerrd,
  medirTextoServidorOnerrd,
} from 'src/server/medidas-onerrd.mjs';

// ----------------------------------------------------------------------
// EMISIÓN AUTOMÁTICA DEL CERTIFICADO Y LA FACTURA de una membresía 2027, sin
// navegador. Un pago con PayPal queda confirmado al instante (nadie de la
// Oficina Nacional lo valida) y nadie tiene la pestaña ONERRD abierta, así que
// el servidor hace lo mismo que `emitir()` de la pantalla: reserva los dos
// números, genera los dos PDF con el diseño guardado, los deja en Storage (de
// ahí los baja la landing), los anota en la membresía y los envía por correo.
//
// Es idempotente: con la membresía ya emitida no hace nada, y dos llamadas a la
// vez no emiten dos veces (la segunda ve «generando»). Si algo falla DESPUÉS de
// reservar el número, la reintentada reutiliza ese número en vez de gastar otro.
// ----------------------------------------------------------------------

const COLECCION_DISENOS = COLECCIONES.certificadosOnerrd;
const COLECCION_EMITIDOS = COLECCIONES.certificadosOnerrdEmitidos;
const COLECCION_FIRMAS = COLECCIONES.firmasCertificadosOnerrd;

// Una emisión que lleva más que esto «generando» se dio por perdida (la función
// se cortó): se puede volver a intentar.
const ESPERA_MAXIMA_MS = 4 * 60_000;

const AUTOR = Object.freeze({ uid: 'sistema', nombre: 'Sistema', codigo: '' });

const leerDocumento = async (db, id) => {
  if (!id) return null;
  const instantanea = await db.collection(COLECCION_DISENOS).doc(id).get();
  return instantanea.exists ? instantanea.data() : null;
};

// { id: { dataUrl, proporcion } } de las imágenes subidas que existan.
const leerImagenesSubidas = async (db, ids) => {
  const unicos = [...new Set(ids.filter(esIdImagenSubidaOnerrd))];
  const leidas = await Promise.all(unicos.map((id) => leerDocumento(db, id).catch(() => null)));
  return Object.fromEntries(
    unicos.map((id, i) => [id, leidas[i]]).filter(([, imagen]) => imagen?.dataUrl)
  );
};

// La foto de la región de Niveles organizacionales, reducida a PNG (el PDF solo
// entiende PNG y JPG y la foto puede ser WebP o AVIF).
const fotoDeLaRegion = async (db, region) => {
  try {
    const datos = regionOnerrd(region);
    if (!datos) return null;
    const lista = await db.collection('fotos').where('tipoEntidad', '==', 'region').get();
    const foto = lista.docs
      .map((d) => d.data())
      .find(
        (f) =>
          f.tipoFoto === 'perfil' &&
          f.estado === 'activo' &&
          String(f.idEntidad) === String(datos.idRegion) &&
          f.urlFoto
      );
    if (!foto) return null;
    const respuesta = await fetch(foto.urlFoto, { signal: AbortSignal.timeout(15_000) });
    if (!respuesta.ok) return null;
    const imagen = await loadImage(Buffer.from(await respuesta.arrayBuffer()));
    const escala = Math.min(1, 800 / Math.max(imagen.width, imagen.height));
    const ancho = Math.max(1, Math.round(imagen.width * escala));
    const alto = Math.max(1, Math.round(imagen.height * escala));
    const lienzo = crearLienzoOnerrd(ancho, alto);
    lienzo.getContext('2d').drawImage(imagen, 0, 0, ancho, alto);
    return {
      dataUrl: `data:image/png;base64,${lienzo.toBuffer('image/png').toString('base64')}`,
      proporcion: alto / ancho,
    };
  } catch (error) {
    console.error('[emisión onerrd] no se pudo leer la foto de la región', error);
    return null;
  }
};

const origenPublico = () =>
  direccionPublica({
    configurada: process.env.NEXT_PUBLIC_URL_PUBLICA,
    proyecto: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });

const codigoQr = (texto, color = '#000000') =>
  QRCode.toDataURL(texto, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 1024,
    color: { dark: color, light: '#FFFFFF' },
  });

// Cada texto con su fuente, su línea base y, si lleva degradado, dibujado (como
// `prepararTextosParaPdfOnerrd` en el navegador).
const prepararTextos = async (textos, pagina) => {
  const { rasterizarTextoOnerrd } =
    await import('src/sections/certificates/onerrd/imagenes-onerrd');
  return textos
    .filter((t) => t.texto)
    .map((t) => {
      const lineaBase = lineaBaseServidorOnerrd(t.campo);
      return {
        ...t,
        lineaBase,
        ...(t.campo.degradado && {
          dibujo: rasterizarTextoOnerrd({
            ...t,
            pagina,
            lineaBase,
            crearLienzo: crearLienzoOnerrd,
          }),
        }),
      };
    });
};

// Reserva el número de registro y el de factura y deja el registro, todo en
// una transacción (igual que `escribirEmisionOnerrd` del navegador).
const reservarNumeros = (
  db,
  { anio, valores, firmas, diseno, claveAcceso, factura, disenoFactura }
) => {
  const refContador = db.collection(COLECCION_DISENOS).doc(idContadorOnerrd(anio));
  const anioFactura = anioActualOnerrd();
  const refFacturas = db.collection(COLECCION_DISENOS).doc(idContadorFacturasOnerrd(anioFactura));
  return db.runTransaction(async (transaccion) => {
    const [contador, facturas] = await Promise.all([
      transaccion.get(refContador),
      transaccion.get(refFacturas),
    ]);
    const secuenciaFactura = siguienteSecuenciaOnerrd(facturas.exists ? facturas.data().ultimo : 0);
    const secuencia = siguienteSecuenciaOnerrd(contador.exists ? contador.data().ultimo : 0);
    const numeroRegistro = formatearNumeroOnerrd(anio, secuencia);
    const ahora = new Date().toISOString();
    const emitido = {
      numeroRegistro,
      anio: Number(anio),
      secuencia,
      valores: { ...valores, numeroRegistro },
      firmas,
      diseno: sanearDisenoOnerrd(diseno),
      claveAcceso,
      factura: {
        ...factura,
        numero: formatearNumeroFacturaOnerrd(anioFactura, secuenciaFactura),
      },
      disenoFactura: disenoFacturaParaGuardar(disenoFactura),
      emitidoEnIso: ahora,
      emitidoPor: AUTOR,
      emitidoEnServidor: FieldValue.serverTimestamp(),
    };
    transaccion.set(refContador, { anio: Number(anio), ultimo: secuencia, actualizadoEn: ahora });
    transaccion.set(refFacturas, {
      anio: anioFactura,
      ultimo: secuenciaFactura,
      actualizadoEn: ahora,
    });
    transaccion.set(db.collection(COLECCION_EMITIDOS).doc(numeroRegistro), emitido);
    return emitido;
  });
};

// Los dos PDF de una emisión con el diseño guardado. Devuelve dos Buffer.
export const generarPdfsDeEmision = async (
  db,
  emitido,
  { fondo, imagen, firmas, disenoFacturaHoy }
) => {
  const [{ renderToBuffer }, pdfCertificado, pdfFactura] = await Promise.all([
    import('@react-pdf/renderer'),
    import('src/sections/certificates/onerrd/onerrd-pdf'),
    import('src/sections/certificates/onerrd/factura-onerrd-pdf'),
  ]);
  const origen = origenPublico();

  // ---- El certificado
  const pagina = fondo?.pagina || PAGINA_ONERRD_POR_DEFECTO;
  const diseno = sanearDisenoOnerrd(emitido.diseno);
  const valores = { anio: emitido.anio, ...emitido.valores, emitidoEnIso: emitido.emitidoEnIso };
  const textos = await prepararTextos(
    textosParaPintarOnerrd(diseno, valores, pagina.ancho, medirTextoServidorOnerrd),
    pagina
  );
  const imagenesSubidas = await leerImagenesSubidas(
    db,
    (diseno.imagenes || []).map((item) => item.id)
  );
  const propio = await leerDocumento(db, idDocumentoIconoRegionOnerrd(valores.region)).catch(
    () => null
  );
  const iconoRegion = propio?.dataUrl ? propio : await fotoDeLaRegion(db, valores.region);
  const certificado = await renderToBuffer(
    pdfCertificado.elementoCertificadoOnerrd({
      pagina,
      fondo: fondo?.dataUrl,
      imagen,
      iconoRegion,
      diseno,
      firmasPorId: Object.fromEntries(firmas.map((f) => [f.id, f])),
      imagenesSubidas,
      qr: diseno.qr.visible
        ? {
            dataUrl: await codigoQr(
              urlDelCertificadoOnerrd(origen, emitido.numeroRegistro, emitido.claveAcceso),
              diseno.qr.color
            ),
          }
        : null,
      textos: { titulo: `Certificado ONERRD ${emitido.numeroRegistro}`, campos: textos },
    })
  );

  // ---- La factura (con la copia del diseño con que se emitió)
  const datos = datosDeFacturaOnerrd(emitido);
  const disenoFactura = sanearDisenoFacturaOnerrd(emitido.disenoFactura || disenoFacturaHoy);
  const valoresFactura = valoresDeFacturaOnerrd(datos, {
    ...emitido.valores,
    anio: emitido.anio,
    numeroRegistro: emitido.numeroRegistro,
    emitidoEnIso: emitido.emitidoEnIso,
  });
  const camposFactura = await prepararTextos(
    textosParaPintarOnerrd(
      disenoFactura,
      valoresFactura,
      PAGINA_FACTURA_ONERRD.ancho,
      medirTextoServidorOnerrd
    ),
    PAGINA_FACTURA_ONERRD
  );
  const factura = await renderToBuffer(
    pdfFactura.elementoFacturaOnerrd({
      diseno: disenoFactura,
      datos,
      campos: camposFactura,
      imagenes: await leerImagenesSubidas(
        db,
        disenoFactura.imagenes.map((item) => item.id)
      ),
      qr: disenoFactura.qr.visible
        ? await codigoQr(
            urlDeFacturaOnerrd(origen, emitido.numeroRegistro, emitido.claveAcceso),
            disenoFactura.qr.color
          )
        : null,
    })
  );
  return { certificado, factura };
};

const anotarEstado = (referencia, cambios) =>
  referencia.update({ ...cambios, actualizadoEn: FieldValue.serverTimestamp() });

// Devuelve { estado: 'listo' | 'generando' | 'error', numeroRegistro?, error? }.
export async function emitirDocumentosDeMembresia(id, { db, bucket }) {
  const referencia = db.collection(COLECCION_MEMBRESIAS).doc(String(id));

  // 1 · Quedarse con la tarea (o ver que ya está hecha o en marcha).
  const reserva = await db.runTransaction(async (transaccion) => {
    const m = (await transaccion.get(referencia)).data();
    if (!m) return { estado: 'error', error: 'La membresía no existe.' };
    if (m.certificadoEmitido?.numeroRegistro)
      return { estado: 'listo', numeroRegistro: m.certificadoEmitido.numeroRegistro };
    if (m.estado !== 'confirmada')
      return { estado: 'error', error: 'La membresía todavía no está confirmada.' };
    const marca = m.emisionAutomatica;
    if (marca?.estado === 'generando' && Date.now() - Date.parse(marca.inicio) < ESPERA_MAXIMA_MS)
      return { estado: 'generando' };
    transaccion.update(referencia, {
      emisionAutomatica: {
        estado: 'generando',
        inicio: new Date().toISOString(),
        // El número ya reservado de un intento anterior que se cortó.
        numeroRegistro: marca?.numeroRegistro || '',
      },
    });
    return { estado: 'tarea', membresia: m, numeroPrevio: marca?.numeroRegistro || '' };
  });
  if (reserva.estado !== 'tarea') return reserva;

  const { membresia, numeroPrevio } = reserva;
  try {
    // 2 · Lo guardado en el dashboard: configuración, plantilla, imagen, firmas, diseños.
    const [configDoc, fondo, imagenDoc, disenoDoc, disenoFacturaDoc, firmasSnap] =
      await Promise.all([
        db.collection(COLECCION_MEMBRESIA).doc(DOC_CONFIGURACION_MEMBRESIA).get(),
        leerDocumento(db, 'fondo'),
        leerDocumento(db, 'imagen'),
        leerDocumento(db, 'diseno'),
        leerDocumento(db, ID_DISENO_FACTURA_ONERRD),
        db.collection(COLECCION_FIRMAS).get(),
      ]);
    const config = sanearConfiguracionMembresia(configDoc.data() || {});
    const imagen = imagenDoc?.dataUrl ? imagenDoc : null;
    const diseno = sanearDisenoOnerrd(disenoDoc || undefined);
    const disenoFacturaHoy = sanearDisenoFacturaOnerrd(disenoFacturaDoc || undefined);
    const firmas = firmasSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((firma) => firma.dataUrl);

    // 3 · El registro (con sus dos números), o el que ya se había reservado.
    let emitido = null;
    if (numeroPrevio) {
      const previo = await db.collection(COLECCION_EMITIDOS).doc(numeroPrevio).get();
      emitido = previo.exists ? previo.data() : null;
    }
    if (!emitido) {
      emitido = await reservarNumeros(
        db,
        armarEmision({ membresia, config, diseno, firmas, disenoFacturaHoy })
      );
      await anotarEstado(referencia, {
        'emisionAutomatica.numeroRegistro': emitido.numeroRegistro,
      });
    }

    // 4 · Los PDF, guardados donde la landing y el QR los buscan.
    const pdfs = await generarPdfsDeEmision(db, emitido, {
      fondo,
      imagen,
      firmas,
      disenoFacturaHoy,
    });
    const guardar = (ruta, contenido) =>
      bucket.file(ruta).save(contenido, {
        contentType: 'application/pdf',
        metadata: { cacheControl: 'private, max-age=300' },
      });
    await Promise.all([
      guardar(rutaPdfOnerrd(emitido.numeroRegistro), pdfs.certificado),
      guardar(rutaFacturaPdfOnerrd(emitido.numeroRegistro), pdfs.factura),
    ]);

    // 5 · Anotarlo en la membresía: desde aquí la landing los ofrece.
    await anotarEstado(referencia, {
      certificadoEmitido: {
        numeroRegistro: emitido.numeroRegistro,
        facturaNumero: emitido.factura?.numero || '',
        emitidoEn: emitido.emitidoEnIso,
      },
      emisionAutomatica: {
        estado: 'listo',
        numeroRegistro: emitido.numeroRegistro,
        fin: new Date().toISOString(),
      },
    });
    await referencia
      .collection('eventos')
      .add({
        de: 'confirmada',
        a: 'confirmada',
        actor: 'sistema',
        fecha: FieldValue.serverTimestamp(),
        motivo: `Certificado ${emitido.numeroRegistro} y factura ${emitido.factura?.numero || ''} emitidos automáticamente.`,
      })
      .catch(() => null);

    // 6 · El correo a quien pagó (con copia al correo de avisos). Si falla, la
    // emisión sigue hecha: «Reintentar envío» en la tabla de pagos.
    await enviarDocumentosDeLaMembresia({
      db,
      bucket,
      id: String(id),
      membresia,
      config,
      numeroRegistro: emitido.numeroRegistro,
      facturaNumero: emitido.factura?.numero || '',
      pdfs,
    }).catch((error) => console.error('[emisión onerrd] no se pudo enviar el correo', error));

    return { estado: 'listo', numeroRegistro: emitido.numeroRegistro };
  } catch (error) {
    console.error('[emisión onerrd]', error);
    await anotarEstado(referencia, {
      'emisionAutomatica.estado': 'error',
      'emisionAutomatica.error': String(error?.message || error).slice(0, 300),
    }).catch(() => null);
    return { estado: 'error', error: 'No se pudieron generar los documentos.' };
  }
}
