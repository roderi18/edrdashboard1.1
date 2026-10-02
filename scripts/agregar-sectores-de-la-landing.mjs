// ----------------------------------------------------------------------
// SUMA AL CATÁLOGO DE SECTORES LOS QUE LLEGAN DESDE LA LANDING.
//
// La landing de registro deja escribir el sector a mano, y el campo Sector de la
// aplicación elige de `src/data/barrios.json`. Lo que el catálogo no tenía
// ("Los Mina", "Vista Mar"…) se guardaba en la iglesia pero no salía en la
// lista. Este script lee TODOS los envíos de `actualizaciones_destacamentos`
// y añade al catálogo, en su municipio, cada sector que no esté (sin mirar
// mayúsculas, tildes ni comas: ver `claveDeSector`).
//
// Solo AÑADE al final, con ids nuevos: los ids ya emitidos no se tocan.
//
// Uso:
//   node scripts/agregar-sectores-de-la-landing.mjs            simulación
//   node scripts/agregar-sectores-de-la-landing.mjs --aplicar  escribe barrios.json
// ----------------------------------------------------------------------

import fs from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { claveDeSector } from '../src/utils/sector-fuera-de-catalogo.mjs';

const APLICAR = process.argv.includes('--aplicar');
const RUTA_BARRIOS = 'src/data/barrios.json';
const leerJson = (ruta) => JSON.parse(fs.readFileSync(ruta, 'utf8'));

const provincias = leerJson('src/data/provincias.json');
// El id del municipio es su posición + 1, como en `location-select.jsx`.
const municipios = leerJson('src/data/municipios.json').map((m, i) => ({ ...m, id: i + 1 }));
const secciones = leerJson('src/data/secciones.json');
const barrios = leerJson(RUTA_BARRIOS);

const PEQUENAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e']);

/** "nueva esperanza calle principal" → "Nueva Esperanza Calle Principal"; sin comas. */
const nombreBonito = (texto) =>
  String(texto)
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((palabra, i) =>
      i > 0 && PEQUENAS.has(palabra.toLowerCase())
        ? palabra.toLowerCase()
        : palabra.charAt(0).toUpperCase() + palabra.slice(1)
    )
    .join(' ');

const credencial = () => {
  const linea = fs.readFileSync('.env.local', 'utf8').match(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m);
  const cuenta = JSON.parse(linea[1].replace(/^["']|["']$/g, ''));

  cuenta.private_key = cuenta.private_key.replace(/\\n/g, '\n');

  return cuenta;
};

const cuenta = credencial();
const db = getFirestore(initializeApp({ credential: cert(cuenta), projectId: cuenta.project_id }));
const envios = await db.collection('actualizaciones_destacamentos').get();

const municipioDe = (provincia, municipio) => {
  const p = provincias.find((x) => claveDeSector(x.nombre) === claveDeSector(provincia));

  const enLaProvincia = (m) => !p || String(m.provinciaId) === String(p.id);
  const clave = claveDeSector(municipio);

  // Exacto o, si no, el que empieza igual: la landing dice "Azua de
  // Compostela" y el catálogo, "Azua".
  return (
    municipios.find((m) => enLaProvincia(m) && claveDeSector(m.nombre) === clave) ||
    municipios.find((m) => enLaProvincia(m) && clave.startsWith(`${claveDeSector(m.nombre)} `))
  );
};

// La sección (zona) donde se cuelga el sector nuevo: la urbana del municipio, o la primera.
const seccionDe = (idMunicipio) => {
  const delMunicipio = secciones.filter((s) => String(s.municipioId) === String(idMunicipio));

  return delMunicipio.find((s) => /zona urbana/i.test(s.nombre)) || delMunicipio[0];
};

const yaEnElMunicipio = (clave, idMunicipio) => {
  const idsSeccion = new Set(
    secciones.filter((s) => String(s.municipioId) === String(idMunicipio)).map((s) => s.id)
  );

  return barrios.some((b) => idsSeccion.has(b.seccionId) && claveDeSector(b.nombre) === clave);
};

const nuevos = [];
const sinMunicipio = [];
let siguienteId = Math.max(...barrios.map((b) => b.id)) + 1;

envios.docs.forEach((documento) => {
  const direccion = documento.data().datos?.direccion || {};
  const sector = String(direccion.sector || '').trim();

  if (!sector) return;

  const municipio = municipioDe(direccion.provincia, direccion.municipio);

  if (!municipio) {
    sinMunicipio.push(`${sector} (${direccion.provincia} / ${direccion.municipio})`);
    return;
  }

  const clave = claveDeSector(sector);

  if (yaEnElMunicipio(clave, municipio.id)) return;
  if (nuevos.some((n) => n.clave === clave && n.idMunicipio === municipio.id)) return;

  const seccion = seccionDe(municipio.id);

  if (!seccion) {
    sinMunicipio.push(`${sector} (${municipio.nombre}: sin zona en secciones.json)`);
    return;
  }

  nuevos.push({
    clave,
    idMunicipio: municipio.id,
    municipio: municipio.nombre,
    barrio: { id: siguienteId++, nombre: nombreBonito(sector), seccionId: seccion.id },
  });
});

console.log(`${nuevos.length} sectores nuevos:`);
nuevos.forEach((n) => console.log(`  ${n.barrio.id}  ${n.barrio.nombre}  (${n.municipio})`));
if (sinMunicipio.length) console.log(`Sin municipio reconocible: ${sinMunicipio.join('; ')}`);

if (APLICAR && nuevos.length) {
  // Se añade al final con el mismo formato del archivo (CRLF, 2 y 4 espacios),
  // para que el diff sean solo las líneas nuevas.
  const texto = fs.readFileSync(RUTA_BARRIOS, 'utf8');
  const nl = texto.includes('\r\n') ? '\r\n' : '\n';
  const fin = texto.lastIndexOf(']');
  const bloques = nuevos.map(({ barrio }) =>
    [
      '  {',
      `    "id":${barrio.id},`,
      `    "nombre":${JSON.stringify(barrio.nombre)},`,
      `    "seccionId":${barrio.seccionId}`,
      '  }',
    ].join(nl)
  );

  fs.writeFileSync(
    RUTA_BARRIOS,
    `${texto.slice(0, fin).replace(/\s*$/, '')},${nl}${bloques.join(`,${nl}`)}${nl}${texto.slice(fin)}`
  );
  console.log(`Escrito en ${RUTA_BARRIOS}.`);
} else if (!APLICAR) {
  console.log('Simulación: usa --aplicar para escribirlos.');
}

process.exit(0);
