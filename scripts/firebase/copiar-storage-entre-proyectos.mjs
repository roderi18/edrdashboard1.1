#!/usr/bin/env node

import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const directorioFirebaseTools = join(
  process.env.APPDATA || '',
  'npm',
  'node_modules',
  'firebase-tools',
  'lib'
);
const { getGlobalDefaultAccount } = require(join(directorioFirebaseTools, 'auth.js'));
const { requireAuth } = require(join(directorioFirebaseTools, 'requireAuth.js'));
const { Client } = require(join(directorioFirebaseTools, 'apiv2.js'));

const argumentos = new Map(
  process.argv.slice(2).map((argumento) => {
    const [clave, ...partes] = argumento.replace(/^--/, '').split('=');
    return [clave, partes.length ? partes.join('=') : true];
  })
);

const bucketOrigen = String(
  argumentos.get('origen') || 'systexploradores.firebasestorage.app'
);
const bucketDestino = String(argumentos.get('destino') || '');
const aplicar = argumentos.has('aplicar');
const confirmar = String(argumentos.get('confirmar') || '');
const CONCURRENCIA = 12;

if (bucketOrigen !== 'systexploradores.firebasestorage.app') {
  throw new Error('El origen autorizado para esta migración debe ser el bucket de Producción.');
}
if (!/^systexploradores-(dev|qa)\.firebasestorage\.app$/.test(bucketDestino)) {
  throw new Error('El destino debe ser el bucket oficial de Desarrollo o QA.');
}
if (bucketOrigen === bucketDestino) {
  throw new Error('Origen y destino no pueden ser iguales.');
}
if (aplicar && confirmar !== bucketDestino) {
  throw new Error(`Para copiar agregue --confirmar=${bucketDestino}`);
}

const cuenta = getGlobalDefaultAccount();
if (!cuenta) throw new Error('Firebase CLI no tiene una sesión activa.');
await requireAuth({ project: 'systexploradores', user: cuenta.user, tokens: cuenta.tokens });

const cliente = new Client({
  urlPrefix: 'https://storage.googleapis.com',
  apiVersion: 'storage/v1',
});

const camposComparados = [
  'size',
  'md5Hash',
  'crc32c',
  'contentType',
  'cacheControl',
  'contentDisposition',
  'contentEncoding',
  'contentLanguage',
  'customTime',
  'metadata',
];

function serializarEstable(valor) {
  if (Array.isArray(valor)) return `[${valor.map(serializarEstable).join(',')}]`;
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor)
      .sort()
      .map((clave) => `${JSON.stringify(clave)}:${serializarEstable(valor[clave])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valor);
}

function objetoComparable(objeto) {
  return Object.fromEntries(
    camposComparados.map((campo) => [campo, objeto[campo] ?? null])
  );
}

function objetosCoinciden(origen, destino) {
  return serializarEstable(objetoComparable(origen)) === serializarEstable(objetoComparable(destino));
}

async function listarObjetos(bucket) {
  const objetos = [];
  let pageToken;
  do {
    const respuesta = await cliente.get(`b/${bucket}/o`, {
      queryParams: {
        maxResults: 1000,
        ...(pageToken ? { pageToken } : {}),
      },
    });
    objetos.push(...(respuesta.body.items || []));
    pageToken = respuesta.body.nextPageToken;
  } while (pageToken);
  objetos.sort((a, b) => a.name.localeCompare(b.name));
  return objetos;
}

function resumen(objetos) {
  return {
    objetos: objetos.length,
    bytes: objetos.reduce((total, objeto) => total + Number(objeto.size || 0), 0),
  };
}

async function reescribirObjeto(objeto) {
  const nombre = encodeURIComponent(objeto.name);
  const ruta = `b/${bucketOrigen}/o/${nombre}/rewriteTo/b/${bucketDestino}/o/${nombre}`;
  let rewriteToken;
  do {
    const respuesta = await cliente.post(
      ruta,
      {},
      {
        queryParams: {
          sourceGeneration: objeto.generation,
          ifGenerationMatch: '0',
          ...(rewriteToken ? { rewriteToken } : {}),
        },
      }
    );
    if (respuesta.body.done) return;
    rewriteToken = respuesta.body.rewriteToken;
    if (!rewriteToken) throw new Error('Storage no devolvió rewriteToken para continuar la copia.');
  } while (rewriteToken);
}

console.log(`Origen:  gs://${bucketOrigen}`);
console.log(`Destino: gs://${bucketDestino}`);
console.log(`Modo:    ${aplicar ? 'COPIA' : 'SOLO LECTURA'}`);

const objetosOrigen = await listarObjetos(bucketOrigen);
const objetosDestinoAntes = await listarObjetos(bucketDestino);
console.log('Origen:', JSON.stringify(resumen(objetosOrigen)));
console.log('Destino antes:', JSON.stringify(resumen(objetosDestinoAntes)));

const destinoPorNombre = new Map(objetosDestinoAntes.map((objeto) => [objeto.name, objeto]));
const pendientes = [];
let identicos = 0;
for (const objeto of objetosOrigen) {
  const existente = destinoPorNombre.get(objeto.name);
  if (!existente) {
    pendientes.push(objeto);
  } else if (objetosCoinciden(objeto, existente)) {
    identicos += 1;
  } else {
    throw new Error(
      `El destino contiene un objeto diferente con el mismo nombre. Se detuvo sin sobrescribir: ${objeto.name}`
    );
  }
}

console.log(`Objetos idénticos ya presentes: ${identicos}`);
console.log(`Objetos pendientes de copiar: ${pendientes.length}`);

if (!aplicar) {
  console.log(`Plan listo. Para ejecutar: --aplicar --confirmar=${bucketDestino}`);
  process.exit(0);
}

let siguiente = 0;
let copiados = 0;
async function trabajador() {
  while (true) {
    const indice = siguiente;
    siguiente += 1;
    if (indice >= pendientes.length) return;
    await reescribirObjeto(pendientes[indice]);
    copiados += 1;
    if (copiados % 100 === 0 || copiados === pendientes.length) {
      console.log(`Copiados ${copiados}/${pendientes.length}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCIA }, () => trabajador()));

const objetosDestinoDespues = await listarObjetos(bucketDestino);
const destinoFinalPorNombre = new Map(objetosDestinoDespues.map((objeto) => [objeto.name, objeto]));
const errores = [];
for (const objeto of objetosOrigen) {
  const destino = destinoFinalPorNombre.get(objeto.name);
  if (!destino || !objetosCoinciden(objeto, destino)) {
    errores.push(objeto.name);
    if (errores.length >= 10) break;
  }
}

const resumenOrigen = resumen(objetosOrigen);
const resumenDestino = resumen(objetosDestinoDespues);
console.log('Destino después:', JSON.stringify(resumenDestino));
if (
  errores.length ||
  resumenOrigen.objetos !== resumenDestino.objetos ||
  resumenOrigen.bytes !== resumenDestino.bytes
) {
  throw new Error(`La verificación de Storage falló en ${errores.length || 'cantidad/tamaño'} objeto(s).`);
}

console.log('STORAGE VERIFICADO: nombres, tamaños, checksums, metadatos y tokens coinciden.');

