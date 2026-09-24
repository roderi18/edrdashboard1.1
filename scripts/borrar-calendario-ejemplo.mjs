// ----------------------------------------------------------------------
// BORRA DEL CALENDARIO LAS 11 ACTIVIDADES DE EJEMPLO QUE SE SEMBRARON DESDE EL
// CÓDIGO ("Campamento de prueba...", "Reunión de líderes", "Fogata de
// integración"...). Todas son de mayo de 2026 y no tienen autor (`creadoPor`).
//
// La siembra (`ACTIVIDADES_INICIALES_CALENDARIO` y `POST { sembrar: true }` en
// `/api/calendar`) ya se quitó del código: esto limpia lo que quedó en Firestore.
//
// Solo toca esos 11 ids, y aun así se salta cualquiera que tenga autor: una
// actividad creada por una persona nunca se borra desde aquí.
//
// Uso:
//   node scripts/borrar-calendario-ejemplo.mjs            → solo muestra qué borraría
//   node scripts/borrar-calendario-ejemplo.mjs --aplicar  → guarda copia y borra
//
// La copia queda en `scripts/respaldo-calendario-ejemplo.json`.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APLICAR = process.argv.includes('--aplicar');
const COLECCION = 'actividades_calendario';
const RESPALDO = 'scripts/respaldo-calendario-ejemplo.json';

const IDS_DE_EJEMPLO = [
  'campamento-mayo-2026',
  'reunion-lideres-mayo-2026',
  'primeros-auxilios-mayo-2026',
  'servicio-comunitario-mayo-2026',
  'fogata-mayo-2026',
  'recaudacion-mayo-2026',
  'capacitacion-region-central-mayo-2026',
  'reunion-region-este-mayo-2026',
  'encuentro-este-oriental-ii-mayo-2026',
  'visita-san-pedro-norte-mayo-2026',
  'reunion-santiago-dest-454-mayo-2026',
];

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
initializeApp({ credential: cert(cuenta), projectId: cuenta.project_id });
const db = getFirestore();

const aBorrar = {};

for (const id of IDS_DE_EJEMPLO) {
  // eslint-disable-next-line no-await-in-loop
  const documento = await db.collection(COLECCION).doc(id).get();

  if (!documento.exists) continue;

  const datos = documento.data();

  if (datos.creadoPor) {
    console.log(`SE QUEDA (tiene autor): ${id}`);
    continue;
  }

  aBorrar[id] = datos;
  console.log(`${APLICAR ? 'Borrando' : 'Borraría'}: ${id} · ${datos.titulo || datos.title || ''}`);
}

if (!APLICAR) {
  console.log(`\n${Object.keys(aBorrar).length} actividades. Nada borrado: añade --aplicar.`);
  process.exit(0);
}

fs.writeFileSync(RESPALDO, JSON.stringify(aBorrar, null, 2));

const lote = db.batch();
Object.keys(aBorrar).forEach((id) => lote.delete(db.collection(COLECCION).doc(id)));
await lote.commit();

console.log(`\nBorradas ${Object.keys(aBorrar).length}. Copia en ${RESPALDO}.`);
