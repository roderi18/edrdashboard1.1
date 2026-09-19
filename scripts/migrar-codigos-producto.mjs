// ----------------------------------------------------------------------
// CODIGOS DE PRODUCTO, EN SECUENCIA POR CATEGORIA.
//
// El codigo de producto se armaba a mano en /product/new; ahora sale solo de
// la categoria (`src/utils/producto-codigo.mjs`: Insignias y emblemas ->
// INS-EMB-001, Cintas -> CIN-001...). Este script reescribe el codigo de TODOS
// los productos que ya existen para que seaN esa misma numeracion, en el orden
// en que se crearon (el mas viejo primero, dentro de su categoria).
//
// Uso:
//   node scripts/migrar-codigos-producto.mjs             simulacion, no escribe nada
//   node scripts/migrar-codigos-producto.mjs --aplicar   escribe
// ----------------------------------------------------------------------

import fs from 'node:fs';
import process from 'node:process';

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import {
  prefijoDeCategoriaProducto,
  formatearCodigoProducto,
} from '../src/utils/producto-codigo.mjs';

const APLICAR = process.argv.includes('--aplicar');

const leerServiceAccount = () => {
  const texto = fs.readFileSync('.env.local', 'utf8');
  const linea = texto.match(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m);

  if (!linea) throw new Error('FIREBASE_SERVICE_ACCOUNT no esta en .env.local');

  const cuenta = JSON.parse(linea[1].replace(/^["']|["']$/g, ''));

  if (typeof cuenta.private_key === 'string') {
    cuenta.private_key = cuenta.private_key.replace(/\\n/g, '\n');
  }

  return cuenta;
};

const cuenta = leerServiceAccount();
const app = initializeApp({ credential: cert(cuenta), projectId: cuenta.project_id });
const db = getFirestore(app);

const fechaDeCreacion = (documento) => {
  const valor = documento?.fechaCreacion;

  if (valor?.toMillis) return valor.toMillis();
  if (valor) return new Date(valor).getTime() || 0;

  return 0;
};

const main = async () => {
  const [instantaneaProductos, instantaneaCategorias] = await Promise.all([
    db.collection('productos').get(),
    db.collection('categorias_producto_personalizadas').get(),
  ]);

  const etiquetasPersonalizadas = new Map(
    instantaneaCategorias.docs.map((fila) => [fila.id, fila.data()?.nombre || ''])
  );

  const productos = instantaneaProductos.docs.map((fila) => ({
    id: fila.id,
    ref: fila.ref,
    categoria: String(fila.data()?.categoria || '').trim(),
    codigoViejo: fila.data()?.codigo || '',
    nombre: fila.data()?.nombre || fila.id,
    fechaCreacion: fechaDeCreacion(fila.data()),
  }));

  console.log(`Productos en Firestore: ${productos.length}`);
  console.log(APLICAR ? '>>> MODO ESCRITURA <<<' : '>>> simulacion (no escribe nada) <<<');

  const porCategoria = new Map();

  productos.forEach((producto) => {
    const lista = porCategoria.get(producto.categoria) || [];
    lista.push(producto);
    porCategoria.set(producto.categoria, lista);
  });

  const cambios = [];

  for (const [categoria, lista] of porCategoria) {
    // El mas viejo primero: el orden en que se crearon es el que se conserva.
    lista.sort((a, b) => a.fechaCreacion - b.fechaCreacion);

    const etiqueta = etiquetasPersonalizadas.get(categoria);
    const prefijo = prefijoDeCategoriaProducto(categoria, etiqueta);

    lista.forEach((producto, indice) => {
      const codigoNuevo = formatearCodigoProducto(prefijo, indice + 1);

      if (codigoNuevo !== producto.codigoViejo) {
        cambios.push({ ...producto, codigoNuevo });
      }
    });
  }

  cambios.forEach((cambio) => {
    console.log(
      `${cambio.categoria || '(sin categoria)'}: ${cambio.nombre} — ${cambio.codigoViejo || '(vacio)'} -> ${cambio.codigoNuevo}`
    );
  });

  console.log(`Total a cambiar: ${cambios.length} de ${productos.length}`);

  if (!APLICAR || !cambios.length) return;

  // En lotes de 400: el limite de Firestore es 500 escrituras por lote.
  for (let inicio = 0; inicio < cambios.length; inicio += 400) {
    const lote = db.batch();

    cambios.slice(inicio, inicio + 400).forEach((cambio) => {
      lote.update(cambio.ref, { codigo: cambio.codigoNuevo });
    });

    await lote.commit();
  }

  console.log('Listo.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
