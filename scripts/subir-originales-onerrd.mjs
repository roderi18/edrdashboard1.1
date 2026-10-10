// ----------------------------------------------------------------------
// SUBE A STORAGE LOS ORIGINALES DEL CERTIFICADO ONERRD QUE YA ESTABAN CARGADOS.
//
// Desde ahora la pantalla guarda solos el .svg de cada plantilla y la imagen de
// cada firma en `certificados-onerrd/plantillas/` y `certificados-onerrd/firmas/`.
// Lo subido antes solo quedó en Firestore (la plantilla convertida en imagen,
// la firma reducida). Esto pone lo que hay:
//
// - La plantilla: el .svg del equipo (por defecto el de
//   docs/documentosNoUsados/marca/Registros ON/), con su fecha y hora. Si es
//   el mismo archivo que la plantilla en uso (mismo nombre), esta apunta a él
//   (`certificadosOnerrd/fondo.rutaSvg`).
// - Las firmas: la imagen que guarda cada `firmasCertificadosOnerrd/{id}` (su
//   original no existe), y la firma apunta a ella (`rutaArchivo`). Las que ya
//   tienen original no se tocan.
//
// No borra nada. Escribe con el Admin SDK (sin Historial: es una carga única).
//
// Uso:
//   node scripts/subir-originales-onerrd.mjs              → dev, solo muestra qué haría
//   node scripts/subir-originales-onerrd.mjs --aplicar    → dev, lo hace
//   node scripts/subir-originales-onerrd.mjs --prod ...   → producción (.env.local)
//   node scripts/subir-originales-onerrd.mjs --svg ruta/al/archivo.svg ...
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { cert, initializeApp } from 'firebase-admin/app';

import { COLECCIONES } from '../src/config/esquema-firestore.mjs';
import { rutaFirmaOnerrd, rutaPlantillaOnerrd } from '../src/utils/certificado-onerrd.mjs';

const APLICAR = process.argv.includes('--aplicar');
const PROD = process.argv.includes('--prod');
const indiceSvg = process.argv.indexOf('--svg');
const SVG =
  indiceSvg > -1
    ? process.argv[indiceSvg + 1]
    : 'docs/documentosNoUsados/marca/Registros ON/Plantilla-Certificado de Renovación anual errd.svg';
const ENTORNO = PROD ? '.env.local' : '.env.development.local';

const leerVariable = (texto, nombre) =>
  texto.match(new RegExp(`^${nombre}=(.*)$`, 'm'))?.[1]?.replace(/^["']|["']$/g, '') || '';

const texto = fs.readFileSync(ENTORNO, 'utf8');
const crudo = leerVariable(texto, 'FIREBASE_SERVICE_ACCOUNT');
if (!crudo) throw new Error(`FIREBASE_SERVICE_ACCOUNT no está en ${ENTORNO}`);
const cuenta = JSON.parse(crudo);
if (typeof cuenta.private_key === 'string') {
  cuenta.private_key = cuenta.private_key.replace(/\\n/g, '\n');
}
const bucketNombre =
  leerVariable(texto, 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET') ||
  `${cuenta.project_id}.firebasestorage.app`;

initializeApp({
  credential: cert(cuenta),
  projectId: cuenta.project_id,
  storageBucket: bucketNombre,
});
const db = getFirestore();
const bucket = getStorage().bucket();

console.log(`Proyecto: ${cuenta.project_id} · bucket: ${bucketNombre}`);
console.log(APLICAR ? 'Modo: APLICAR\n' : 'Modo: solo mostrar (añade --aplicar para hacerlo)\n');

// ---------------------------------------------------------------- plantilla

const refFondo = db.collection(COLECCIONES.certificadosOnerrd).doc('fondo');
const fondo = (await refFondo.get()).data() || {};
const nombreSvg = path.basename(SVG);

if (!fs.existsSync(SVG)) {
  console.log(`Plantilla: no existe ${SVG}; no se sube.`);
} else {
  const ruta = rutaPlantillaOnerrd(nombreSvg);
  const esLaEnUso = fondo.nombreArchivo === nombreSvg;
  console.log(`Plantilla: ${nombreSvg} → ${ruta}`);
  console.log(
    `  En uso: ${fondo.nombreArchivo || '(ninguna)'}${fondo.rutaSvg ? ` · ya tiene original: ${fondo.rutaSvg}` : ''}`
  );
  console.log(
    esLaEnUso
      ? '  Es la plantilla en uso: la plantilla apuntará a este original.'
      : '  No es la plantilla en uso (otro nombre): se sube, pero la plantilla no apunta a él.'
  );
  if (APLICAR) {
    await bucket.file(ruta).save(fs.readFileSync(SVG), {
      contentType: 'image/svg+xml',
      metadata: { metadata: { modulo: 'certificado-onerrd', nombreOriginal: nombreSvg } },
    });
    if (esLaEnUso && !fondo.rutaSvg) await refFondo.set({ rutaSvg: ruta }, { merge: true });
    console.log('  Subida.');
  }
}

// ---------------------------------------------------------------- firmas

const firmas = await db.collection(COLECCIONES.firmasCertificadosOnerrd).get();
console.log(`\nFirmas: ${firmas.size}`);

for (const documento of firmas.docs) {
  const firma = documento.data();
  const datos = String(firma.dataUrl || '').match(/^data:(image\/[a-z]+);base64,(.+)$/);
  const ruta = datos ? rutaFirmaOnerrd(documento.id, datos[1]) : '';

  if (firma.rutaArchivo) {
    console.log(`  ${documento.id} (${firma.nombre}): ya tiene original, no se toca.`);
  } else if (!ruta) {
    console.log(`  ${documento.id} (${firma.nombre}): sin imagen válida, no se sube.`);
  } else {
    console.log(`  ${documento.id} (${firma.nombre}) → ${ruta}`);
    if (APLICAR) {
      // eslint-disable-next-line no-await-in-loop
      await bucket.file(ruta).save(Buffer.from(datos[2], 'base64'), {
        contentType: datos[1],
        metadata: { metadata: { modulo: 'certificado-onerrd', nombreFirma: firma.nombre || '' } },
      });
      // eslint-disable-next-line no-await-in-loop
      await documento.ref.set({ rutaArchivo: ruta }, { merge: true });
      console.log('    Subida.');
    }
  }
}
