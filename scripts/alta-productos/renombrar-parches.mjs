// ----------------------------------------------------------------------
// "PARCHE" DELANTE DEL NOMBRE DE LOS ARTICULOS DE ADIESTRAMIENTO (ERRD-068 a 077).
//
// Solo cambia el nombre que se ve —`nombre` y `descripcionCorta`—. El
// identificador del documento NO se toca aunque lleve el nombre viejo dentro:
// renombrarlo romperia los enlaces que ya se hayan compartido.
//
//   node renombrar-parches.mjs           -> simulacion
//   node renombrar-parches.mjs --aplicar -> escribe
// ----------------------------------------------------------------------
import fs from 'node:fs';
import process from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore, FieldValue } from 'firebase-admin/firestore';

const APLICAR = process.argv.includes('--aplicar');
const env = Object.fromEntries(
  fs.readFileSync('../../.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();

const snap = await db.collection('productos').get();
const lote = snap.docs.filter((d) => {
  const n = Number((String(d.data().codigo).match(/ERRD-(\d+)/) || [])[1]);
  return n >= 68 && n <= 77;
});

console.log(APLICAR ? 'ESCRIBIENDO\n' : 'SIMULACION (usa --aplicar)\n');
let cambiados = 0;

for (const d of lote.sort((a, b) => a.data().codigo.localeCompare(b.data().codigo))) {
  const p = d.data();
  // Idempotente: correrlo dos veces no deja "Parche Parche ...".
  if (/^parche\s/i.test(p.nombre)) { console.log(`  ${p.codigo} ya lo tenia: ${p.nombre}`); continue; }
  const nuevo = `Parche ${p.nombre}`;
  console.log(`  ${p.codigo}  ${p.nombre}  ->  ${nuevo}`);
  if (!APLICAR) continue;

  await d.ref.update({ nombre: nuevo, descripcionCorta: nuevo, fechaActualizacion: Timestamp.now() });
  const ref = db.collection('auditoria_sistema').doc();
  await ref.set({
    idAuditoria: ref.id, modulo: 'tienda', accion: 'producto_actualizado',
    descripcion: `${p.nombre} (${p.codigo}) pasa a llamarse ${nuevo}.`,
    resultado: 'exitoso', severidad: 'informativa',
    entidad: { tipo: 'producto', id: d.id, nombre: nuevo, ruta: `/dashboard/product/${d.id}` },
    antes: { nombre: p.nombre }, despues: { nombre: nuevo },
    realizadoPor: { nombre: 'Correccion de catalogo', origen: 'script' }, origen: 'script',
    metadatos: { ambito: 'tienda', lote: 'parche-articulos-adiestramiento' },
    fecha: new Date().toISOString(), fechaServidor: FieldValue.serverTimestamp(),
  });
  cambiados += 1;
}
console.log(`\nEncontrados: ${lote.length}  Cambiados: ${cambiados}`);
