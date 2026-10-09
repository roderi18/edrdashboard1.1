import { db } from './firebase.mjs';

// El mismo padrón .NET del dashboard y la misma relación destacamento → iglesia
// → sección → región usada por errd-registro. Nunca se entregan teléfonos ni
// correos de terceros en el catálogo público.
const API = process.env.API_NET_URL || 'https://systexploradores.somee.com/api';
let cache = { at: 0, promise: null, value: null };

const txt = (value) => String(value ?? '').trim();
const jurisdiccionVisible = (value) => {
  const nombre = txt(value);
  return nombre.toLocaleLowerCase('es') === 'provisional' ? '' : nombre;
};

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

// Índice de búsqueda separado del padrón público: usa una copia pequeña en
// Firestore y no espera los estados ni cargos de destacamentos. Las consultas
// simultáneas comparten carga; la copia se actualiza en segundo plano.
let personas = { at: 0, load: null, refresh: null, value: null };

function indicePersonas(miembros, destacamentos, iglesias, secciones, regiones) {
  const destacamentoById = new Map(
    destacamentos.map((x) => [String(x.idDestacamento), x])
  );
  const iglesiaById = new Map(iglesias.map((x) => [String(x.idIglesia), x]));
  const seccionById = new Map(secciones.map((x) => [String(x.idSeccion), x]));
  const regionById = new Map(regiones.map((x) => [String(x.idRegion), x]));
  return miembros
    .map((m) => {
      const destacamento = destacamentoById.get(String(m.idDestacamento)) || {};
      const iglesia = iglesiaById.get(String(destacamento.idIglesia)) || {};
      const seccion = seccionById.get(String(iglesia.idSeccion)) || {};
      const region = regionById.get(String(seccion.idRegion)) || {};
      return {
        id: String(m.idMiembros),
        nombre: `${txt(m.nombres)} ${txt(m.apellidos)}`.trim(),
        nombres: txt(m.nombres),
        apellidos: txt(m.apellidos),
        region: jurisdiccionVisible(region.nombre),
        seccion: jurisdiccionVisible(seccion.nombre),
      };
    })
    .filter((p) => p.nombre);
}

function refrescarPersonas() {
  if (!personas.refresh) {
    personas.refresh = pedirIndicePersonas()
      .then((value) => {
        personas.value = value;
        personas.at = Date.now();
        const json = JSON.stringify(value);
        if (json.length < 900_000)
          db()
            .collection('landing_registro_copias')
            .doc('personas')
            .set({ json, actualizadoEn: new Date(personas.at).toISOString() })
            .catch((error) => console.warn('[personas] No se guardó la copia:', error.message));
        return value;
      })
      .finally(() => {
        personas.refresh = null;
      });
  }
  return personas.refresh;
}

async function cargarPersonas() {
  if (personas.value) {
    if (Date.now() - personas.at >= 5 * 60 * 1000)
      refrescarPersonas().catch((error) =>
        console.warn('[personas] Se conserva el índice anterior:', error.message)
      );
    return personas.value;
  }
  if (!personas.load) {
    personas.load = (async () => {
      const copia = await db()
        .collection('landing_registro_copias')
        .doc('personas')
        .get()
        .catch(() => null);
      const datos = copia?.data();
      if (datos?.json) {
        try {
          const value = JSON.parse(datos.json);
          if (Array.isArray(value)) {
            if (!personas.value) {
              personas.value = value;
              personas.at = Date.parse(datos.actualizadoEn) || 0;
            }
            if (Date.now() - personas.at >= 5 * 60 * 1000)
              refrescarPersonas().catch((error) =>
                console.warn('[personas] Se conserva la copia:', error.message)
              );
            return personas.value;
          }
        } catch (error) {
          console.warn('[personas] Copia no válida:', error.message);
        }
      }
      return refrescarPersonas();
    })().finally(() => {
      personas.load = null;
    });
  }
  return personas.load;
}

async function pedirIndicePersonas() {
  const [miembrosRespuesta, destacamentos, iglesias, secciones, regiones] = await Promise.all([
    pedir('Miembros/GetAllMiembrosPagination', { page: 1, pageSize: 10000 }),
    pedir('Destacamentos/GetAllDestacamentos'),
    pedir('Iglesias/GetAllIglesias'),
    pedir('Secciones/GetAllSecciones'),
    pedir('Regiones/GetAllRegiones'),
  ]);
  return indicePersonas(miembrosRespuesta?.items || [], destacamentos, iglesias, secciones, regiones);
}

async function leerCompleto() {
  const [destacamentos, iglesias, secciones, regiones, miembrosRespuesta, estadosSnap, cargosSnap] =
    await Promise.all([
      pedir('Destacamentos/GetAllDestacamentos'),
      pedir('Iglesias/GetAllIglesias'),
      pedir('Secciones/GetAllSecciones'),
      pedir('Regiones/GetAllRegiones'),
      pedir('Miembros/GetAllMiembrosPagination', { page: 1, pageSize: 10000 }),
      db().collection('estado_destacamentos').get(),
      db()
        .collection('asignacionesDirectiva')
        .where('nivel', '==', 'destacamento')
        .where('idPosicionDirectiva', '==', 'destacamento-coordinador-destacamento')
        .get(),
    ]);
  const iglesiaById = new Map(iglesias.map((x) => [String(x.idIglesia), x]));
  const seccionById = new Map(secciones.map((x) => [String(x.idSeccion), x]));
  const regionById = new Map(regiones.map((x) => [String(x.idRegion), x]));
  const miembros = miembrosRespuesta?.items || [];
  personas.value = indicePersonas(miembros, destacamentos, iglesias, secciones, regiones);
  personas.at = Date.now();
  const miembroById = new Map(miembros.map((x) => [String(x.idMiembros), x]));
  const estados = new Map(estadosSnap.docs.map((x) => [x.id, x.data()?.estado || 'activo']));
  const coordinadorByDest = new Map();
  cargosSnap.docs.forEach((doc) => {
    const x = doc.data();
    if (x.activo !== false && x.idMiembro)
      coordinadorByDest.set(String(x.idEntidad), miembroById.get(String(x.idMiembro)));
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
        coordinador: coordinador
          ? `${txt(coordinador.nombres)} ${txt(coordinador.apellidos)}`.trim()
          : '',
        estado: estados.get(id) || 'activo',
        // "Registrado en la Oficina Nacional" del padrón: de aquí sale el
        // descuento por fidelidad (registro 2026), salvo que Firestore lo corrija.
        registradoOfnc: typeof x.registradoOfnc === 'boolean' ? x.registradoOfnc : null,
      };
    })
    .sort(
      (a, b) =>
        (Number(a.numero) || 99999) - (Number(b.numero) || 99999) ||
        a.nombre.localeCompare(b.nombre, 'es')
    );
}

export async function leerPadron() {
  if (cache.value) {
    if (Date.now() - cache.at >= 5 * 60 * 1000 && !cache.promise) {
      cache.promise = leerCompleto()
        .then((value) => {
          cache = { value, at: Date.now(), promise: null };
          return value;
        })
        .catch((error) => {
          cache.promise = null;
          console.warn('[padron] Se conserva copia pública:', error.message);
        });
    }
    return cache.value;
  }
  if (!cache.value) {
    const snap = await db()
      .collection('landing_registro_copias')
      .doc('destacamentos')
      .get()
      .catch(() => null);
    const copy = snap?.data();
    if (copy?.json) {
      const rows = JSON.parse(copy.json);
      cache.value = rows.map((x) => ({
        id: String(x.id),
        numero: txt(x.numero),
        nombre: txt(x.nombre),
        iglesia: txt(x.iglesia),
        pastor: txt(x.pastor),
        seccion: txt(x.seccion),
        region: txt(x.region),
        idSeccion: x.idSeccion ? String(x.idSeccion) : '',
        coordinador: txt(x.coordinador?.nombre),
        estado: txt(x.estado || 'activo'),
        registradoOfnc: typeof x.registradoOfnc === 'boolean' ? x.registradoOfnc : null,
      }));
      cache.at = Date.now();
      // Como errd-registro, se sirve de inmediato la última copia pública y se
      // refresca la API en segundo plano. El comprobante de pago vuelve a validar.
      cache.promise = leerCompleto()
        .then((value) => {
          cache = { value, at: Date.now(), promise: null };
          return value;
        })
        .catch((error) => {
          cache.promise = null;
          console.warn('[padron] Se conserva copia pública:', error.message);
        });
      return cache.value;
    }
  }
  if (!cache.promise) {
    cache.promise = leerCompleto()
      .then((value) => {
        cache = { value, at: Date.now(), promise: null };
        return value;
      })
      .catch((error) => {
        cache.promise = null;
        throw error;
      });
  }
  return cache.promise;
}

export async function leerDestacamento(id) {
  return (await leerPadron()).find((x) => x.id === String(id)) || null;
}

const sinTildes = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Busca personas por nombre: todas las palabras escritas deben aparecer.
// Como mucho 10, con nombre, región y sección; sin datos de contacto.
export async function buscarPersonas(texto) {
  const palabras = sinTildes(texto).split(/\s+/).filter(Boolean);
  // La petición vacía del formulario precarga el índice antes de escribir.
  if (!palabras.length) {
    await cargarPersonas();
    return [];
  }
  if (palabras.join('').length < 3) return [];
  const indice = await cargarPersonas();
  return indice
    .filter((p) => {
      const nombre = sinTildes(p.nombre);
      return palabras.every((palabra) => nombre.includes(palabra));
    })
    .slice(0, 10);
}

// Regiones y secciones de la API (para corregir la jurisdicción con una lista,
// no a mano). Diez minutos en memoria: cambian poco.
let jurisdicciones = { at: 0, valor: null };

export async function leerJurisdicciones() {
  if (jurisdicciones.valor && Date.now() - jurisdicciones.at < 10 * 60 * 1000) {
    return jurisdicciones.valor;
  }
  const [secciones, regiones] = await Promise.all([
    pedir('Secciones/GetAllSecciones'),
    pedir('Regiones/GetAllRegiones'),
  ]);
  const nombreRegion = new Map(regiones.map((r) => [String(r.idRegion), txt(r.nombre)]));
  const valor = {
    // "Provisional" no es una región de verdad (como el destacamento provisional).
    regiones: regiones
      .map((r) => txt(r.nombre))
      .filter((n) => n && n.toLowerCase() !== 'provisional')
      .sort((a, b) => a.localeCompare(b, 'es')),
    secciones: secciones
      .map((s) => ({ nombre: txt(s.nombre), region: nombreRegion.get(String(s.idRegion)) || '' }))
      .filter((s) => s.nombre && s.region && s.region.toLowerCase() !== 'provisional')
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
  jurisdicciones = { at: Date.now(), valor };
  return valor;
}
