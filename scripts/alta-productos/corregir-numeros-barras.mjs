// Revisa y ordena los numeros de metal para cintas.
// Simulacion: node scripts/alta-productos/corregir-numeros-barras.mjs
// Aplicar:    node scripts/alta-productos/corregir-numeros-barras.mjs --aplicar

import fs from 'node:fs';
import process from 'node:process';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APLICAR = process.argv.includes('--aplicar');
const PREFIJO = 'BAR-NUM';

const leerEnv = () => {
  const env = {};
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .forEach((linea) => {
      const limpia = linea.trim();
      const corte = limpia.indexOf('=');
      if (!limpia || limpia.startsWith('#') || corte === -1) return;
      env[limpia.slice(0, corte).trim()] = limpia
        .slice(corte + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
    });
  return env;
};

const env = leerEnv();
const credencial = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
if (!getApps().length) initializeApp({ credential: cert(credencial) });
const db = getFirestore();

const extraerNumero = (nombre) => {
  const coincidencia = String(nombre || '').match(/\((\d)\)/);
  return coincidencia ? Number(coincidencia[1]) : null;
};

const codigoNumero = (codigo) => {
  const coincidencia = String(codigo || '').match(/^BAR-NUM-(\d+)$/i);
  return coincidencia ? Number(coincidencia[1]) : null;
};

const formatearCodigo = (numero) => `${PREFIJO}-${String(numero).padStart(3, '0')}`;

const main = async () => {
  const snapshot = await db.collection('productos').get();
  const todosLosCodigos = new Set(
    snapshot.docs.map((documento) => String(documento.data()?.codigo || '').trim().toUpperCase())
  );
  const productos = snapshot.docs
    .map((documento) => ({ ref: documento.ref, id: documento.id, ...documento.data() }))
    .filter(
      (producto) =>
        producto.categoria === 'barras-numeros' &&
        extraerNumero(producto.nombre) !== null
    )
    .sort((a, b) => extraerNumero(a.nombre) - extraerNumero(b.nombre));

  if (productos.length !== 10) {
    throw new Error(`Se esperaban 10 numeros de barras-numeros y se encontraron ${productos.length}.`);
  }

  const repetidos = new Map();
  productos.forEach((producto) => {
    const codigo = String(producto.codigo || '').trim().toUpperCase();
    const lista = repetidos.get(codigo) || [];
    lista.push(producto);
    repetidos.set(codigo, lista);
  });

  const usadosPorLosNumeros = new Set(
    productos.map((producto) => String(producto.codigo || '').trim().toUpperCase()).filter(Boolean)
  );
  let siguienteDisponible = 1;
  const cambios = [];

  productos.forEach((producto, indice) => {
    const codigoActual = String(producto.codigo || '').trim().toUpperCase();
    const esRepetido = codigoActual && repetidos.get(codigoActual)?.length > 1;
    let codigoNuevo = codigoActual;

    if (esRepetido) {
      while (todosLosCodigos.has(formatearCodigo(siguienteDisponible))) siguienteDisponible += 1;
      codigoNuevo = formatearCodigo(siguienteDisponible);
      todosLosCodigos.add(codigoNuevo);
      siguienteDisponible += 1;
    }

    const ordenNuevo = indice;
    if (codigoNuevo !== codigoActual || Number(producto.orden) !== ordenNuevo) {
      cambios.push({ producto, codigoActual, codigoNuevo, ordenNuevo });
    }
  });

  console.log(APLICAR ? 'MODO ESCRITURA' : 'SIMULACION');
  console.log(`Numeros revisados: ${productos.length}`);
  console.log(`Cambios: ${cambios.length}`);
  cambios.forEach(({ producto, codigoActual, codigoNuevo, ordenNuevo }) => {
    console.log(`  ${producto.nombre}: ${codigoActual || '(vacio)'} -> ${codigoNuevo || '(sin cambio)'}, orden ${ordenNuevo}`);
  });

  if (!APLICAR || !cambios.length) return;

  const lote = db.batch();
  cambios.forEach(({ producto, codigoNuevo, ordenNuevo }) => {
    lote.update(producto.ref, { codigo: codigoNuevo, orden: ordenNuevo });
  });
  await lote.commit();
  console.log('Listo.');
};

main().catch((error) => {
  console.error('FALLO:', error.message);
  process.exit(1);
});
