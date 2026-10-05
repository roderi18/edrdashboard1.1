import { destacamentosDelMapa } from './destacamentos-del-mapa.mjs';
import { REGIONES_RD } from '../../utils/regiones-de-provincias.mjs';
import provincias from './provincias.geo.json' with { type: 'json' };
import {
  OPCIONES_ESTATUS_MIEMBRO,
  normalizarEstatusMiembro,
} from '../../utils/estatus-miembro.mjs';

// `color` es una clave de la paleta del tema (`primary`, `success`…), no un hex: así
// la pantalla sigue a los colores de la casa y al modo oscuro.
export const CATEGORIAS = [
  {
    id: 'navegantes',
    nombre: 'Navegantes',
    edades: '5–7 años',
    color: 'primary',
    imagen: '/marca/divisiones/navegantes.png',
  },
  {
    id: 'pioneros',
    nombre: 'Pioneros',
    edades: '8–10 años',
    color: 'success',
    imagen: '/marca/divisiones/pioneros.png',
  },
  {
    id: 'seguidores',
    nombre: 'Seguidores de la Senda',
    edades: '11–13 años',
    color: 'warning',
    imagen: '/iconos/seguidores.webp',
  },
  {
    id: 'exploradores',
    nombre: 'Exploradores',
    edades: '14–17 años',
    color: 'error',
    imagen: '/marca/divisiones/exploradores.png',
  },
  {
    id: 'lideres',
    nombre: 'Líderes adultos',
    edades: '18+ años',
    color: 'secondary',
    imagen: '/iconos/lider-organizacional.webp',
  },
];

export const nombresProvincias = provincias.features.map((p) => p.properties.name);
const clave = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const lista = (v) =>
  Array.isArray(v)
    ? v
    : Array.isArray(v?.data)
      ? v.data
      : Array.isArray(v?.Data)
        ? v.Data
        : Array.isArray(v?.items)
          ? v.items
          : [];
const id = (v) => String(v ?? '');

export function edadDe(fecha, hoy = new Date()) {
  if (!fecha) return null;
  const [ano, mes, dia] = String(fecha).slice(0, 10).split('-').map(Number);
  if (!ano || !mes || !dia || ano > hoy.getFullYear()) return null;
  const nacimiento = new Date(ano, mes - 1, dia);
  if (
    nacimiento.getFullYear() !== ano ||
    nacimiento.getMonth() !== mes - 1 ||
    nacimiento.getDate() !== dia
  )
    return null;
  return (
    hoy.getFullYear() -
    ano -
    (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia) ? 1 : 0)
  );
}

export function categoriaDe(miembro, hoy = new Date()) {
  const edad = edadDe(miembro.fechaNacimiento ?? miembro.birthDate, hoy);
  if (edad !== null) {
    if (edad >= 5 && edad <= 7) return 'navegantes';
    if (edad <= 10 && edad >= 8) return 'pioneros';
    if (edad <= 13 && edad >= 11) return 'seguidores';
    if (edad <= 17 && edad >= 14) return 'exploradores';
    if (edad >= 18) return 'lideres';
    return 'sin-categoria';
  }
  return (
    { 1: 'navegantes', 2: 'pioneros', 3: 'seguidores', 4: 'exploradores', 5: 'lideres' }[
      numero(miembro.idDivision)
    ] ?? 'sin-categoria'
  );
}

export function prepararPadron({ destacamentos, iglesias, secciones, regiones, miembros }) {
  const destsRaw = lista(destacamentos);
  const churches = lista(iglesias);
  const sectionals = lista(secciones);
  const regionals = lista(regiones);
  const dests = destacamentosDelMapa({
    destacamentos: destsRaw,
    iglesias: churches,
    secciones: sectionals,
    regiones: regionals,
    provinciasDelMapa: nombresProvincias,
  });
  const destPorId = new Map(dests.map((d) => [d.id, d]));
  const destOriginalPorId = new Map(destsRaw.map((d) => [id(d.idDestacamento), d]));
  const iglesiaPorId = new Map(churches.map((i) => [id(i.idIglesia), i]));
  const members = lista(miembros).map((m) => {
    const dest = destPorId.get(id(m.idDestacamento ?? m.destId));
    const sexo = clave(m.genero ?? m.gender);
    return {
      ...m,
      dest,
      categoria: categoriaDe(m),
      // El mismo campo que lee la lista de miembros; vacío o desconocido cuenta
      // como activo, igual que allí.
      estatus: normalizarEstatusMiembro(m.status ?? m.estatusMiembro),
      sexo: ['m', 'masculino', 'hombre'].includes(sexo)
        ? 'masculino'
        : ['f', 'femenino', 'mujer'].includes(sexo)
          ? 'femenino'
          : 'sin-dato',
    };
  });
  return {
    dests,
    destPorId,
    destOriginalPorId,
    iglesias: churches,
    iglesiaPorId,
    miembros: members,
    regiones: regionals,
  };
}

export function resumirPadron(padron, filtros = {}) {
  const { region = '', provincia = '', categoria = '', sexo = '', periodo = '' } = filtros;
  const dests = padron.dests.filter(
    (d) => (!region || d.region === region) && (!provincia || d.provincia === provincia)
  );
  const ids = new Set(dests.map((d) => d.id));
  const miembros = padron.miembros.filter(
    (m) =>
      ids.has(id(m.idDestacamento ?? m.destId)) &&
      (!categoria || m.categoria === categoria) &&
      (!sexo || m.sexo === sexo)
  );
  const destsConMiembros = new Set(miembros.map((m) => id(m.idDestacamento ?? m.destId)));
  const destsVisibles = categoria || sexo ? dests.filter((d) => destsConMiembros.has(d.id)) : dests;
  const idsIglesias = new Set(
    destsVisibles.map((d) => id(padron.destOriginalPorId.get(d.id)?.idIglesia)).filter(Boolean)
  );
  const completos = miembros
    .filter((m) => m.fechaNacimiento || m.birthDate)
    .filter((m) => m.sexo !== 'sin-dato' && m.dest).length;
  const porCategoria = Object.fromEntries(
    CATEGORIAS.map((c) => [c.id, miembros.filter((m) => m.categoria === c.id).length])
  );
  const porEstatus = Object.fromEntries(
    OPCIONES_ESTATUS_MIEMBRO.map((o) => [
      o.value,
      miembros.filter((m) => m.estatus === o.value).length,
    ])
  );
  const porRegion = REGIONES_RD.map((r) => {
    const suyos = destsVisibles.filter((d) => d.region === r.nombre);
    const suIds = new Set(suyos.map((d) => d.id));
    const ms = miembros.filter((m) => suIds.has(id(m.idDestacamento ?? m.destId)));
    return {
      ...r,
      destacamentos: suyos.length,
      miembros: ms.length,
      iglesias: new Set(
        suyos.map((d) => id(padron.destOriginalPorId.get(d.id)?.idIglesia)).filter(Boolean)
      ).size,
    };
  });
  const serieMensual = Array.from(
    { length: 12 },
    (_, index) =>
      miembros.filter((m) => {
        const fecha = m.createdAt ?? m.fechaCreacion;
        return (
          fecha &&
          new Date(fecha).getFullYear() === Number(periodo || new Date().getFullYear()) &&
          new Date(fecha).getMonth() === index
        );
      }).length
  );
  return {
    dests: destsVisibles,
    miembros,
    iglesias: idsIglesias.size,
    completos,
    pendientes: miembros.length - completos,
    porCategoria,
    porEstatus,
    porRegion,
    serieMensual,
    masculino: miembros.filter((m) => m.sexo === 'masculino').length,
    femenino: miembros.filter((m) => m.sexo === 'femenino').length,
    sinSexo: miembros.filter((m) => m.sexo === 'sin-dato').length,
    sinCategoria: miembros.filter((m) => m.categoria === 'sin-categoria').length,
  };
}
