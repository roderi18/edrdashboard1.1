// ----------------------------------------------------------------------
// ALTA MASIVA DE PRODUCTOS DE LA TIENDA.
//
// Script de UNA VEZ, fuera del repositorio. Escribe con el Admin SDK porque son
// 24 altas con subida de imagen: hacerlo por el formulario, uno a uno, es lento y
// se rompe a la mitad.
//
// Replica la forma del documento de `src/models/product-model.js` y deja una
// entrada en `auditoria_sistema` por cada alta, que es lo que haria
// `proponerCambio` con el ambito `tienda` —ese ambito se aplica directo, sin
// aprobacion, pero queda registrado—. Si el modelo cambia, este script queda
// desfasado: por eso no vive en el repositorio.
//
//   node crear-articulos-adiestramiento.mjs           -> simulacion
//   node crear-articulos-adiestramiento.mjs --aplicar -> escribe de verdad
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const RAIZ = 'C:/Users/rdpr1/OneDrive/Escritorio/next-js';
const APLICAR = process.argv.includes('--aplicar');

// --- Credenciales, de .env.local -------------------------------------------
const leerEnv = () => {
  const texto = fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
  const env = {};

  texto.split(/\r?\n/).forEach((linea) => {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) return;
    const corte = limpia.indexOf('=');
    if (corte === -1) return;
    env[limpia.slice(0, corte).trim()] = limpia
      .slice(corte + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  });

  return env;
};

const env = leerEnv();
const credencial = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
const bucket = env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!getApps().length) {
  initializeApp({ credential: cert(credencial), storageBucket: bucket });
}

const db = getFirestore();
const almacen = getStorage().bucket();

// --- Lo que se crea ---------------------------------------------------------
// Articulos de adiestramiento: los parches de cada curso y la corbata bolo del
// CNM. Todos restringidos —se ganan cursando, no se compran sueltos— y todos a
// RD$300 registrado / RD$350 no registrado.
//
// Cantidad: 10 de cada uno, la misma del lote anterior de pines. No se pidio una
// cifra; se corrige desde la ficha si hace falta.
const CARPETA = path.join(RAIZ, 'public/parches/Articulos de adiestramiento');

const ARTICULOS = [
  ['Adiestramiento Consejo Destacamento (ACD)', 'acd.webp', 'parches'],
  ['Corbata Bolo CNM', 'bolo-CNM.webp', 'accesorios'],
  ['Campamento de Barras Doradas (CBD)', 'cbd.webp', 'parches'],
  ['Campamento Nacional Ministerial (CNM)', 'cnm.webp', 'parches'],
  ['Destacamento de Clase Mundial (DCM)', 'dcm.webp', 'parches'],
  ['Fundamentos', 'fundamentos.webp', 'parches'],
  ['Introducción al Liderazgo Juvenil (ILJ)', 'ilj.webp', 'parches'],
  ['Mentores', 'mentores.webp', 'parches'],
  ['Orientación para el Líder de la Iglesia (OLI)', 'oli.webp', 'parches'],
  ['Seguridad y Primeros Auxilios', 'seguridad-curso.webp', 'parches'],
];

const TODOS = ARTICULOS.map(([nombre, archivo, categoria]) => {
  const imagen = path.join(CARPETA, archivo);

  if (!fs.existsSync(imagen)) throw new Error(`No existe la imagen ${imagen}`);

  return { nombre, imagen, categoria, registrado: 300, noRegistrado: 350, cantidad: 10 };
});

// --- Identificadores --------------------------------------------------------
// El siguiente codigo libre. NO se reutiliza ninguno ya emitido: se lee el
// maximo que hay en la tienda y se sigue desde ahi.
const siguienteCodigo = async () => {
  const snapshot = await db.collection('productos').get();
  let maximo = 0;

  snapshot.docs.forEach((documento) => {
    const codigo = String(documento.data()?.codigo || '');
    const numero = Number((codigo.match(/ERRD-(\d+)/i) || [])[1]);
    if (Number.isFinite(numero) && numero > maximo) maximo = numero;
  });

  return maximo + 1;
};

const comoRuta = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// --- Documento --------------------------------------------------------------
const construirProducto = ({ productoId, codigo, p, imagenes }) => {
  const ahora = Timestamp.now();

  return {
    productoId,
    nombre: p.nombre,
    descripcion: '',
    descripcionCorta: p.nombre,
    codigo,
    sku: codigo,
    precio: 0,
    precioOferta: 0,
    precioRegistrado: p.registrado,
    precioNoRegistrado: p.noRegistrado,
    precioPendiente: false,
    cantidad: p.cantidad,
    disponibles: p.cantidad,
    // Misma regla que `mapInventoryType` del modelo.
    tipoInventario:
      p.cantidad <= 0 ? 'sin existencias' : p.cantidad <= 10 ? 'pocas existencias' : 'en existencia',
    renglon: 'restringido',
    requiereAprobacion: true,
    tipoProducto: 'simple',
    variantes: [],
    notasAdministrativas: '',
    orden: 0,
    publicacion: 'publicado',
    imagenes,
    imagenPortada: imagenes[0] || '',
    categoria: p.categoria,
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

const subirImagen = async (rutaLocal, productoId) => {
  const destino = `productos/${productoId}/imagen-${Date.now()}-0.webp`;
  // EL MISMO TIPO DE URL QUE EL RESTO DE LA APLICACION.
  //
  // El SDK de cliente sirve las imagenes por `firebasestorage.googleapis.com`
  // con un token de descarga en los metadatos. Aqui se genera ese token a mano
  // para que la URL salga igual.
  //
  // La alternativa —`makePublic()` y una URL de `storage.googleapis.com`— no
  // sirve: falla en los buckets con acceso uniforme, y ademas dejaria estas
  // imagenes abiertas a internet mientras las demas van con token.
  const token = crypto.randomUUID();

  await almacen.upload(rutaLocal, {
    destination: destino,
    metadata: {
      contentType: 'image/webp',
      metadata: {
        tipoEntidad: 'producto',
        productoId: String(productoId),
        indice: '0',
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return (
    `https://firebasestorage.googleapis.com/v0/b/${almacen.name}/o/` +
    `${encodeURIComponent(destino)}?alt=media&token=${token}`
  );
};

// --- Adelante ---------------------------------------------------------------
const main = async () => {
  let numero = await siguienteCodigo();

  console.log(`Productos a crear: ${TODOS.length}`);
  console.log(`Primer codigo libre: ERRD-${String(numero).padStart(3, '0')}`);
  console.log(APLICAR ? '\nESCRIBIENDO\n' : '\nSIMULACION (usa --aplicar para escribir)\n');

  const creados = [];

  for (const p of TODOS) {
    const codigo = `ERRD-${String(numero).padStart(3, '0')}`;
    const productoId = `${comoRuta(codigo)}-${comoRuta(p.nombre)}`;

    let imagenes = [];

    if (APLICAR) {
      const yaExiste = await db.collection('productos').doc(productoId).get();

      if (yaExiste.exists) {
        console.log(`  · ya existe, se salta: ${productoId}`);
        numero += 1;
        continue;
      }

      if (p.imagen) imagenes = [await subirImagen(p.imagen, productoId)];

      const documento = construirProducto({ productoId, codigo, p, imagenes });

      await db.collection('productos').doc(productoId).set(documento);

      // El rastro en Historial, igual que lo dejaria la puerta de cambios.
      const auditRef = db.collection('auditoria_sistema').doc();

      await auditRef.set({
        idAuditoria: auditRef.id,
        modulo: 'tienda',
        accion: 'producto_creado',
        descripcion: `Se creo el producto ${p.nombre} (${codigo}).`,
        resultado: 'exitoso',
        severidad: 'informativa',
        entidad: {
          tipo: 'producto',
          id: productoId,
          nombre: p.nombre,
          ruta: `/dashboard/product/${productoId}`,
        },
        antes: null,
        despues: { nombre: p.nombre, codigo, publicacion: 'publicado' },
        realizadoPor: { nombre: 'Carga inicial del catalogo', origen: 'script' },
        origen: 'script',
        metadatos: { ambito: 'tienda', lote: 'alta-articulos-adiestramiento' },
        fecha: new Date().toISOString(),
        fechaServidor: FieldValue.serverTimestamp(),
      });
    }

    creados.push({ codigo, productoId, nombre: p.nombre, imagen: Boolean(p.imagen) });
    console.log(
      `  ${codigo}  ${p.nombre}${p.imagen ? '  [con imagen]' : ''}  RD$${p.registrado}/${p.noRegistrado}  x${p.cantidad}`
    );

    numero += 1;
  }

  console.log(`\nTotal: ${creados.length}`);
};

main().catch((error) => {
  console.error('FALLO:', error.message);
  process.exit(1);
});
