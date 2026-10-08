import { db } from './firebase.mjs';

// El mismo padrón .NET del dashboard y la misma relación destacamento → iglesia
// → sección → región usada por errd-registro. Nunca se entregan teléfonos ni
// correos de terceros en el catálogo público.
const API = process.env.API_NET_URL || 'https://systexploradores.somee.com/api';
let cache = { at: 0, promise: null, value: null };

const txt = (value) => String(value ?? '').trim();

async function pedir(path, body) {
  const response = await fetch(`${API}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Padrón ${path}: ${response.status}`);
  const json = await response.json();
  return json?.data ?? json;
}

async function leerCompleto() {
  const [destacamentos, iglesias, secciones, regiones, miembrosRespuesta, estadosSnap, cargosSnap] = await Promise.all([
    pedir('Destacamentos/GetAllDestacamentos'),
    pedir('Iglesias/GetAllIglesias'),
    pedir('Secciones/GetAllSecciones'),
    pedir('Regiones/GetAllRegiones'),
    pedir('Miembros/GetAllMiembrosPagination', { page: 1, pageSize: 10000 }),
    db().collection('estado_destacamentos').get(),
    db().collection('asignacionesDirectiva').where('nivel', '==', 'destacamento').where('idPosicionDirectiva', '==', 'destacamento-coordinador-destacamento').get(),
  ]);
  const iglesiaById = new Map(iglesias.map((x) => [String(x.idIglesia), x]));
  const seccionById = new Map(secciones.map((x) => [String(x.idSeccion), x]));
  const regionById = new Map(regiones.map((x) => [String(x.idRegion), x]));
  const miembros = miembrosRespuesta?.items || [];
  const miembroById = new Map(miembros.map((x) => [String(x.idMiembros), x]));
  const estados = new Map(estadosSnap.docs.map((x) => [x.id, x.data()?.estado || 'activo']));
  const coordinadorByDest = new Map();
  cargosSnap.docs.forEach((doc) => {
    const x = doc.data();
    if (x.activo !== false && x.idMiembro) coordinadorByDest.set(String(x.idEntidad), miembroById.get(String(x.idMiembro)));
  });
  return destacamentos
    .filter((x) => txt(x.nombre).toLowerCase() !== 'provisional')
    .map((x) => {
      const id = String(x.idDestacamento);
      const iglesia = iglesiaById.get(String(x.idIglesia)) || {};
      const seccion = seccionById.get(String(iglesia.idSeccion)) || {};
      const region = regionById.get(String(seccion.idRegion)) || {};
      const coordinador = coordinadorByDest.get(id);
      return {
        id,
        numero: txt(x.numero),
        nombre: txt(x.nombre),
        iglesia: txt(iglesia.nombre),
        pastor: txt(iglesia.pastor),
        seccion: txt(seccion.nombre),
        region: txt(region.nombre),
        idSeccion: seccion.idSeccion ? String(seccion.idSeccion) : '',
        coordinador: coordinador ? `${txt(coordinador.nombres)} ${txt(coordinador.apellidos)}`.trim() : '',
        estado: estados.get(id) || 'activo',
      };
    })
    .sort((a, b) => (Number(a.numero) || 99999) - (Number(b.numero) || 99999) || a.nombre.localeCompare(b.nombre, 'es'));
}

export async function leerPadron() {
  if (cache.value) {
    if (Date.now() - cache.at >= 5 * 60 * 1000 && !cache.promise) {
      cache.promise = leerCompleto()
        .then((value) => { cache = { value, at: Date.now(), promise: null }; return value; })
        .catch((error) => { cache.promise = null; console.warn('[padron] Se conserva copia pública:', error.message); });
    }
    return cache.value;
  }
  if (!cache.value) {
    const snap = await db().collection('landing_registro_copias').doc('destacamentos').get().catch(() => null);
    const copy = snap?.data();
    if (copy?.json) {
      const rows = JSON.parse(copy.json);
      cache.value = rows.map((x) => ({
        id: String(x.id), numero: txt(x.numero), nombre: txt(x.nombre),
        iglesia: txt(x.iglesia), pastor: txt(x.pastor), seccion: txt(x.seccion), region: txt(x.region),
        idSeccion: x.idSeccion ? String(x.idSeccion) : '',
        coordinador: txt(x.coordinador?.nombre), estado: txt(x.estado || 'activo'),
      }));
      cache.at = Date.now();
      // Como errd-registro, se sirve de inmediato la última copia pública y se
      // refresca la API en segundo plano. El comprobante de pago vuelve a validar.
      cache.promise = leerCompleto()
        .then((value) => { cache = { value, at: Date.now(), promise: null }; return value; })
        .catch((error) => { cache.promise = null; console.warn('[padron] Se conserva copia pública:', error.message); });
      return cache.value;
    }
  }
  if (!cache.promise) {
    cache.promise = leerCompleto()
      .then((value) => { cache = { value, at: Date.now(), promise: null }; return value; })
      .catch((error) => { cache.promise = null; throw error; });
  }
  return cache.promise;
}

export async function leerDestacamento(id) {
  return (await leerPadron()).find((x) => x.id === String(id)) || null;
}
