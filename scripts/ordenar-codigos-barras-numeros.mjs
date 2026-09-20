// ----------------------------------------------------------------------
// LOS "NUMERO DE METAL PARA CINTAS" EN SECUENCIA VISUAL, NO POR FECHA.
//
// migrar-codigos-producto.mjs numera por fecha de creacion, pero estos diez
// productos ("Numero de metal para cintas (0)".."(9)") se crearon en un orden
// distinto al que se ven en la tienda (0,1,2,3,4,6,8,7,5,9). Este script saca
// el numero del nombre y reescribe BAR-NUM-001..010 en ese orden (0 primero,
// 9 al final), dejando el resto del catalogo de "Barras y numeros" intacto:
// los productos sin un "(N)" en el nombre conservan su codigo y ceden el
// hueco al final de la secuencia.
//
// Uso:
//   node scripts/ordenar-codigos-barras-numeros.mjs             simulacion
//   node scripts/ordenar-codigos-barras-numeros.mjs --aplicar   escribe
// ----------------------------------------------------------------------

import fs from 'node:fs';
import process from 'node:process';

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { formatearCodigoProducto } from '../src/utils/producto-codigo.mjs';

const APLICAR = process.argv.includes('--aplicar');
const CATEGORIA = 'barras-numeros';
const PREFIJO = 'BAR-NUM';

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

const numeroDelNombre = (nombre) => {
  const coincide = /\((\d+)\)/.exec(String(nombre ?? ''));
  return coincide ? Number(coincide[1]) : null;
};

const main = async () => {
  const instantanea = await db
    .collection('productos')
    .where('categoria', '==', CATEGORIA)
    .get();

  const productos = instantanea.docs.map((fila) => ({
    ref: fila.ref,
    codigoViejo: fila.data()?.codigo || '',
    nombre: fila.data()?.nombre || fila.id,
    numero: numeroDelNombre(fila.data()?.nombre),
  }));

  console.log(`Productos en "${CATEGORIA}": ${productos.length}`);
  console.log(APLICAR ? '>>> MODO ESCRITURA <<<' : '>>> simulacion (no escribe nada) <<<');

  const conNumero = productos
    .filter((p) => p.numero !== null)
    .sort((a, b) => a.numero - b.numero);

  const sinNumero = productos.filter((p) => p.numero === null);

  const ordenados = [...conNumero, ...sinNumero];

  const cambios = [];

  ordenados.forEach((producto, indice) => {
    const codigoNuevo = formatearCodigoProducto(PREFIJO, indice + 1);

    if (codigoNuevo !== producto.codigoViejo) {
      cambios.push({ ...producto, codigoNuevo });
    }
  });

  cambios.forEach((cambio) => {
    console.log(`${cambio.nombre} — ${cambio.codigoViejo || '(vacio)'} -> ${cambio.codigoNuevo}`);
  });

  console.log(`Total a cambiar: ${cambios.length} de ${productos.length}`);

  if (!APLICAR || !cambios.length) return;

  const lote = db.batch();
  cambios.forEach((cambio) => lote.update(cambio.ref, { codigo: cambio.codigoNuevo }));
  await lote.commit();

  console.log('Listo.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
