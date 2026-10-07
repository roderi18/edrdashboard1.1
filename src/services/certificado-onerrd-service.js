import { doc, limit, query, getDoc, getDocs, orderBy, collection } from 'firebase/firestore';

import { conCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import {
  regionOnerrd,
  REGIONES_ONERRD,
  idContadorOnerrd,
  sanearDisenoOnerrd,
  esAnioDeRegistroValido,
  idDocumentoIconoRegionOnerrd,
} from 'src/utils/certificado-onerrd.mjs';
import {
  esIdImagenFacturaOnerrd,
  ID_DISENO_FACTURA_ONERRD,
  disenoFacturaParaGuardar,
  sanearDisenoFacturaOnerrd,
  crearIdImagenFacturaOnerrd,
} from 'src/utils/factura-onerrd.mjs';

import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';
import {
  subirPdfOnerrd,
  COLECCION_ONERRD,
  escribirFirmaOnerrd,
  escribirEmisionOnerrd,
  COLECCION_ONERRD_FIRMAS,
  escribirDocumentoOnerrd,
  COLECCION_ONERRD_EMITIDOS,
} from 'src/services/certificado-onerrd-apply';

// ----------------------------------------------------------------------
// CERTIFICADO ONERRD EN FIRESTORE.
//
// Las imágenes (fondo rasterizado, imagen y firmas) se guardan como data URL
// dentro de su propio documento, no en Storage: los buckets no tienen CORS y
// el PDF (`@react-pdf/renderer`) y el lienzo necesitan leer los bytes desde el
// navegador. Cada una se reduce antes de subir para caber holgada en el límite
// de 1 MB por documento (`imagenes-onerrd.js`).
//
//   certificadosOnerrd/fondo          { dataUrl, pagina, nombreArchivo, ... }
//   certificadosOnerrd/imagen         { dataUrl, proporcion, ... }
//   certificadosOnerrd/diseno         { campos, firmas, imagen, iconoRegion, qr }
//   certificadosOnerrd/diseno-factura { campos, tabla, sello, linea, imagenes } (la factura)
//   certificadosOnerrd/factura-imagen-<ms> { dataUrl, proporcion, ... } (sus imágenes)
//   certificadosOnerrd/region-{id}    { dataUrl, proporcion, ... } (icono de cada región)
//   certificadosOnerrd/contador-AAAA  { anio, ultimo }
//   certificadosOnerrdEmitidos/AAAA-NNN
//   firmasCertificadosOnerrd/{id}     { nombre, dataUrl, proporcion, activo }
//
// Solo Administrador Global y Oficina Nacional (ver `firestore.rules`). Toda
// escritura pasa por `proponerCambio` (ámbito `certificado_onerrd`): se aplica
// en el acto y queda en Historial. Las imágenes no entran en Historial, solo su
// nombre de archivo.
// ----------------------------------------------------------------------

const COLECCION = COLECCION_ONERRD;
const COLECCION_EMITIDOS = COLECCION_ONERRD_EMITIDOS;
const COLECCION_FIRMAS = COLECCION_ONERRD_FIRMAS;

const PREFIJO = 'certificados-onerrd:';

const asegurarFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado.');
  }
};

export const autorDeOnerrd = (user) => ({
  uid: user?.uid || user?.id || '',
  nombre:
    user?.displayName ||
    [user?.nombres, user?.apellidos].filter(Boolean).join(' ') ||
    user?.email ||
    'Usuario',
  // Sale debajo del nombre en "Certificados creados".
  codigo: String(user?.codigoMiembro || user?.codigoUsuario || ''),
});

const leerDocumento = async (id) => {
  asegurarFirebase();
  const instantanea = await getDoc(doc(FIRESTORE, COLECCION, id));
  return instantanea.exists() ? instantanea.data() : null;
};

// ---------------------------------------------------------------------- lecturas

export const leerFondoOnerrd = conCache(`${PREFIJO}fondo`, () => leerDocumento('fondo'));

export const leerImagenOnerrd = conCache(`${PREFIJO}imagen`, () => leerDocumento('imagen'));

// { central: { dataUrl, proporcion }, norte: … }: solo las que tienen icono.
export const leerIconosRegionOnerrd = conCache(`${PREFIJO}iconos-region`, async () => {
  const leidos = await Promise.all(
    REGIONES_ONERRD.map((region) => leerDocumento(idDocumentoIconoRegionOnerrd(region.id)))
  );
  return Object.fromEntries(
    REGIONES_ONERRD.map((region, i) => [region.id, leidos[i]]).filter(([, icono]) => icono?.dataUrl)
  );
});

export const leerDisenoOnerrd = conCache(`${PREFIJO}diseno`, async () =>
  sanearDisenoOnerrd((await leerDocumento('diseno')) || undefined)
);

// Todas, también las retiradas (`activo: false`): un certificado ya emitido
// se vuelve a descargar con la firma que llevó. La pantalla solo ofrece las
// activas para firmar los nuevos.
export const listarFirmasOnerrd = conCache(`${PREFIJO}firmas`, async () => {
  asegurarFirebase();
  const instantanea = await getDocs(collection(FIRESTORE, COLECCION_FIRMAS));
  return instantanea.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((firma) => firma.dataUrl)
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
});

export const leerUltimoNumeroOnerrd = conCache(`${PREFIJO}contador`, async (anio) => {
  if (!esAnioDeRegistroValido(anio)) return 0;
  const contador = await leerDocumento(idContadorOnerrd(anio));
  return Number(contador?.ultimo) || 0;
});

export const listarEmitidosOnerrd = conCache(`${PREFIJO}emitidos`, async () => {
  asegurarFirebase();
  const instantanea = await getDocs(
    query(collection(FIRESTORE, COLECCION_EMITIDOS), orderBy('emitidoEnIso', 'desc'), limit(100))
  );
  return instantanea.docs.map((item) => ({ id: item.id, ...item.data() }));
});

// ---------------------------------------------------------------------- escrituras

const ENTIDAD = {
  tipo: 'certificado_onerrd',
  id: 'onerrd',
  nombre: 'Certificado ONERRD',
  ruta: '/dashboard/certificates',
};

// Registra en Historial y aplica en el acto. `aplicar` puede devolver un
// resultado (la emisión devuelve el número): `proponerCambio` no lo pasa, así
// que se recoge aquí.
const registrarYAplicar = async ({ usuario, descripcion, cambios = [], entidad = {}, aplicar }) => {
  asegurarFirebase();
  let resultado;
  await proponerCambio({
    ambito: AMBITOS_CAMBIO.certificadoOnerrd,
    entidad: { ...ENTIDAD, ...entidad },
    cambios,
    usuario,
    descripcion,
    aplicarDirecto: true,
    lecturasAfectadas: [PREFIJO],
    aplicar: async () => {
      resultado = await aplicar();
    },
  });
  return resultado;
};

export const guardarFondoOnerrd = conInvalidacion(
  ({ dataUrl, pagina, nombreArchivo, user }) =>
    registrarYAplicar({
      usuario: user,
      descripcion: `Plantilla del certificado ONERRD: ${nombreArchivo || 'SVG'}.`,
      cambios: [
        { campo: 'plantilla', etiqueta: 'Plantilla', antes: '', despues: nombreArchivo || 'SVG' },
      ],
      aplicar: () =>
        escribirDocumentoOnerrd(
          'fondo',
          { dataUrl, pagina, nombreArchivo: nombreArchivo || '' },
          autorDeOnerrd(user)
        ),
    }),
  [`${PREFIJO}fondo`]
);

export const guardarImagenOnerrd = conInvalidacion(
  ({ dataUrl, proporcion, nombreArchivo, user }) =>
    registrarYAplicar({
      usuario: user,
      descripcion: dataUrl
        ? `Imagen del certificado ONERRD: ${nombreArchivo || 'imagen'}.`
        : 'Imagen del certificado ONERRD quitada.',
      cambios: [
        {
          campo: 'imagen',
          etiqueta: 'Imagen',
          antes: '',
          despues: dataUrl ? nombreArchivo || 'imagen' : '(sin imagen)',
        },
      ],
      aplicar: () =>
        escribirDocumentoOnerrd(
          'imagen',
          {
            dataUrl: dataUrl || '',
            proporcion: Number(proporcion) || 1,
            nombreArchivo: nombreArchivo || '',
          },
          autorDeOnerrd(user)
        ),
    }),
  [`${PREFIJO}imagen`]
);

// Sin `dataUrl`, quita el icono de esa región (el documento queda vacío: nada
// se borra).
export const guardarIconoRegionOnerrd = conInvalidacion(
  ({ region, dataUrl, proporcion, nombreArchivo, user }) => {
    const datos = regionOnerrd(region);
    if (!datos) throw new Error('Región desconocida.');
    return registrarYAplicar({
      usuario: user,
      descripcion: dataUrl
        ? `Icono de la ${datos.nombre} del certificado ONERRD: ${nombreArchivo || 'icono'}.`
        : `Icono de la ${datos.nombre} del certificado ONERRD quitado.`,
      cambios: [
        {
          campo: `iconoRegion.${datos.id}`,
          etiqueta: `Icono de la ${datos.nombre}`,
          antes: '',
          despues: dataUrl ? nombreArchivo || 'icono' : '(sin icono)',
        },
      ],
      aplicar: () =>
        escribirDocumentoOnerrd(
          idDocumentoIconoRegionOnerrd(datos.id),
          {
            region: datos.id,
            dataUrl: dataUrl || '',
            proporcion: Number(proporcion) || 1,
            nombreArchivo: nombreArchivo || '',
          },
          autorDeOnerrd(user)
        ),
    });
  },
  [`${PREFIJO}iconos-region`]
);

export const guardarDisenoOnerrd = conInvalidacion(
  ({ diseno, user }) =>
    registrarYAplicar({
      usuario: user,
      descripcion: 'Diseño del certificado ONERRD guardado (posiciones, textos y firmas).',
      aplicar: () =>
        escribirDocumentoOnerrd('diseno', sanearDisenoOnerrd(diseno), autorDeOnerrd(user)),
    }),
  [`${PREFIJO}diseno`]
);

// El diseño de la factura: sin guardar, el de fábrica (el del ejemplo).
export const leerDisenoFacturaOnerrd = conCache(`${PREFIJO}diseno-factura`, async () =>
  sanearDisenoFacturaOnerrd((await leerDocumento(ID_DISENO_FACTURA_ONERRD)) || undefined)
);

export const guardarDisenoFacturaOnerrd = conInvalidacion(
  ({ diseno, user }) =>
    registrarYAplicar({
      usuario: user,
      descripcion: 'Diseño de la factura ONERRD guardado (textos, tabla y sello).',
      aplicar: () =>
        escribirDocumentoOnerrd(
          ID_DISENO_FACTURA_ONERRD,
          disenoFacturaParaGuardar(diseno),
          autorDeOnerrd(user)
        ),
    }),
  [`${PREFIJO}diseno-factura`]
);

// Una imagen de la factura, por su id (las del diseño de hoy y las de la copia
// que lleva cada emisión). Sin documento o sin imagen, null.
const leerImagenFacturaOnerrd = conCache(`${PREFIJO}factura-imagen`, async (id) =>
  esIdImagenFacturaOnerrd(id) ? leerDocumento(id) : null
);

// { id: { dataUrl, proporcion } } de las que existan.
export const leerImagenesFacturaOnerrd = async (ids = []) => {
  const unicos = [...new Set(ids.filter(esIdImagenFacturaOnerrd))];
  const leidas = await Promise.all(
    unicos.map((id) => leerImagenFacturaOnerrd(id).catch(() => null))
  );
  return Object.fromEntries(
    unicos.map((id, i) => [id, leidas[i]]).filter(([, imagen]) => imagen?.dataUrl)
  );
};

// Sube una imagen a la factura: su propio documento (nunca se borra). El
// diseño la coloca después; se guarda con "Guardar diseño".
export const guardarImagenFacturaOnerrd = async ({ dataUrl, proporcion, nombreArchivo, user }) => {
  const id = crearIdImagenFacturaOnerrd();
  const imagen = {
    dataUrl,
    proporcion: Number(proporcion) || 1,
    nombreArchivo: nombreArchivo || '',
  };
  await registrarYAplicar({
    usuario: user,
    descripcion: `Imagen subida a la factura ONERRD: ${nombreArchivo || 'imagen'}.`,
    entidad: { tipo: 'factura_onerrd_imagen', id, nombre: nombreArchivo || 'imagen' },
    cambios: [
      {
        campo: 'imagenFactura',
        etiqueta: 'Imagen de la factura',
        antes: '',
        despues: nombreArchivo || 'imagen',
      },
    ],
    aplicar: () => escribirDocumentoOnerrd(id, imagen, autorDeOnerrd(user)),
  });
  return { id, ...imagen };
};

export const guardarFirmaOnerrd = conInvalidacion(
  ({ nombre, dataUrl, proporcion, user }) => {
    const id = `firma-${Date.now()}`;
    const firma = {
      nombre: String(nombre || '')
        .trim()
        .slice(0, 80),
      dataUrl,
      proporcion: Number(proporcion) || 0.4,
      activo: true,
      creadoEn: new Date().toISOString(),
      creadoPor: autorDeOnerrd(user),
    };
    return registrarYAplicar({
      usuario: user,
      descripcion: `Firma añadida al certificado ONERRD: ${firma.nombre}.`,
      entidad: { tipo: 'firma_onerrd', id, nombre: firma.nombre },
      cambios: [{ campo: 'firma', etiqueta: 'Firma', antes: '', despues: firma.nombre }],
      aplicar: async () => {
        await escribirFirmaOnerrd(id, firma);
        return { id, ...firma };
      },
    });
  },
  [`${PREFIJO}firmas`]
);

export const renombrarFirmaOnerrd = conInvalidacion(
  ({ id, nombre, anterior, user }) => {
    const limpio = String(nombre || '')
      .trim()
      .slice(0, 80);
    return registrarYAplicar({
      usuario: user,
      descripcion: `Firma del certificado ONERRD renombrada: ${anterior || id} → ${limpio}.`,
      entidad: { tipo: 'firma_onerrd', id, nombre: limpio },
      cambios: [{ campo: 'nombre', etiqueta: 'Nombre', antes: anterior || '', despues: limpio }],
      aplicar: () => escribirFirmaOnerrd(id, { nombre: limpio }, { fusionar: true }),
    });
  },
  [`${PREFIJO}firmas`]
);

// Nada se borra: una firma retirada queda con `activo: false` (los
// certificados ya emitidos la nombran en su registro).
export const retirarFirmaOnerrd = conInvalidacion(
  ({ id, nombre, user }) =>
    registrarYAplicar({
      usuario: user,
      descripcion: `Firma del certificado ONERRD retirada: ${nombre || id}.`,
      entidad: { tipo: 'firma_onerrd', id, nombre: nombre || '' },
      cambios: [{ campo: 'activo', etiqueta: 'Activa', antes: 'Sí', despues: 'No' }],
      aplicar: () =>
        escribirFirmaOnerrd(
          id,
          { activo: false, retiradaEn: new Date().toISOString(), retiradaPor: autorDeOnerrd(user) },
          { fusionar: true }
        ),
    }),
  [`${PREFIJO}firmas`]
);

// EMITIR: reserva el número y deja el registro (ver `escribirEmisionOnerrd`).
export const emitirCertificadoOnerrd = conInvalidacion(
  async ({ anio, valores, firmas, diseno, claveAcceso, factura, disenoFactura, user }) => {
    if (!esAnioDeRegistroValido(anio)) throw new Error('El año del registro no es válido.');
    const destino = [valores?.numeroDestacamento, valores?.nombreDestacamento]
      .filter(Boolean)
      .join(' ');
    return registrarYAplicar({
      usuario: user,
      descripcion: `Certificado ONERRD emitido (registro ${anio})${destino ? ` para ${destino}` : ''}.`,
      entidad: {
        tipo: 'certificado_onerrd_emitido',
        id: String(anio),
        nombre: destino || `Registro ${anio}`,
      },
      aplicar: () =>
        escribirEmisionOnerrd({
          anio,
          valores,
          firmas,
          diseno,
          claveAcceso,
          factura,
          // La factura se vuelve a bajar con el diseño con que se emitió.
          disenoFactura: factura ? disenoFacturaParaGuardar(disenoFactura) : null,
          autor: autorDeOnerrd(user),
        }),
    });
  },
  [`${PREFIJO}contador`, `${PREFIJO}emitidos`]
);

// Publica el PDF de un certificado emitido para que lo abra su código QR.
export const publicarPdfOnerrd = async (numeroRegistro, blob) => {
  if (!FIREBASE_STORAGE) throw new Error('Firebase Storage no está configurado.');
  await subirPdfOnerrd(numeroRegistro, blob);
};
