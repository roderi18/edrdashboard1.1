/**
 * Siembra en la API (.NET) los cargos del catálogo local `directiva-positions.js`
 * para los cuatro niveles: Consejo Nacional, Región, Sección y Destacamento.
 *
 * La tabla `Cargos` de la API solo tiene { idCargo, nombre } — no guarda nivel ni
 * división— y `asegurarCargoApi` deduplica POR NOMBRE. Por eso los nombres que se
 * envían van CUALIFICADOS con su nivel y, en el destacamento, con su división:
 * sin eso, "Coordinador de Promoción" de Región y de Sección colapsarían en un
 * único cargo indistinguible al leerlo de vuelta.
 *
 * Es idempotente: solo crea los que faltan, comparando por nombre normalizado.
 *
 * Uso (con el dev server levantado):
 *   node scripts/sync-cargos-api.mjs            # simulacro, no escribe nada
 *   node scripts/sync-cargos-api.mjs --apply    # crea los cargos que faltan
 *   node scripts/sync-cargos-api.mjs --apply --base-url http://localhost:3032
 */

import { DIRECTIVA_POSITIONS, DIRECTIVA_DIVISION_NAMES } from '../src/catalogs/directiva-positions.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const baseUrlIndex = args.indexOf('--base-url');
const BASE_URL = baseUrlIndex >= 0 ? args[baseUrlIndex + 1] : 'http://localhost:3032';

const NIVEL_SUFIJO = {
  nacional: 'Nacional',
  regional: 'Regional',
  seccional: 'Seccional',
  destacamento: 'Destacamento',
};

const normalizeKey = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');

// Nombre con el que el cargo queda GUARDADO en la API. Debe ser único en todo el
// catálogo, porque el nombre es la única clave que la tabla ofrece.
const buildApiCargoName = (position) => {
  const base = String(position.nombreCargo || '').trim();
  const division = position.division ? DIRECTIVA_DIVISION_NAMES[position.division] : '';
  const nivel = NIVEL_SUFIJO[position.nivel] || '';

  // En destacamento la división es lo que distingue (Líder de Grupo ×4).
  if (position.nivel === 'destacamento' && division) {
    return `${base} (${division})`;
  }

  // Si el nombre ya lleva su nivel dentro ("Coordinador Nacional de Promoción",
  // "Capellán Regional"), no se repite.
  return normalizeKey(base).includes(normalizeKey(nivel)) ? base : `${base} (${nivel})`;
};

const getRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;

  return [];
};

const main = async () => {
  const res = await fetch(`${BASE_URL}/api/cargos/`);

  if (!res.ok) {
    throw new Error(`No se pudo leer el catálogo de cargos (${res.status})`);
  }

  const existing = getRows(await res.json());
  const existingByName = new Map(existing.map((c) => [normalizeKey(c.nombre), c]));

  // Solo los cargos ASIGNABLES: los nodos agrupadores del organigrama
  // (divisiones, "Consejo Nacional", "Zonas"...) no son cargos de una persona.
  const assignable = DIRECTIVA_POSITIONS.filter((p) => p.asignable !== false && p.nombreCargo);

  const existingById = new Map(existing.map((c) => [String(c.idCargo), c]));

  const plan = assignable.map((position) => {
    // 1) Los que YA están mapeados a un idCargo de la API se respetan tal cual,
    //    aunque su nombre allí no siga esta convención: renombrarlos crearía un
    //    duplicado y dejaría huérfanas las asignaciones existentes.
    const yaMapeado = position.idCargoApi ? existingById.get(String(position.idCargoApi)) : null;

    if (yaMapeado) {
      return {
        idPosicionDirectiva: position.idPosicionDirectiva ?? position.idCargo,
        nivel: position.nivel,
        division: position.division || '',
        nombre: yaMapeado.nombre,
        idCargo: yaMapeado.idCargo,
        falta: false,
      };
    }

    // 2) El resto se crea con el nombre cualificado.
    const nombre = buildApiCargoName(position);
    const match = existingByName.get(normalizeKey(nombre));

    return {
      idPosicionDirectiva: position.idPosicionDirectiva ?? position.idCargo,
      nivel: position.nivel,
      division: position.division || '',
      nombre,
      idCargo: match?.idCargo ?? null,
      falta: !match,
    };
  });

  const faltantes = plan.filter((p) => p.falta);

  console.log(`Catálogo API: ${existing.length} cargos`);
  console.log(`Catálogo local asignable: ${assignable.length} posiciones`);
  console.log(`Ya existen: ${plan.length - faltantes.length} | Faltan: ${faltantes.length}\n`);

  faltantes.forEach((p) => console.log(`  [${p.nivel}] ${p.nombre}`));

  if (!faltantes.length) {
    console.log('\nNada que crear.');
    return;
  }

  if (!apply) {
    console.log('\nSimulacro. Vuelve a ejecutar con --apply para crearlos.');
    return;
  }

  console.log('\nCreando...');

  for (const p of faltantes) {
    // En serie a propósito: la API asigna el idCargo autoincremental y en
    // paralelo se han visto respuestas cruzadas.
    // eslint-disable-next-line no-await-in-loop
    const post = await fetch(`${BASE_URL}/api/cargos/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idCargo: 0, nombre: p.nombre }),
    });

    console.log(`  ${post.ok ? 'OK ' : 'ERR'} ${p.nombre}`);
  }

  // Mapa idPosicionDirectiva -> idCargo, para fijarlo en el catálogo local.
  const after = getRows(await (await fetch(`${BASE_URL}/api/cargos/`)).json());
  const afterByName = new Map(after.map((c) => [normalizeKey(c.nombre), c]));

  console.log('\n--- idPosicionDirectiva -> idCargo (para `idCargoApi` del catálogo local) ---');
  plan.forEach((p) => {
    const idCargo = afterByName.get(normalizeKey(p.nombre))?.idCargo;
    console.log(`${p.idPosicionDirectiva}\t${idCargo ?? '?'}\t${p.nombre}`);
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
