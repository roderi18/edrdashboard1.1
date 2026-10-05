import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';

// ----------------------------------------------------------------------
// CATÁLOGO DE LUGARES: el mismo del dashboard (src/data), para que la dirección
// quede como la guarda la app: "Provincia, Municipio, Sector, Calle".
// Los barrios (sectores) pesan: se cargan solo al llegar al paso de ubicación.
// ----------------------------------------------------------------------

const quitarTildes = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

export const mismoNombre = (a, b) => quitarTildes(a) === quitarTildes(b);

export const PROVINCIAS = [...provinciasData].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

// El dashboard numera los municipios por su posición en el archivo (índice + 1).
export const MUNICIPIOS = municipiosData.map((m, i) => ({ ...m, id: i + 1 }));

export const municipiosDe = (provincia) => {
  const p = PROVINCIAS.find((x) => mismoNombre(x.nombre, provincia));
  return p
    ? MUNICIPIOS.filter((m) => m.provinciaId === p.id).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    : [];
};

let sectoresPorMunicipio = null;

/** Sectores (barrios) de un municipio. Carga el catálogo la primera vez. */
export async function sectoresDe(municipio, provincia) {
  const m = municipiosDe(provincia).find((x) => mismoNombre(x.nombre, municipio));
  if (!m) return [];
  if (!sectoresPorMunicipio) {
    const [{ default: secciones }, { default: barrios }] = await Promise.all([
      import('src/data/secciones.json'),
      import('src/data/barrios.json'),
    ]);
    const municipioDeSeccion = new Map(secciones.map((s) => [s.id, s.municipioId]));
    sectoresPorMunicipio = new Map();
    barrios.forEach((b) => {
      const idMunicipio = municipioDeSeccion.get(b.seccionId);
      if (!idMunicipio) return;
      const lista = sectoresPorMunicipio.get(idMunicipio) || new Set();
      lista.add(b.nombre);
      sectoresPorMunicipio.set(idMunicipio, lista);
    });
  }
  return [...(sectoresPorMunicipio.get(m.id) || [])].sort((a, b) => a.localeCompare(b, 'es'));
}

// Los mismos días que el formulario de destacamentos del dashboard.
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados', 'Domingos'];

// Cargos con los que alguien puede estar llenando el formulario.
export const POSICIONES = [
  'Coordinador de Destacamento',
  'Coordinador Asistente de Destacamento',
  'Líder de grupo',
  'Pastor',
  'Otro líder del destacamento',
];
