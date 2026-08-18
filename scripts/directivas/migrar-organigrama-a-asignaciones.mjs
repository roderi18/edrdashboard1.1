// Migra las casillas de `organigrama_directiva_destacamentos` a
// `asignacionesDirectiva`, que pasa a ser la unica fuente tambien para el
// organigrama del destacamento.
//
// Sin esta migracion, la gente que solo estaba en la coleccion vieja desaparece
// del cuadro en cuanto la pantalla deja de leerla.
//
//   Reporte:  node scripts/directivas/migrar-organigrama-a-asignaciones.mjs
//   Aplicar:  node scripts/directivas/migrar-organigrama-a-asignaciones.mjs --apply

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import { DIRECTIVA_POSITIONS, getOrganigramaDestSlot } from '../../src/catalogs/directiva-positions.js';

const APPLY = process.argv.includes('--apply');
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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

const normalizarId = (value = '') =>
  String(value || '').trim().toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');

const claveCasilla = (slot) =>
  [slot?.cargo || '', slot?.division || 'general', slot?.orden || 1].join('|');

const posicionPorCasilla = new Map(
  DIRECTIVA_POSITIONS.filter((p) => p.nivel === 'destacamento')
    .map((p) => [p, getOrganigramaDestSlot(p)])
    .filter(([, slot]) => slot)
    .map(([p, slot]) => [claveCasilla(slot), p])
);

const main = async () => {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (typeof sa.private_key === 'string') sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const db = getFirestore(app);

  const [organigrama, asignaciones] = await Promise.all([
    db.collection('organigrama_directiva_destacamentos').get(),
    db.collection('asignacionesDirectiva').get(),
  ]);

  const yaExiste = new Set(
    asignaciones.docs.map((d) => d.data()).filter((x) => x.activo)
      .map((x) => `${x.nivel}:${x.idEntidad}:${x.idPosicionDirectiva}`)
  );

  console.log(`Modo: ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN (solo reporta)'}`);
  console.log(`Casillas en el organigrama: ${organigrama.size}\n`);

  const pendientes = [];
  const sinPosicion = [];
  const yaCubiertas = [];

  organigrama.docs.map((d) => d.data()).filter((x) => x.activo !== false).forEach((casilla) => {
    const position = posicionPorCasilla.get(claveCasilla(casilla));

    if (!position) { sinPosicion.push(casilla); return; }

    const clave = `destacamento:${casilla.idDestacamento}:${position.idCargo}`;

    if (yaExiste.has(clave)) { yaCubiertas.push({ casilla, position }); return; }

    pendientes.push({ casilla, position });
  });

  for (const { casilla, position } of pendientes) {
    const idEntidad = String(casilla.idDestacamento || '');
    const idAsignacion = [
      normalizarId('destacamento'),
      normalizarId(idEntidad || 'general'),
      normalizarId(position.idCargo),
      normalizarId(position.division || 'general'),
      normalizarId(position.orden || 1),
    ].join('_');

    console.log(`  ${idAsignacion}`);
    console.log(`     miembro=${casilla.idMiembros} | ${position.nombreCargo}${position.nombreDivision ? ` (${position.nombreDivision})` : ''} | dest=${idEntidad}`);

    if (!APPLY) continue;

    // eslint-disable-next-line no-await-in-loop
    await db.collection('asignacionesDirectiva').doc(idAsignacion).set(
      {
        idAsignacion,
        idDirectiva: `destacamento_${normalizarId(idEntidad || 'general')}`,
        nivel: 'destacamento',
        idEntidad,
        idCargo: position.idCargoApi ?? null,
        idMiembro: String(casilla.idMiembros || ''),
        idPosicionDirectiva: position.idCargo,
        division: position.division ?? null,
        orden: position.orden || 1,
        origen: 'migracion-organigrama',
        fechaInicio: new Date().toISOString().slice(0, 10),
        fechaFin: null,
        activo: true,
        nombreMiembro: casilla.nombreMiembro || '',
        codigoMiembro: casilla.codigoMiembro || '',
        fotoMiembro: casilla.fotoMiembro || '',
        fechaActualizacion: FieldValue.serverTimestamp(),
        fechaCreacion: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  console.log(`\nA migrar: ${pendientes.length} | ya cubiertas: ${yaCubiertas.length}`);

  if (sinPosicion.length) {
    console.log('\nSIN POSICION EN EL CATALOGO (revisar a mano):');
    sinPosicion.forEach((x) => console.log(`  dest=${x.idDestacamento} | cargo=${x.cargo}/${x.division || '-'} | miembro=${x.idMiembros}`));
  }

  console.log('\nMigracion finalizada.');
  process.exit(0);
};

main().catch((error) => { console.error(error); process.exit(1); });
