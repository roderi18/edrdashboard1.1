// ----------------------------------------------------------------------
// FOTOS DE PERFIL A WEBP, DE UNA VEZ.
//
// Las fotos de perfil que se suben hoy ya son WebP. Las de antes siguen en
// Storage como JPG o PNG. Este script:
//
//   1. Informa cuanto pesan las fotos de los perfiles (miembros, destacamentos,
//      secciones y regiones) y cuales de cualquier otra carpeta son pesadas.
//   2. Convierte a WebP las fotos de perfil ACTIVAS que no lo son, con los
//      mismos numeros que usa hoy la subida (900 px, calidad 82), y les crea la
//      miniatura de 128 px si les falta.
//   3. Deja la original donde estaba y apunta el registro de `fotos` a la nueva.
//      NO BORRA NADA: la original sigue sirviendo a cualquier enlace viejo (las
//      copias de la foto en las directivas, por ejemplo). Borrarlas es otro paso,
//      cuando se haya comprobado que todo se ve bien.
//
// Si la WebP saliera MAS pesada que la original, se deja la original.
//
// Uso:
//   node scripts/convertir-fotos-webp.mjs               informe y simulacion: mide
//                                                       cuanto se ahorraria, no escribe
//   node scripts/convertir-fotos-webp.mjs --aplicar     convierte y actualiza `fotos`
//   node scripts/convertir-fotos-webp.mjs --calidad=88  otra calidad (por defecto 82)
//   node scripts/convertir-fotos-webp.mjs --sin-medir   solo el informe, sin descargar
//
// Lee FIREBASE_SERVICE_ACCOUNT y NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET de .env.local.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import {
  megas,
  planDeFoto,
  urlDeDescarga,
  AJUSTE_FOTO,
  resumirStorage,
  TIPOS_DE_PERFIL,
  AJUSTE_MINIATURA,
  CARPETAS_DE_PERFIL,
  UMBRAL_PESADA_BYTES,
} from '../src/utils/fotos-webp.mjs';

const APLICAR = process.argv.includes('--aplicar');
const MEDIR = !process.argv.includes('--sin-medir');
const CALIDAD =
  Number(process.argv.find((arg) => arg.startsWith('--calidad='))?.split('=')[1]) ||
  AJUSTE_FOTO.calidad;
const EN_PARALELO = 4;

// ----------------------------------------------------------------------

const leerEntorno = () => {
  const texto = fs.readFileSync('.env.local', 'utf8');
  const valor = (nombre) =>
    texto
      .match(new RegExp(`^${nombre}=(.*)$`, 'm'))?.[1]
      ?.trim()
      .replace(/^["']|["']$/g, '');

  const crudo = valor('FIREBASE_SERVICE_ACCOUNT');
  const bucket = valor('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');

  if (!crudo) throw new Error('FIREBASE_SERVICE_ACCOUNT no está en .env.local');
  if (!bucket) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET no está en .env.local');

  const cuenta = JSON.parse(crudo);

  if (typeof cuenta.private_key === 'string') {
    cuenta.private_key = cuenta.private_key.replace(/\\n/g, '\n');
  }

  return { cuenta, bucket };
};

const { cuenta, bucket: nombreBucket } = leerEntorno();
const app = initializeApp({
  credential: cert(cuenta),
  projectId: cuenta.project_id,
  storageBucket: nombreBucket,
});
const db = getFirestore(app);
const bucket = getStorage(app).bucket();

/** De a pocos: Storage corta si se le piden cientos de descargas a la vez. */
const enTandas = async (elementos, tarea) => {
  const resultados = [];

  for (let inicio = 0; inicio < elementos.length; inicio += EN_PARALELO) {
    // eslint-disable-next-line no-await-in-loop
    const tanda = await Promise.all(elementos.slice(inicio, inicio + EN_PARALELO).map(tarea));

    resultados.push(...tanda);
  }

  return resultados;
};

const aWebp = (entrada, { lado, calidad }) =>
  sharp(entrada)
    // Las fotos del telefono vienen giradas por metadato: se aplica antes de
    // quitarlo, o salen de lado.
    .rotate()
    .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: calidad })
    .toBuffer();

const subir = async (ruta, contenido) => {
  const token = randomUUID();

  await bucket.file(ruta).save(contenido, {
    resumable: false,
    metadata: {
      contentType: 'image/webp',
      // Igual que la subida de hoy: al cambiar la foto cambia la direccion, asi
      // que el navegador puede guardarla para siempre.
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: token, convertidaPor: 'convertir-fotos-webp' },
    },
  });

  return urlDeDescarga({ bucket: nombreBucket, ruta, token });
};

// ----------------------------------------------------------------------
// 1. TODO STORAGE, PARA EL INFORME
// ----------------------------------------------------------------------

console.log(`\nBucket: ${nombreBucket}`);
console.log(APLICAR ? 'Modo: APLICAR (escribe)\n' : 'Modo: simulación (no escribe nada)\n');

const [objetos] = await bucket.getFiles();
const archivos = objetos.map((objeto) => ({
  ruta: objeto.name,
  bytes: Number(objeto.metadata?.size ?? 0),
  tipo: objeto.metadata?.contentType ?? '',
}));
const archivoPorRuta = new Map(archivos.map((archivo) => [archivo.ruta, archivo]));
const resumen = resumirStorage(archivos);

// ----------------------------------------------------------------------
// 2. LAS FOTOS DE PERFIL ACTIVAS Y QUE HACER CON CADA UNA
// ----------------------------------------------------------------------

const registros = (
  await Promise.all(
    TIPOS_DE_PERFIL.map((tipoEntidad) =>
      db.collection('fotos').where('tipoEntidad', '==', tipoEntidad).get()
    )
  )
).flatMap((consulta) => consulta.docs);

const planes = registros.map((documento) => {
  const registro = documento.data();
  const plan = planDeFoto(registro, archivoPorRuta.get(registro.rutaArchivo) ?? null);

  // `rutaArchivo` vacia en las fotos viejas: se busca por la que sale de la URL.
  const conArchivo =
    plan.motivo === 'el archivo no está en Storage' || plan.motivo === 'sin ruta'
      ? planDeFoto(registro, archivoPorRuta.get(plan.ruta) ?? null)
      : plan;

  return { documento, registro, plan: conArchivo };
});

const aConvertir = planes.filter(({ plan }) => ['convertir', 'miniatura'].includes(plan.accion));

// ----------------------------------------------------------------------
// 3. MEDIR (Y, CON --aplicar, ESCRIBIR)
// ----------------------------------------------------------------------

let antes = 0;
let despues = 0;
let convertidas = 0;
let miniaturas = 0;
const fallos = [];
const sinGanancia = [];

if (MEDIR || APLICAR) {
  await enTandas(aConvertir, async ({ documento, registro, plan }) => {
    try {
      const [original] = await bucket.file(plan.ruta).download();
      const convertir = plan.accion === 'convertir';
      const foto = convertir
        ? await aWebp(original, { lado: AJUSTE_FOTO.lado, calidad: CALIDAD })
        : original;
      const miniatura = plan.faltaMiniatura ? await aWebp(original, AJUSTE_MINIATURA) : null;

      if (convertir && foto.length >= original.length) {
        sinGanancia.push({ ruta: plan.ruta, antes: original.length, despues: foto.length });
        if (!miniatura) return;
      }

      const convierteDeVerdad = convertir && foto.length < original.length;

      if (convierteDeVerdad) {
        antes += original.length;
        despues += foto.length;
        convertidas += 1;
      }

      if (miniatura) miniaturas += 1;

      if (!APLICAR) return;

      const cambios = { actualizadoEn: FieldValue.serverTimestamp() };

      if (convierteDeVerdad) {
        cambios.urlFoto = await subir(plan.rutaWebp, foto);
        cambios.rutaArchivo = plan.rutaWebp;
        cambios.urlFotoOriginal = registro.urlFoto ?? '';
        cambios.rutaArchivoOriginal = plan.ruta;
        cambios.convertidaAWebpEn = FieldValue.serverTimestamp();
      }

      if (miniatura) cambios.urlFotoMiniatura = await subir(plan.rutaMiniatura, miniatura);

      await documento.ref.set(cambios, { merge: true });
    } catch (error) {
      fallos.push({ ruta: plan.ruta, error: error?.message ?? String(error) });
    }
  });
}

// ----------------------------------------------------------------------
// 4. INFORME
// ----------------------------------------------------------------------

console.log('FOTOS DE PERFIL EN STORAGE (todo lo que hay en cada carpeta)');
Object.entries(CARPETAS_DE_PERFIL).forEach(([tipo, carpeta]) => {
  const cuentaCarpeta = resumen.porCarpeta[carpeta];

  console.log(
    `  ${tipo.padEnd(13)} ${String(cuentaCarpeta.archivos).padStart(5)} archivos  ${megas(cuentaCarpeta.bytes).padStart(10)}` +
      `   (no WebP: ${cuentaCarpeta.noWebp}, ${megas(cuentaCarpeta.bytesNoWebp)})`
  );
});
console.log(`  ${'TOTAL'.padEnd(13)} ${' '.repeat(15)}${megas(resumen.total).padStart(10)}\n`);

const porAccion = planes.reduce((cuentas, { plan }) => {
  const clave = plan.accion === 'fuera' ? `fuera: ${plan.motivo}` : plan.accion;

  return { ...cuentas, [clave]: (cuentas[clave] ?? 0) + 1 };
}, {});

console.log(`REGISTROS EN \`fotos\` DE PERFILES: ${planes.length}`);
Object.entries(porAccion).forEach(([accion, cantidad]) =>
  console.log(`  ${accion.padEnd(34)} ${cantidad}`)
);

if (MEDIR || APLICAR) {
  console.log(`\nCONVERSIÓN (calidad ${CALIDAD}, lado máximo ${AJUSTE_FOTO.lado} px)`);
  console.log(`  ${APLICAR ? 'Convertidas' : 'Se convertirían'}: ${convertidas}`);
  console.log(`  Antes:   ${megas(antes)}`);
  console.log(`  Después: ${megas(despues)}`);
  console.log(
    `  Ahorro:  ${megas(antes - despues)}${antes ? ` (${Math.round((1 - despues / antes) * 100)} %)` : ''}`
  );
  console.log(`  Miniaturas ${APLICAR ? 'creadas' : 'por crear'}: ${miniaturas}`);

  if (sinGanancia.length) {
    console.log(`  Se quedan como están (la WebP pesaba más): ${sinGanancia.length}`);
  }
}

console.log(
  `\nOTRAS IMÁGENES PESADAS (desde ${megas(UMBRAL_PESADA_BYTES)}, fuera de los perfiles)`
);
if (!resumen.pesadas.length) console.log('  Ninguna.');
resumen.pesadas.forEach(({ ruta, bytes, tipo }) =>
  console.log(`  ${megas(bytes).padStart(10)}  ${tipo.padEnd(11)} ${ruta}`)
);
console.log(
  `  Total: ${resumen.pesadas.length} imágenes, ${megas(resumen.pesadas.reduce((suma, { bytes }) => suma + bytes, 0))}`
);

if (fallos.length) {
  console.log(`\nFALLOS (${fallos.length})`);
  fallos.forEach(({ ruta, error }) => console.log(`  ${ruta}: ${error}`));
}

if (!APLICAR) {
  console.log(
    '\nNo se escribió nada. Para convertir: node scripts/convertir-fotos-webp.mjs --aplicar'
  );
}
