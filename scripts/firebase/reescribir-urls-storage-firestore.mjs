#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

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

const proyectoDestino = String(argumentos.get('destino') || '');
const rutaRespaldo = String(argumentos.get('respaldo') || '');
const aplicar = argumentos.has('aplicar');
const confirmar = String(argumentos.get('confirmar') || '');
const bucketOrigen = 'systexploradores.firebasestorage.app';

if (!/^systexploradores-(dev|qa)$/.test(proyectoDestino)) {
  throw new Error('El destino debe ser systexploradores-dev o systexploradores-qa.');
}
if (!rutaRespaldo) throw new Error('Debe indicar --respaldo=<archivo.json.gz>.');
if (aplicar && confirmar !== proyectoDestino) {
  throw new Error(`Para escribir agregue --confirmar=${proyectoDestino}`);
}

const bucketDestino = `${proyectoDestino}.firebasestorage.app`;
const cuenta = getGlobalDefaultAccount();
if (!cuenta) throw new Error('Firebase CLI no tiene una sesión activa.');
await requireAuth({ project: proyectoDestino, user: cuenta.user, tokens: cuenta.tokens });

const cliente = new Client({
  urlPrefix: 'https://firestore.googleapis.com',
  apiVersion: 'v1',
});

function reemplazar(valor, contador) {
  if (typeof valor === 'string') {
    const coincidencias = valor.split(bucketOrigen).length - 1;
    if (coincidencias) {
      contador.total += coincidencias;
      return valor.replaceAll(bucketOrigen, bucketDestino);
    }
    return valor;
  }
  if (Array.isArray(valor)) return valor.map((elemento) => reemplazar(elemento, contador));
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([clave, contenido]) => [clave, reemplazar(contenido, contador)])
    );
  }
  return valor;
}

function contarTexto(valor, texto) {
  if (typeof valor === 'string') return valor.split(texto).length - 1;
  if (!valor || typeof valor !== 'object') return 0;
  return Object.values(valor).reduce((total, contenido) => total + contarTexto(contenido, texto), 0);
}

const respaldo = JSON.parse(gunzipSync(await readFile(rutaRespaldo)).toString('utf8'));
const actualizaciones = [];
let reemplazosEsperados = 0;
for (const documento of respaldo.documentos || []) {
  const contador = { total: 0 };
  const fields = reemplazar(documento.fields, contador);
  if (contador.total) {
    reemplazosEsperados += contador.total;
    actualizaciones.push({ ruta: documento.ruta, fields, reemplazos: contador.total });
  }
}

console.log(`Destino: ${proyectoDestino}`);
console.log(`Documentos que cambiarán: ${actualizaciones.length}`);
console.log(`URLs que cambiarán: ${reemplazosEsperados}`);

if (!aplicar) {
  console.log(`Plan listo. Para ejecutar: --aplicar --confirmar=${proyectoDestino}`);
  process.exit(0);
}

for (let indice = 0; indice < actualizaciones.length; indice += 200) {
  const lote = actualizaciones.slice(indice, indice + 200);
  await cliente.post(`projects/${proyectoDestino}/databases/(default)/documents:commit`, {
    writes: lote.map((documento) => ({
      update: {
        name: `projects/${proyectoDestino}/databases/(default)/documents/${documento.ruta}`,
        fields: documento.fields,
      },
    })),
  });
  console.log(`Actualizados ${Math.min(indice + lote.length, actualizaciones.length)}/${actualizaciones.length}`);
}

let siguiente = 0;
let verificadas = 0;
let referenciasOrigen = 0;
let referenciasDestino = 0;
const errores = [];

async function trabajador() {
  while (true) {
    const indice = siguiente;
    siguiente += 1;
    if (indice >= actualizaciones.length) return;
    const documento = actualizaciones[indice];
    try {
      const respuesta = await cliente.get(
        `projects/${proyectoDestino}/databases/(default)/documents/${documento.ruta}`
      );
      referenciasOrigen += contarTexto(respuesta.body.fields, bucketOrigen);
      referenciasDestino += contarTexto(respuesta.body.fields, bucketDestino);
      verificadas += 1;
      if (verificadas % 250 === 0 || verificadas === actualizaciones.length) {
        console.log(`Verificados ${verificadas}/${actualizaciones.length}`);
      }
    } catch (error) {
      errores.push(documento.ruta);
    }
  }
}

await Promise.all(Array.from({ length: 12 }, () => trabajador()));

if (
  errores.length ||
  referenciasOrigen !== 0 ||
  referenciasDestino !== reemplazosEsperados
) {
  throw new Error(
    `Verificación fallida: errores=${errores.length}, referenciasOrigen=${referenciasOrigen}, ` +
    `referenciasDestino=${referenciasDestino}/${reemplazosEsperados}`
  );
}

console.log(
  `URLS VERIFICADAS: ${referenciasDestino} referencias apuntan a ${bucketDestino}; ` +
  'ninguna apunta a Producción.'
);

