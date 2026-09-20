import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import {
  formatearCodigoProducto,
  prefijoDeCategoriaProducto,
} from '../../src/utils/producto-codigo.mjs';

const RAIZ = 'C:/Users/rdpr1/OneDrive/Escritorio/next-js';
const CARPETA = path.join(RAIZ, 'public/parches/Cintas y medallas/numerosTela');
const APLICAR = process.argv.includes('--aplicar');
const CATEGORIA = 'barras-numeros';
const PREFIJO = prefijoDeCategoriaProducto(CATEGORIA, 'Barras y Numeros');

const leerEnv = () => {
  const texto = fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
  const env = {};

  texto.split(/\r?\n/).forEach((linea) => {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) return;
    const corte = limpia.indexOf('=');
    if (corte === -1) return;
    env[limpia.slice(0, corte).trim()] = limpia.slice(corte + 1).trim().replace(/^['"]|['"]$/g, '');
  });

  return env;
};

const env = leerEnv();
const credencial = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

if (!getApps().length) {
  initializeApp({ credential: cert(credencial), storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
}

const db = getFirestore();
const almacen = getStorage().bucket();

const comoRuta = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const leerNumeros = () =>
  Array.from({ length: 10 }, (_, numero) => {
    const archivo = `${numero}.webp`;
    const ruta = path.join(CARPETA, archivo);
    if (!fs.existsSync(ruta)) throw new Error(`No existe la imagen ${ruta}`);
    return { numero, archivo, ruta, nombre: `Numero bordado (${numero})` };
  });

const siguienteNumero = async () => {
  const snapshot = await db.collection('productos').get();
  const usados = snapshot.docs.map((doc) => Number((String(doc.data()?.codigo || '').match(/^BAR-NUM-(\d+)$/i) || [])[1] || 0));
  return Math.max(0, ...usados) + 1;
};

const subirImagen = async (rutaLocal, productoId) => {
  const destino = `productos/${productoId}/imagen-0.webp`;
  const token = crypto.randomUUID();
  await almacen.upload(rutaLocal, {
    destination: destino,
    metadata: {
      contentType: 'image/webp',
      metadata: { tipoEntidad: 'producto', productoId, indice: '0', firebaseStorageDownloadTokens: token },
    },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${almacen.name}/o/${encodeURIComponent(destino)}?alt=media&token=${token}`;
};

const construirProducto = ({ productoId, codigo, numero, imagen }) => {
  const ahora = Timestamp.now();
  const nombre = `Numero bordado (${numero})`;
  return {
    productoId,
    nombre,
    descripcion: nombre,
    descripcionCorta: nombre,
    codigo,
    sku: codigo,
    precio: 70,
    precioOferta: 0,
    precioRegistrado: 70,
    precioNoRegistrado: 80,
    precioPendiente: false,
    cantidad: 10,
    disponibles: 10,
    tipoInventario: 'pocas existencias',
    renglon: 'general',
    requiereAprobacion: false,
    tipoProducto: 'simple',
    variantes: [],
    notasAdministrativas: '',
    orden: numero,
    publicacion: 'publicado',
    imagenes: [imagen],
    imagenPortada: imagen,
    categoria: CATEGORIA,
    colores: [],
    tallas: [],
    etiquetas: [],
    genero: [],
    etiquetaNuevo: { habilitada: false, contenido: '' },
    etiquetaOferta: { habilitada: false, contenido: '' },
    totalCalificaciones: 0,
    totalResenas: 0,
    totalVendidos: 0,
    fechaCreacion: ahora,
    fechaActualizacion: ahora,
  };
};

const main = async () => {
  const numeros = leerNumeros();
  let codigoNumero = await siguienteNumero();
  const existentes = await db.collection('productos').where('categoria', '==', CATEGORIA).get();
  const nombresExistentes = new Set(
    existentes.docs.map((doc) => String(doc.data()?.nombre || '').trim().toLowerCase())
  );
  console.log(APLICAR ? 'ESCRIBIENDO' : 'SIMULACION (usa --aplicar para escribir)');

  for (const producto of numeros) {
    const codigo = formatearCodigoProducto(PREFIJO, codigoNumero);
    const productoId = `${comoRuta(codigo)}-numero-bordado-${producto.numero}`;
    const referencia = db.collection('productos').doc(productoId);
    const existente = await referencia.get();

    if (existente.exists || nombresExistentes.has(producto.nombre.toLowerCase())) {
      console.log(`  ya existe: ${producto.nombre} (${productoId})`);
      codigoNumero += 1;
      continue;
    }

    if (APLICAR) {
      const imagen = await subirImagen(producto.ruta, productoId);
      await referencia.set(construirProducto({ productoId, codigo, numero: producto.numero, imagen }));
      const auditoria = db.collection('auditoria_sistema').doc();
      await auditoria.set({
        idAuditoria: auditoria.id,
        modulo: 'tienda',
        accion: 'producto_creado',
        descripcion: `Se creo el producto ${producto.nombre} (${codigo}).`,
        resultado: 'exitoso',
        severidad: 'informativa',
        entidad: { tipo: 'producto', id: productoId, nombre: producto.nombre, ruta: `/dashboard/product/${productoId}` },
        antes: null,
        despues: { nombre: producto.nombre, codigo, categoria: CATEGORIA },
        realizadoPor: { nombre: 'Carga de numeros bordados', origen: 'script' },
        origen: 'script',
        metadatos: { ambito: 'tienda', lote: 'alta-numeros-tela' },
        fecha: new Date().toISOString(),
        fechaServidor: FieldValue.serverTimestamp(),
      });
    }

    console.log(`  ${codigo}  ${producto.nombre}  RD$70/RD$80  orden ${producto.numero}`);
    codigoNumero += 1;
  }
};

main().catch((error) => {
  console.error('FALLO:', error.message);
  process.exit(1);
});
