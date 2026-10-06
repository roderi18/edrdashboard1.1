#!/usr/bin/env node

import { cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { ALIAS_CAMPOS_FIRESTORE } from '../../src/config/campos-firestore.mjs';
import { DEFINICIONES_COLECCIONES } from '../../src/config/esquema-firestore.mjs';

const argumentos = new Map(
  process.argv.slice(2).map((argumento) => {
    const [clave, ...resto] = argumento.replace(/^--/, '').split('=');
    return [clave, resto.length ? resto.join('=') : true];
  })
);

const limite = Math.max(1, Number(argumentos.get('limite') || 250));
const filtro = new Set(
  String(argumentos.get('solo') || '')
    .split(',')
    .map((valor) => valor.trim())
    .filter(Boolean)
);

const contenido = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!contenido) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT.');
const cuenta = JSON.parse(contenido);
if (typeof cuenta.private_key === 'string') {
  cuenta.private_key = cuenta.private_key.replace(/\\n/g, '\n');
}

const app = initializeApp(
  { credential: cert(cuenta), projectId: cuenta.project_id },
  `auditoria-campos-${Date.now()}`
);
const db = getFirestore(app);

const camposPorColeccion = new Map();

const tipoDe = (valor) => {
  if (valor === null) return 'null';
  if (Array.isArray(valor)) return 'array';
  if (typeof valor?.toDate === 'function') return 'timestamp';
  if (typeof valor?.path === 'string' && valor?.firestore) return 'referencia';
  if (typeof valor?.toBase64 === 'function') return 'bytes';
  if (valor && typeof valor === 'object' && 'latitude' in valor && 'longitude' in valor) {
    return 'geopunto';
  }
  return typeof valor;
};

const registrarCampos = (coleccion, valor, prefijo = '') => {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return;
  if (typeof valor.toDate === 'function' || valor.constructor?.name !== 'Object') return;

  const mapa = camposPorColeccion.get(coleccion) || new Map();
  camposPorColeccion.set(coleccion, mapa);

  for (const [campo, contenidoCampo] of Object.entries(valor)) {
    const ruta = prefijo ? `${prefijo}.${campo}` : campo;
    const registro = mapa.get(ruta) || { apariciones: 0, tipos: new Set() };
    registro.apariciones += 1;
    registro.tipos.add(tipoDe(contenidoCampo));
    mapa.set(ruta, registro);
    registrarCampos(coleccion, contenidoCampo, ruta);
  }
};

const requiereRevision = (ruta) => {
  const campo = ruta.split('.').at(-1);
  return (
    campo.includes('_') ||
    campo === 'idMiembros' ||
    Object.hasOwn(ALIAS_CAMPOS_FIRESTORE, campo) ||
    /^(?:user|member|created|updated|deleted|start|end|status|name|title|description|active|enabled)/i.test(
      campo
    )
  );
};

try {
  const colecciones = (await db.listCollections())
    .filter((coleccion) => !filtro.size || filtro.has(coleccion.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const nombresRegistrados = new Set(
    Object.values(DEFINICIONES_COLECCIONES).flatMap((definicion) => [
      definicion.canonico,
      ...definicion.heredados,
    ])
  );
  const noRegistradas = colecciones
    .map((coleccion) => coleccion.id)
    .filter((nombre) => !nombresRegistrados.has(nombre));

  if (noRegistradas.length) {
    console.log(`Colecciones no registradas: ${noRegistradas.join(', ')}`);
  }

  for (const coleccion of colecciones) {
    const instantanea = await coleccion.limit(limite).get();
    for (const documento of instantanea.docs) registrarCampos(coleccion.id, documento.data());
  }

  let totalCampos = 0;
  let totalRevisiones = 0;
  for (const [coleccion, campos] of camposPorColeccion) {
    const revisiones = [...campos.entries()].filter(([ruta]) => requiereRevision(ruta));
    totalCampos += campos.size;
    totalRevisiones += revisiones.length;
    if (!revisiones.length) continue;

    console.log(`\n${coleccion} (${revisiones.length} campos por revisar)`);
    for (const [ruta, registro] of revisiones.sort(([a], [b]) => a.localeCompare(b))) {
      console.log(
        `  ${ruta}: ${[...registro.tipos].sort().join('|')} (${registro.apariciones} muestras)`
      );
    }
  }

  console.log(
    `\nResumen: ${colecciones.length} colecciones, ${totalCampos} rutas de campo, ` +
      `${totalRevisiones} candidatas a normalizacion, limite ${limite} documentos por coleccion.`
  );
  console.log(`Colecciones raiz no registradas: ${noRegistradas.length}.`);
} finally {
  await deleteApp(app);
}

