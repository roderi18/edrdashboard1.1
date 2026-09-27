import 'server-only';

import { cercaniaDeNombre } from 'src/utils/buscador-organizacion.mjs';

import { db } from './firebase.mjs';

// ----------------------------------------------------------------------
// LECTURAS DE LA LANDING (solo servidor).
//
// La API .NET devuelve el padrón entero y tarda de 0,3 a 17 s; por eso se lee
// aquí, se guarda 5 minutos en memoria y al navegador solo le llega lo mínimo:
// nada de teléfonos, fechas de nacimiento ni códigos de miembro.
// ----------------------------------------------------------------------

const API = process.env.API_NET_URL || 'https://systexploradores.somee.com/api';
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

// Vencido, se entrega lo guardado AL INSTANTE y se relee por detrás: antes, cada
// 5 minutos la primera búsqueda esperaba a la API (hasta 17 s) y se quedaba en
// "Buscando…". Dos lecturas a la vez comparten la misma petición.
async function conCache(clave, leer) {
  const guardado = cache.get(clave);
  const releer = () => {
    if (guardado?.leyendo) return guardado.leyendo;
    const leyendo = leer()
      .then((valor) => {
        cache.set(clave, { valor, en: Date.now() });
        return valor;
      })
      .catch((error) => {
        if (guardado) cache.set(clave, { ...guardado, leyendo: null });
        else cache.delete(clave);
        throw error;
      });
    cache.set(clave, { ...(guardado || {}), leyendo });
    return leyendo;
  };
  if (guardado && 'valor' in guardado) {
    if (Date.now() - guardado.en >= CACHE_MS) releer().catch(() => {});
    return guardado.valor;
  }
  return releer();
}

async function pedir(ruta, cuerpo) {
  const res = await fetch(`${API}/${ruta}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`API ${ruta}: ${res.status}`);
  const json = await res.json();
  return json?.data ?? json;
}

const texto = (v) => String(v ?? '').trim();

// "Provincia, Municipio, Sector, Calle" (así la guarda el dashboard).
const partirDireccion = (direccion) => {
  const [provincia = '', municipio = '', sector = '', ...resto] = texto(direccion)
    .split(',')
    .map((p) => p.trim());
  return { provincia, municipio, sector, calle: resto.join(', ') };
};

const esRelleno = (v) => {
  const t = texto(v).toLowerCase();
  return !t || t === 'n/a' || t.includes('no especificad') || t.startsWith('desconocid');
};

// ---------------------------------------------------------------- secciones

export const leerSecciones = () =>
  conCache('secciones', async () => {
    const [secciones, regiones, fotosRegion] = await Promise.all([
      pedir('Secciones/GetAllSecciones'),
      pedir('Regiones/GetAllRegiones'),
      fotosDe('region').catch(() => new Map()),
    ]);
    const region = new Map(regiones.map((r) => [r.idRegion, texto(r.nombre)]));
    return secciones
      .filter((s) => texto(s.nombre) && texto(s.nombre).toLowerCase() !== 'provisional')
      .map((s) => ({
        id: s.idSeccion,
        nombre: texto(s.nombre),
        idRegion: s.idRegion,
        region: region.get(s.idRegion) || '',
        // Icono de la región (su foto de perfil en el dashboard), para la leyenda del mapa.
        fotoRegion: fotosRegion.get(String(s.idRegion)) || '',
      }))
      .sort((a, b) => a.region.localeCompare(b.region, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
  });

// ---------------------------------------------------------------- destacamentos

const fotosDeDestacamentos = () => fotosDe('destacamento');

async function fotosDe(tipoEntidad) {
  const snap = await db().collection('fotos').where('tipoEntidad', '==', tipoEntidad).get();
  const fotos = new Map();
  snap.docs.forEach((d) => {
    const f = d.data();
    if (f.tipoFoto === 'perfil' && f.estado === 'activo') fotos.set(String(f.idEntidad), f.urlFoto || '');
  });
  return fotos;
}

async function coordinadoresAsignados() {
  const snap = await db()
    .collection('asignacionesDirectiva')
    .where('nivel', '==', 'destacamento')
    .where('idPosicionDirectiva', '==', 'destacamento-coordinador-destacamento')
    .get();
  const mapa = new Map();
  snap.docs.forEach((d) => {
    const a = d.data();
    if (a.activo !== false && a.idMiembro) mapa.set(String(a.idEntidad), String(a.idMiembro));
  });
  return mapa;
}

async function estadosDeDestacamentos() {
  const snap = await db().collection('estado_destacamentos').get();
  return new Map(snap.docs.map((d) => [d.id, d.data()?.estado || 'activo']));
}

export const leerDestacamentos = () =>
  conCache('destacamentos', async () => {
    const [destacamentos, iglesias, secciones, miembros, fotos, coordinadores, estados] = await Promise.all([
      pedir('Destacamentos/GetAllDestacamentos'),
      pedir('Iglesias/GetAllIglesias'),
      leerSecciones(),
      leerMiembrosCrudos(),
      fotosDeDestacamentos().catch(() => new Map()),
      coordinadoresAsignados().catch(() => new Map()),
      estadosDeDestacamentos().catch(() => new Map()),
    ]);
    const iglesia = new Map(iglesias.map((i) => [i.idIglesia, i]));
    const seccion = new Map(secciones.map((s) => [s.id, s]));
    const miembro = new Map(miembros.map((m) => [String(m.idMiembros), m]));

    return destacamentos
      .filter((d) => texto(d.nombre).toLowerCase() !== 'provisional')
      .map((d) => {
        const ig = iglesia.get(d.idIglesia) || {};
        const sec = seccion.get(ig.idSeccion) || {};
        const coord = miembro.get(coordinadores.get(String(d.idDestacamento)) || '');
        return {
          id: d.idDestacamento,
          nombre: texto(d.nombre),
          numero: texto(d.numero),
          idSeccion: sec.id ?? null,
          seccion: sec.nombre || '',
          region: sec.region || '',
          foto: fotos.get(String(d.idDestacamento)) || '',
          estado: estados.get(String(d.idDestacamento)) || 'activo',
          iglesia: esRelleno(ig.nombre) ? '' : texto(ig.nombre),
          pastor: esRelleno(ig.pastor) ? '' : texto(ig.pastor),
          // El teléfono no viaja al navegador: solo se dice si hay uno registrado.
          pastorTieneTelefono: Boolean(texto(ig.telefono)),
          direccion: partirDireccion(ig.direccion),
          coordinador: coord ? { id: coord.idMiembros, nombre: `${texto(coord.nombres)} ${texto(coord.apellidos)}`.trim() } : null,
          coordinadorTieneTelefono: Boolean(texto(coord?.telefono)),
          registradoOfnc: d.registradoOfnc ?? null,
          rritrackActivo: d.rritrackActivo ?? null,
          diaReunion: texto(d.diaReunion),
          horaReunion: texto(d.horaReunion),
        };
      })
      .sort((a, b) => (Number(a.numero) || 99999) - (Number(b.numero) || 99999) || a.nombre.localeCompare(b.nombre, 'es'));
  });

// ---------------------------------------------------------------- miembros

const leerMiembrosCrudos = () =>
  conCache('miembros', async () => (await pedir('Miembros/GetAllMiembrosPagination', { page: 1, pageSize: 10000 }))?.items || []);

// Mayor de edad (18+) o sin fecha de nacimiento en la app.
const edad = (fecha) => {
  const f = new Date(fecha);
  if (Number.isNaN(f.getTime())) return null;
  const hoy = new Date();
  let anos = hoy.getFullYear() - f.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), f.getMonth(), f.getDate())) anos -= 1;
  return anos;
};

const miembrosElegibles = () =>
  conCache('miembros-elegibles', async () => {
    // Número del destacamento para distinguir a dos personas con el mismo
    // nombre; leerDestacamentos ya deja fuera "Provisional".
    const numeroDe = new Map(
      (await leerDestacamentos().catch(() => [])).map((d) => [String(d.id), d.numero])
    );
    return (await leerMiembrosCrudos())
      .filter((m) => {
        if (texto(m.estatusMiembro).toLowerCase() === 'fallecido') return false;
        const e = edad(m.fechaNacimiento);
        return e === null || e >= 18;
      })
      .map((m) => ({
        id: m.idMiembros,
        nombre: `${texto(m.nombres)} ${texto(m.apellidos)}`.trim(),
        destacamento: numeroDe.get(String(m.idDestacamento)) || '',
        // Para ponerle su destacamento en el paso 2 (Provisional no está en la lista).
        idDestacamento: numeroDe.has(String(m.idDestacamento)) ? m.idDestacamento : null,
      }))
      .filter((m) => m.nombre && !m.nombre.toLowerCase().startsWith('desconocido'));
  });

/** Hasta 10 personas que se parecen a lo escrito (mínimo 3 letras). Solo id y nombre. */
export async function buscarMiembros(consulta) {
  const q = texto(consulta);
  // Con menos de 3 letras no se busca, pero se deja la lista lista en memoria:
  // el formulario llama así al abrirse para que la primera búsqueda sea inmediata.
  const lista = await miembrosElegibles();
  if (q.replace(/\s/g, '').length < 3) return [];
  return lista
    .map((m) => ({ m, c: cercaniaDeNombre(q, { nombre: m.nombre }) }))
    .filter(({ c }) => c !== null)
    .sort((a, b) => a.c - b.c || a.m.nombre.localeCompare(b.m.nombre, 'es'))
    .slice(0, 10)
    .map(({ m }) => m);
}

// ---------------------------------------------------------------- ficha del miembro

// Lo que se precarga al elegir un nombre. La página es pública y sin sesión:
// SOLO lo no sensible (nombre, sexo, talla, destacamento, cargos y foto). La
// fecha de nacimiento, el teléfono y la dirección no salen nunca del servidor;
// la persona los escribe si quiere actualizarlos.
const cargosDe = async (idMiembro) => {
  const snap = await db()
    .collection('asignacionesDirectiva')
    .where('idMiembro', 'in', [String(idMiembro), Number(idMiembro)])
    .get();
  const activas = snap.docs.map((d) => d.data()).filter((a) => a.activo !== false && !a.fechaFin);
  return {
    posicionDestacamento: activas.find((a) => a.nivel === 'destacamento')?.idPosicionDirectiva || '',
    cargoNacional: activas.find((a) => a.nivel !== 'destacamento')?.idPosicionDirectiva || '',
  };
};

const fotoDeMiembro = async (idMiembro) => {
  const snap = await db()
    .collection('fotos')
    .where('tipoEntidad', '==', 'miembro')
    .where('idEntidad', '==', String(idMiembro))
    .get();
  const f = snap.docs.map((d) => d.data()).find((x) => x.tipoFoto === 'perfil' && x.estado === 'activo');
  return f?.urlFoto || '';
};

/** Datos no sensibles de un miembro elegible, o null si no es elegible. */
export async function leerFichaMiembro(id) {
  const elegible = (await miembrosElegibles()).find((m) => String(m.id) === String(id));
  if (!elegible) return null;
  const crudo = (await leerMiembrosCrudos()).find((m) => String(m.idMiembros) === String(id)) || {};
  const [cargos, foto] = await Promise.all([
    cargosDe(id).catch(() => ({ posicionDestacamento: '', cargoNacional: '' })),
    fotoDeMiembro(id).catch(() => ''),
  ]);
  return {
    id: elegible.id,
    nombres: texto(crudo.nombres),
    apellidos: texto(crudo.apellidos),
    sexo: ['M', 'F'].includes(texto(crudo.genero)) ? texto(crudo.genero) : '',
    talla: texto(crudo.sizeCamisas),
    idDestacamento: elegible.idDestacamento,
    ...cargos,
    foto,
  };
}

/** Lo registrado HOY de un miembro, completo, para comparar en el servidor (nunca va al navegador). */
export async function leerMiembroParaComparar(id) {
  const crudo = (await leerMiembrosCrudos()).find((m) => String(m.idMiembros) === String(id));
  if (!crudo) return null;
  const cargos = await cargosDe(id).catch(() => ({ posicionDestacamento: '', cargoNacional: '' }));
  const [provincia = '', municipio = '', sector = '', ...resto] = texto(crudo.direccion)
    .split(',')
    .map((p) => p.trim());
  return {
    nombres: texto(crudo.nombres),
    apellidos: texto(crudo.apellidos),
    fechaNacimiento: texto(crudo.fechaNacimiento).slice(0, 10),
    direccion: { provincia, municipio, sector, calle: resto.join(', ') },
    sexo: texto(crudo.genero),
    talla: texto(crudo.sizeCamisas),
    idDestacamento: crudo.idDestacamento ?? null,
    ...cargos,
  };
}

/** Código de miembro (EDR-…) por id. SOLO para guardarlo en el envío: nunca va al navegador. */
export async function codigoDeMiembro(id) {
  if (!id) return null;
  const crudo = (await leerMiembrosCrudos()).find((m) => String(m.idMiembros) === String(id));
  return texto(crudo?.codigoMiembro) || null;
}
