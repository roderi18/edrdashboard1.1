// Migra a `asignacionesDirectiva` (Firestore) los cargos que solo viven en
// `CargosMiembros` (API .NET), antes de que el dashboard deje de leer esa API.
//
// Cubre TODOS los niveles: nacion, region, seccion y destacamento. La entidad de
// cada cargo se resuelve desde el destacamento del miembro, siguiendo la misma
// cadena que usa la app (destacamento -> iglesia -> seccion -> region).
//
//   Reporte:  node scripts/directivas/migrar-cargos-api-a-firestore.mjs
//   Aplicar:  node scripts/directivas/migrar-cargos-api-a-firestore.mjs --apply
//
// Requiere FIREBASE_SERVICE_ACCOUNT en el entorno (.env.local).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import { DIRECTIVA_POSITIONS } from '../../src/catalogs/directiva-positions.js';

const APPLY = process.argv.includes('--apply');
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API = 'https://systexploradores.somee.com/api';
const COLECCION = 'asignacionesDirectiva';

for (const archivo of ['.env.local', '.env']) {
  const ruta = path.join(rootDir, archivo);
  if (!fs.existsSync(ruta)) continue;
  fs.readFileSync(ruta, 'utf8')
    .split(/\r?\n/)
    .forEach((linea) => {
      const t = linea.trim();
      if (!t || t.startsWith('#')) return;
      const i = t.indexOf('=');
      if (i === -1) return;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      const entrecomillado =
        (v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'));
      if (entrecomillado) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    });
}

// Mismas normalizaciones que `directivas-organizacionales-service`, para que el
// id del documento salga IDENTICO al que escribe la app. Si difiriera, la app
// crearia un segundo documento para la misma casilla y volveriamos al problema.
const normalizarId = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const crearIdAsignacion = ({ nivel, idEntidad, idCargo, idPosicionDirectiva, division, orden }) =>
  [
    normalizarId(nivel),
    normalizarId(idEntidad || 'general'),
    normalizarId(idPosicionDirectiva || idCargo),
    normalizarId(division || 'general'),
    normalizarId(orden || 1),
  ].join('_');

const pedir = async (ruta) => {
  const res = await fetch(`${API}/${ruta}`, { headers: { Accept: 'application/json' } });
  const texto = await res.text();

  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
};

const filas = (payload) =>
  Array.isArray(payload) ? payload : payload?.data || payload?.Data || [];

const nombreDe = (miembro) =>
  [miembro?.nombres, miembro?.apellidos].filter(Boolean).join(' ').trim();

const main = async () => {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
  const db = getFirestore(app);

  const [cargosMiembros, miembros, dests, iglesias, secciones] = await Promise.all([
    pedir('CargosMiembros/GetAllCargosMiembros').then(filas),
    pedir('Miembros/GetAllMiembros').then(filas),
    pedir('Destacamentos/GetAllDestacamentos').then(filas),
    pedir('Iglesias/GetAllIglesias').then(filas),
    pedir('Secciones/GetAllSecciones').then(filas),
  ]);

  const miembroPorId = new Map(miembros.map((m) => [String(m.idMiembros ?? m.id), m]));
  const destPorId = new Map(dests.map((d) => [String(d.idDestacamento ?? d.id), d]));
  const iglesiaPorId = new Map(iglesias.map((i) => [String(i.idIglesia ?? i.id), i]));
  const seccionPorId = new Map(secciones.map((s) => [String(s.idSeccion ?? s.id), s]));
  const posicionPorCargoApi = new Map(
    DIRECTIVA_POSITIONS.filter((p) => p.idCargoApi).map((p) => [Number(p.idCargoApi), p])
  );

  // Cadena destacamento -> iglesia -> seccion -> region, la misma de buildOrgIndex.
  const entidadDelMiembro = (idMiembro, nivel) => {
    if (nivel === 'nacional') return 'nacional';

    const miembro = miembroPorId.get(String(idMiembro));
    const idDest = String(miembro?.idDestacamento ?? '');

    if (nivel === 'destacamento') return idDest;

    const dest = destPorId.get(idDest);
    const idSeccion = String(
      dest?.idSeccion ?? iglesiaPorId.get(String(dest?.idIglesia))?.idSeccion ?? ''
    );

    if (nivel === 'seccional') return idSeccion;
    if (nivel === 'regional') return String(seccionPorId.get(idSeccion)?.idRegion ?? '');

    return '';
  };

  const snapshot = await db.collection(COLECCION).get();
  const yaActivas = new Set(
    snapshot.docs
      .map((d) => d.data())
      .filter((x) => x.activo)
      .map((x) => `${x.idMiembro}:${x.idCargo}`)
  );

  console.log(`Modo: ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN (solo reporta)'}`);
  console.log(`Filas en CargosMiembros: ${cargosMiembros.length}`);
  console.log('');

  const pendientes = [];
  const sinCatalogo = [];
  const sinEntidad = [];

  cargosMiembros.forEach((fila) => {
    const idMiembro = String(fila.idMiembro);
    const idCargo = Number(fila.idCargo);

    if (yaActivas.has(`${idMiembro}:${idCargo}`)) return;

    const position = posicionPorCargoApi.get(idCargo);

    if (!position) {
      sinCatalogo.push({ idMiembro, idCargo });
      return;
    }

    const idEntidad = entidadDelMiembro(idMiembro, position.nivel);

    if (!idEntidad) {
      sinEntidad.push({ idMiembro, idCargo, nivel: position.nivel });
      return;
    }

    pendientes.push({ fila, position, idEntidad, idMiembro });
  });

  for (const { fila, position, idEntidad, idMiembro } of pendientes) {
    const miembro = miembroPorId.get(idMiembro);
    const idAsignacion = crearIdAsignacion({
      nivel: position.nivel,
      idEntidad,
      idCargo: position.idCargoApi,
      idPosicionDirectiva: position.idCargo,
      division: position.division,
      orden: position.orden,
    });

    console.log(`  ${idAsignacion}`);
    console.log(
      `     miembro=${idMiembro} "${nombreDe(miembro)}" | ${position.nombreCargo} (${position.nivel}) | entidad=${idEntidad}`
    );

    if (!APPLY) continue;

    // eslint-disable-next-line no-await-in-loop
    await db
      .collection(COLECCION)
      .doc(idAsignacion)
      .set(
        {
          idAsignacion,
          idDirectiva: `${normalizarId(position.nivel)}_${normalizarId(idEntidad || 'general')}`,
          nivel: position.nivel,
          idEntidad: String(idEntidad),
          idCargo: position.idCargoApi,
          idMiembro,
          idPosicionDirectiva: position.idCargo,
          division: position.division ?? null,
          orden: position.orden || 1,
          origen: 'migracion-cargos-api',
          fechaInicio:
            String(fila.fechaInicio || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
          fechaFin: null,
          activo: true,
          nombreMiembro: nombreDe(miembro),
          codigoMiembro: String(miembro?.codigoMiembro ?? ''),
          fotoMiembro: '',
          fechaActualizacion: FieldValue.serverTimestamp(),
          fechaCreacion: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  console.log('');
  console.log(`A migrar: ${pendientes.length}`);

  if (sinCatalogo.length) {
    console.log('');
    console.log('SIN EQUIVALENCIA EN EL CATALOGO (se descartan: ningun organigrama usa ese id):');
    sinCatalogo.forEach((x) => console.log(`  miembro=${x.idMiembro} | idCargo=${x.idCargo}`));
  }

  if (sinEntidad.length) {
    console.log('');
    console.log('SIN ENTIDAD RESOLUBLE (requieren revision manual):');
    sinEntidad.forEach((x) =>
      console.log(`  miembro=${x.idMiembro} | idCargo=${x.idCargo} | nivel=${x.nivel}`)
    );
  }

  console.log('');
  console.log('Migracion finalizada.');
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
