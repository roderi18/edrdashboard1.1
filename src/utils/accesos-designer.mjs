import { COLECCIONES } from '../config/esquema-firestore.mjs';

// ----------------------------------------------------------------------
// QUIÉN ENTRA A EXPEDITION DESIGNER, A QUÉ PESTAÑAS Y PARA QUÉ.
//
// El Designer era solo del Administrador Global, y cada excepción (la Oficina
// Nacional en Cintas, Medallas y Pines) iba escrita en el código. Ahora el
// Administrador Global lo decide en la pestaña "Accesos": cada REGLA da a un
// usuario concreto (su cuenta) o a un rol (todos los que lo ejercen) unas
// pestañas y unas acciones —crear, editar, eliminar—. Varias reglas que alcanzan
// a la misma persona se SUMAN. El Administrador Global lo puede todo siempre.
//
// Se guarda en `configuracion_designer/accesos`: la lista de reglas, para la
// pantalla, y un índice plano (`permisos`, "pestaña:acción" → usuarios y roles),
// que es lo único que saben leer las reglas de Firestore y Storage. Sin documento
// vale lo de fábrica: la Oficina Nacional crea y edita cintas, medallas y pines.
//
// Qué significa cada acción en cada pestaña:
//   - Cintas, Medallas, Pines: crear (agregar), editar, eliminar. Cambiar el
//     orden global sigue siendo del Administrador Global.
//   - Portada y Tarjeta: editar (editar y publicar). Crear y eliminar no aplican.
//   - Paleta: solo se ve (guarda en el navegador de quien la usa).
//
// Sin React ni Firebase, para probarlo con `node --test`.
// ----------------------------------------------------------------------

export const COLECCION_CONFIGURACION_DESIGNER = COLECCIONES.configuracionDesigner;
export const DOCUMENTO_ACCESOS_DESIGNER = 'accesos';

export const PESTANAS_DESIGNER = Object.freeze([
  Object.freeze({ id: 'portada', nombre: 'Portada', acciones: ['editar'] }),
  Object.freeze({ id: 'cintas', nombre: 'Cintas', acciones: ['crear', 'editar', 'eliminar'] }),
  Object.freeze({ id: 'medallas', nombre: 'Medallas', acciones: ['crear', 'editar', 'eliminar'] }),
  Object.freeze({ id: 'pines', nombre: 'Pines', acciones: ['crear', 'editar', 'eliminar'] }),
  Object.freeze({ id: 'paleta', nombre: 'Paleta', acciones: [] }),
  Object.freeze({ id: 'tarjeta', nombre: 'Tarjeta', acciones: ['editar'] }),
]);

export const ACCIONES_DESIGNER = Object.freeze([
  Object.freeze({ id: 'crear', nombre: 'Crear' }),
  Object.freeze({ id: 'editar', nombre: 'Editar' }),
  Object.freeze({ id: 'eliminar', nombre: 'Eliminar' }),
]);

export const TIPOS_DE_REGLA = Object.freeze({ usuario: 'usuario', rol: 'rol' });

const IDS_PESTANAS = PESTANAS_DESIGNER.map((pestana) => pestana.id);
const IDS_ACCIONES = ACCIONES_DESIGNER.map((accion) => accion.id);

/** La pestaña del Designer de cada tipo de insignia. */
export const PESTANA_DE_INSIGNIA = Object.freeze({
  cinta: 'cintas',
  medalla: 'medallas',
  pin: 'pines',
});

const texto = (valor, maximo = 120) =>
  String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo);

// Lo que da hoy el código: la Oficina Nacional agrega y edita las insignias.
export const REGLAS_DE_FABRICA = Object.freeze([
  Object.freeze({
    id: 'rol-oficina_nacional',
    tipo: TIPOS_DE_REGLA.rol,
    clave: 'oficina_nacional',
    nombre: 'Oficina Nacional',
    pestanas: ['cintas', 'medallas', 'pines'],
    acciones: ['crear', 'editar'],
  }),
]);

/** El id estable de una regla: una por usuario y una por rol. */
export const idDeRegla = (tipo, clave) => `${tipo}-${texto(clave, 128)}`;

/** Una regla saneada, o null si no sirve (sin a quién, sin pestañas). */
export const sanearRegla = (regla = {}) => {
  const tipo = Object.values(TIPOS_DE_REGLA).includes(regla?.tipo) ? regla.tipo : null;
  const clave = texto(regla?.clave, 128);
  const pestanas = [...new Set((regla?.pestanas ?? []).filter((id) => IDS_PESTANAS.includes(id)))];
  const acciones = [...new Set((regla?.acciones ?? []).filter((id) => IDS_ACCIONES.includes(id)))];

  if (!tipo || !clave || !pestanas.length) return null;

  return {
    id: idDeRegla(tipo, clave),
    tipo,
    clave,
    nombre: texto(regla?.nombre) || clave,
    ...(regla?.idMiembros ? { idMiembros: texto(regla.idMiembros, 40) } : {}),
    pestanas: IDS_PESTANAS.filter((id) => pestanas.includes(id)),
    acciones: IDS_ACCIONES.filter((id) => acciones.includes(id)),
  };
};

/** Las reglas de un documento; sin documento (o sin lista), las de fábrica. */
export const reglasDeAccesos = (documento) => {
  if (!documento || !Array.isArray(documento.reglas))
    return REGLAS_DE_FABRICA.map((r) => ({ ...r }));

  const porId = new Map();

  documento.reglas
    .map(sanearRegla)
    .filter(Boolean)
    .forEach((regla) => porId.set(regla.id, regla));

  return [...porId.values()];
};

/**
 * El índice que leen las reglas de seguridad: "pestaña:acción" → quiénes. Ver
 * la pestaña ("pestaña:ver") cuenta aparte: la da cualquier regla que la nombre.
 */
export const indiceDePermisos = (reglas = []) => {
  const indice = {};
  const sumar = (llave, regla) => {
    indice[llave] = indice[llave] || { usuarios: [], roles: [] };
    const lista = regla.tipo === TIPOS_DE_REGLA.usuario ? 'usuarios' : 'roles';

    if (!indice[llave][lista].includes(regla.clave)) indice[llave][lista].push(regla.clave);
  };

  reglas.forEach((regla) => {
    regla.pestanas.forEach((pestana) => {
      sumar(`${pestana}:ver`, regla);
      regla.acciones.forEach((accion) => sumar(`${pestana}:${accion}`, regla));
    });
  });

  return indice;
};

/** El documento que se guarda: las reglas y su índice. */
export const documentoDeAccesos = (reglas = []) => {
  const limpias = reglas.map(sanearRegla).filter(Boolean);

  return { reglas: limpias, permisos: indiceDePermisos(limpias) };
};

/**
 * Lo que puede una persona: `{ pestanas, puede(pestana, accion) }`.
 *
 * @param esAdministradorGlobal  Lo puede todo, siempre.
 * @param uid                    Su cuenta (las reglas por usuario).
 * @param roles                  TODOS los roles que ejerce (las reglas por rol).
 * @param reglas                 Las reglas vigentes.
 */
export const accesoDesigner = ({
  esAdministradorGlobal = false,
  uid = '',
  roles = [],
  reglas = REGLAS_DE_FABRICA,
} = {}) => {
  if (esAdministradorGlobal) {
    return {
      todo: true,
      pestanas: [...IDS_PESTANAS],
      puede: () => true,
    };
  }

  const suyas = reglas.filter((regla) =>
    regla.tipo === TIPOS_DE_REGLA.usuario
      ? Boolean(uid) && regla.clave === String(uid)
      : roles.map(String).includes(regla.clave)
  );
  const pestanas = IDS_PESTANAS.filter((id) => suyas.some((regla) => regla.pestanas.includes(id)));

  return {
    todo: false,
    pestanas,
    puede: (pestana, accion) =>
      suyas.some(
        (regla) =>
          regla.pestanas.includes(pestana) && (accion === 'ver' || regla.acciones.includes(accion))
      ),
  };
};

// ----------------------------------------------------------------------
// LAS REGLAS VIGENTES EN ESTE NAVEGADOR. Las registra la escucha compartida
// (`use-accesos-designer.js`), y desde ahí las preguntas de los servicios
// (`puedeEnDesigner`) responden sin leer otra vez. En el servidor y en las
// pruebas valen las de fábrica.
// ----------------------------------------------------------------------

let reglasVigentes = REGLAS_DE_FABRICA;

export const registrarAccesosDesigner = (reglas) => {
  reglasVigentes = Array.isArray(reglas) ? reglas : REGLAS_DE_FABRICA;
};

export const reglasDesignerVigentes = () => reglasVigentes;
