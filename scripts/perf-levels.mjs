// Prueba de carga: replica el waterfall de red de cada vista de niveles
// organizacionales contra el dev server y mide el tiempo total por vista.
// No mide las consultas de fotos a Firestore (corren en el cliente); el
// waterfall de /api es la parte dominante y la que cambia la Fase 1.
//
// Uso: node scripts/perf-levels.mjs [baseURL] [iteraciones] [baseline|fase1]

const BASE = process.argv[2] || 'http://localhost:3032';
const ITERS = Number(process.argv[3] || 6);
const MODE = (process.argv[4] || 'baseline').toLowerCase();

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`, { redirect: 'follow' });
  await res.text();
  return res.status;
};

// ---------------------------------------------------------------------------
// BASELINE: imita el codigo original (awaits en serie + datasets duplicados)
// ---------------------------------------------------------------------------

const baseline = {
  Regiones: async () => {
    await get('/api/regional');
    await Promise.all([
      get('/api/sectional'),
      get('/api/churches'),
      get('/api/dest'),
      get('/api/members'),
    ]);
  },
  Secciones: async () => {
    await Promise.all([get('/api/sectional'), get('/api/dest'), get('/api/churches')]);
    await get('/api/regional');
    // buildSectionalList: vuelve a pedir todo, en serie
    await get('/api/sectional');
    await get('/api/regional');
    await get('/api/members');
    await get('/api/dest');
    await get('/api/churches');
  },
  Destacamentos: async () => {
    await get('/api/dest'); // base
    // metadata esperaba a los dests base (gate por tableLoading)
    await Promise.all([
      get('/api/sectional'),
      get('/api/regional'),
      get('/api/churches'),
      get('/api/members'),
    ]);
    await get('/api/dest'); // build con fotos
  },
  Miembros: async () => {
    // metadata y cargos esperaban a que terminaran los miembros
    await get('/api/members');
    await Promise.all([
      get('/api/dest'),
      get('/api/churches'),
      get('/api/sectional'),
      get('/api/regional'),
      get('/api/cargos'),
      get('/api/cargos-miembros'),
    ]);
  },
};

// ---------------------------------------------------------------------------
// FASE 1: una sola tanda en paralelo, sin duplicados ni gates en serie
// ---------------------------------------------------------------------------

const fase1 = {
  Regiones: async () => {
    await Promise.all([
      get('/api/regional'),
      get('/api/sectional'),
      get('/api/churches'),
      get('/api/dest'),
      get('/api/members'),
    ]);
  },
  Secciones: async () => {
    await Promise.all([
      get('/api/sectional'),
      get('/api/dest'),
      get('/api/churches'),
      get('/api/regional'),
      get('/api/members'),
    ]);
  },
  Destacamentos: async () => {
    // base dests y metadata en paralelo, luego el build con fotos
    await Promise.all([
      get('/api/dest'),
      Promise.all([
        get('/api/sectional'),
        get('/api/regional'),
        get('/api/churches'),
        get('/api/members'),
      ]),
    ]);
    await get('/api/dest');
  },
  Miembros: async () => {
    const metadata = Promise.all([
      get('/api/dest'),
      get('/api/churches'),
      get('/api/sectional'),
      get('/api/regional'),
    ]);
    const membersThenCargos = get('/api/members').then(() =>
      Promise.all([get('/api/cargos'), get('/api/cargos-miembros')])
    );
    await Promise.all([metadata, membersThenCargos]);
  },
};

const time = async (fn) => {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round(sum / s.length),
    min: Math.round(s[0]),
    max: Math.round(s[s.length - 1]),
    median: Math.round(median(s)),
  };
};

const runSingle = async (views, label) => {
  console.log(`Base: ${BASE} | modo: ${label} | iteraciones: ${ITERS} (+1 warmup)\n`);
  console.log('Vista          avg     median   min     max   (ms)');
  console.log('------------------------------------------------');
  for (const [name, fn] of Object.entries(views)) {
    await time(fn).catch(() => {});
    const samples = [];
    for (let i = 0; i < ITERS; i += 1) samples.push(await time(fn));
    const s = stats(samples);
    console.log(
      `${name.padEnd(14)} ${String(s.avg).padStart(5)}   ${String(s.median).padStart(6)}  ${String(s.min).padStart(5)}  ${String(s.max).padStart(5)}`
    );
  }
};

// Intercala baseline y fase1 por iteracion para que ambos vivan la misma
// ventana de latencia de somee; reporta la mediana de cada uno y la mejora.
const runCompare = async () => {
  console.log(`Base: ${BASE} | modo: compare (intercalado) | iteraciones: ${ITERS} (+1 warmup)\n`);
  console.log('Vista          baseline  fase1   mejora   (ms, mediana)');
  console.log('-------------------------------------------------------');

  for (const name of Object.keys(baseline)) {
    await time(baseline[name]).catch(() => {});
    await time(fase1[name]).catch(() => {});

    const b = [];
    const f = [];
    for (let i = 0; i < ITERS; i += 1) {
      b.push(await time(baseline[name]));
      f.push(await time(fase1[name]));
    }
    const bm = median(b);
    const fm = median(f);
    const pct = Math.round(((bm - fm) / bm) * 100);
    console.log(
      `${name.padEnd(14)} ${String(Math.round(bm)).padStart(7)}  ${String(Math.round(fm)).padStart(6)}   ${String(pct).padStart(4)}%`
    );
  }
};

const run = async () => {
  if (MODE === 'compare') return runCompare();
  return runSingle(MODE === 'fase1' ? fase1 : baseline, MODE);
};

run().catch((error) => {
  console.error('Fallo la prueba de carga:', error);
  process.exit(1);
});
