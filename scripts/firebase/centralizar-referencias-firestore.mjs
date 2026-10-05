#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { DEFINICIONES_COLECCIONES } from '../../src/config/esquema-firestore.mjs';

const aplicar = process.argv.includes('--aplicar');
const raiz = path.resolve('src');
const extensiones = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const excluir = new Set([
  path.resolve('src/config/esquema-firestore.mjs'),
  path.resolve('src/config/campos-firestore.mjs'),
]);

const propiedadPorNombre = new Map();
for (const [propiedad, definicion] of Object.entries(DEFINICIONES_COLECCIONES)) {
  for (const nombre of [definicion.canonico, ...definicion.heredados]) {
    if (!propiedadPorNombre.has(nombre)) propiedadPorNombre.set(nombre, propiedad);
  }
}

const escaparRegex = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternativas = [...propiedadPorNombre.keys()]
  .sort((a, b) => b.length - a.length)
  .map(escaparRegex)
  .join('|');

const patrones = [
  new RegExp(
    `(\\.(?:collection)\\(\\s*)(["'])(?<nombre>${alternativas})\\2`,
    'g'
  ),
  new RegExp(
    `(\\b(?:collection|doc)\\(\\s*[^,\\r\\n]+,\\s*)(["'])(?<nombre>${alternativas})\\2`,
    'g'
  ),
  new RegExp(
    `((?:export\\s+)?const\\s+(?:COLECCION|COLLECTION_NAME|BACKUP_META_COLLECTION)[A-Z0-9_]*\\s*=\\s*)(["'])(?<nombre>${alternativas})\\2`,
    'g'
  ),
];

const rutaImportacion = (archivo) => {
  if (path.extname(archivo) !== '.mjs') return 'src/config/esquema-firestore.mjs';
  const relativa = path
    .relative(path.dirname(archivo), path.resolve('src/config/esquema-firestore.mjs'))
    .replaceAll('\\', '/');
  return relativa.startsWith('.') ? relativa : `./${relativa}`;
};

const agregarImportacion = (contenido, archivo) => {
  if (/import\s*{[^}]*\bCOLECCIONES\b[^}]*}\s*from\s*["'][^"']*esquema-firestore\.mjs["']/.test(contenido)) {
    return contenido;
  }

  const importacion = `import { COLECCIONES } from '${rutaImportacion(archivo)}';\n\n`;
  const directiva = contenido.match(/^(?:#![^\n]*\n)?(?:['"]use (?:client|server)['"];\s*\n)/);
  if (directiva) {
    return `${contenido.slice(0, directiva[0].length)}\n${importacion}${contenido.slice(directiva[0].length)}`;
  }
  if (contenido.startsWith('#!')) {
    const fin = contenido.indexOf('\n') + 1;
    return `${contenido.slice(0, fin)}\n${importacion}${contenido.slice(fin)}`;
  }
  return importacion + contenido;
};

const archivos = [];
const recorrer = (directorio) => {
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) recorrer(ruta);
    else if (extensiones.has(path.extname(entrada.name)) && !excluir.has(ruta)) archivos.push(ruta);
  }
};
recorrer(raiz);

let archivosModificados = 0;
let referenciasModificadas = 0;

for (const archivo of archivos) {
  const original = fs.readFileSync(archivo, 'utf8');
  let contenido = original;
  let cambiosArchivo = 0;

  if (path.extname(archivo) === '.mjs') {
    const corregido = contenido.replaceAll(
      "from 'src/config/esquema-firestore.mjs'",
      `from '${rutaImportacion(archivo)}'`
    );
    if (corregido !== contenido) {
      contenido = corregido;
      cambiosArchivo += 1;
    }
  }

  for (const patron of patrones) {
    contenido = contenido.replace(patron, (...argumentosReemplazo) => {
      const grupos = argumentosReemplazo.at(-1);
      const propiedad = propiedadPorNombre.get(grupos.nombre);
      cambiosArchivo += 1;
      return `${argumentosReemplazo[1]}COLECCIONES.${propiedad}`;
    });
  }

  if (!cambiosArchivo) continue;
  contenido = agregarImportacion(contenido, archivo);
  archivosModificados += 1;
  referenciasModificadas += cambiosArchivo;
  console.log(`${path.relative(process.cwd(), archivo)}: ${cambiosArchivo}`);
  if (aplicar) fs.writeFileSync(archivo, contenido, 'utf8');
}

console.log(
  `${aplicar ? 'Centralizadas' : 'Detectadas'} ${referenciasModificadas} referencias en ` +
    `${archivosModificados} archivos.`
);
if (!aplicar) console.log('No se modifico ningun archivo. Usa --aplicar para ejecutar.');

