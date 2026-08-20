// Da de baja (activo=false) TODAS las asignaciones activas de los miembros que se
// le indiquen. Se usa para limpiar cargos heredados que incumplen las reglas de
// ocupacion: una casilla con dos ocupantes, o una persona repetida en el mismo
// nivel.
//
//   Reporte:  node scripts/directivas/dar-de-baja-asignaciones-miembro.mjs 295 286
//   Aplicar:  node scripts/directivas/dar-de-baja-asignaciones-miembro.mjs 295 286 --apply
//
// No borra documentos: los deja inactivos, asi que la operacion es reversible y
// el historico se conserva.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import { DIRECTIVA_POSITIONS } from '../../src/catalogs/directiva-positions.js';

const APPLY = process.argv.includes('--apply');
const IDS = process.argv.slice(2).filter((arg) => /^\d+$/.test(arg));
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API = 'https://systexploradores.somee.com/api';

for (const archivo of ['.env.local', '.env']) {
  const ruta = path.join(rootDir, archivo);
  if (!fs.existsSync(ruta)) continue;
  fs.readFileSync(ruta, 'utf8').split(/\r?\n/).forEach((linea) => {
    const t = linea.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i === -1) return;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    const q = (v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'));
    if (q) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  });
}

const pedir = async (ruta) => {
  const res = await fetch(`${API}/${ruta}`, { headers: { Accept: 'application/json' } });
  const texto = await res.text();

  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
};

const filas = (p) => (Array.isArray(p) ? p : p?.data || p?.Data || []);

const main = async () => {
  if (!IDS.length) {
    console.error('Indica al menos un idMiembro. Ej: node ... 295 286');
    process.exit(1);
  }

  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (typeof sa.private_key === 'string') sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const db = getFirestore(app);

  const [miembros, secciones, regiones, dests] = await Promise.all([
    pedir('Miembros/GetAllMiembros').then(filas),
    pedir('Secciones/GetAllSecciones').then(filas),
    pedir('Regiones/GetAllRegiones').then(filas),
    pedir('Destacamentos/GetAllDestacamentos').then(filas),
  ]);

  const nombreMiembro = (id) => {
    const m = miembros.find((x) => String(x.idMiembros ?? x.id) === String(id));
    return m ? [m.nombres, m.apellidos].filter(Boolean).join(' ') : `Miembro ${id}`;
  };

  const nombreEntidad = (nivel, id) => {
    if (nivel === 'nacional') return 'Consejo Nacional';
    if (nivel === 'seccional')
      return secciones.find((s) => String(s.idSeccion) === String(id))?.nombre || `entidad ${id}`;
    if (nivel === 'regional')
      return regiones.find((r) => String(r.idRegion) === String(id))?.nombre || `entidad ${id}`;
    return dests.find((d) => String(d.idDestacamento) === String(id))?.nombre || `dest ${id}`;
  };

  const nombreCargo = (idPosicion) => {
    const p = DIRECTIVA_POSITIONS.find((i) => i.idCargo === idPosicion);
    if (!p) return idPosicion;
    return p.nombreCargo + (p.nombreDivision ? ` (${p.nombreDivision})` : '');
  };

  const snapshot = await db.collection('asignacionesDirectiva').get();
  const objetivo = snapshot.docs
    .map((d) => ({ docId: d.id, ...d.data() }))
    .filter((a) => a.activo && IDS.includes(String(a.idMiembro)));

  console.log(`Modo: ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN (solo reporta)'}`);
  console.log(`Miembros: ${IDS.join(', ')}`);
  console.log(`Asignaciones activas a dar de baja: ${objetivo.length}`);
  console.log('');

  for (const asignacion of objetivo) {
    console.log(
      `  ${nombreMiembro(asignacion.idMiembro)} [${asignacion.idMiembro}] — ${nombreCargo(asignacion.idPosicionDirectiva)} — ${nombreEntidad(asignacion.nivel, asignacion.idEntidad)} (${asignacion.nivel})`
    );
    console.log(`     doc: ${asignacion.docId}`);

    if (!APPLY) continue;

    // eslint-disable-next-line no-await-in-loop
    await db.collection('asignacionesDirectiva').doc(asignacion.docId).set(
      {
        activo: false,
        fechaFin: new Date().toISOString().slice(0, 10),
        fechaActualizacion: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  console.log('');
  console.log(APPLY ? 'Bajas aplicadas.' : 'Nada escrito (dry-run).');
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
