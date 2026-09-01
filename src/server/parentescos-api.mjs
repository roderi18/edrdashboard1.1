// ----------------------------------------------------------------------
// EL PUENTE ENTRE NUESTRAS CLAVES Y LOS IDS DE LA API.
//
// Nosotros trabajamos con claves estables —`mother`, `father`, `guardian`…— y la
// API guarda un `idParentesco` numerico que asigna SU base de datos. Le mandamos
// un 7 a proposito y creo un 1: el numero lo pone ella, no nosotros.
//
// Por eso esos numeros NO se escriben a mano en ningun sitio. Si alguien borra y
// vuelve a crear un parentesco, los ids se corren; si se levanta otro entorno,
// salen distintos. Un tutor apuntado como "Madre" pasaria a ser "Tio/a" sin que
// nadie tocara nada y SIN NINGUN ERROR. Ese fallo silencioso es justo el que hay
// que evitar.
//
// Asi que se resuelven al vuelo, por NOMBRE, y lo que falte se crea. Da igual
// que el catalogo este vacio, que los ids salgan 1..7 o 40..47, o que alguien
// borre uno: si no esta, se pone.
//
// PENDIENTE, y seria mejor: pedirle al backend una columna de CODIGO estable en
// `Parentesco` (`codigo: "mother"`). Emparejar por nombre es solido pero tiene un
// punto flojo: si alguien renombra "Madre" a "Mamá" desde un panel, aqui se
// crearia un "Madre" duplicado. Es el fallo menos malo —visible y recuperable,
// en vez de silencioso—, pero con un codigo no existiria. Cambiarlo seria una
// linea: `porNombre` pasaria a `porCodigo`.
// ----------------------------------------------------------------------

const BASE = 'https://systexploradores.somee.com/api/Parentesco';

// Las mismas claves y etiquetas que `src/catalogs/parentescos.js`. Se repiten
// aqui a proposito: este fichero corre en el SERVIDOR y no puede importar del
// arbol del cliente sin arrastrarlo entero.
export const PARENTESCOS = [
  { clave: 'mother', nombre: 'Madre' },
  { clave: 'father', nombre: 'Padre' },
  { clave: 'guardian', nombre: 'Tutor' },
  { clave: 'grandparent', nombre: 'Abuelo/a' },
  { clave: 'uncle_aunt', nombre: 'Tío/a' },
  { clave: 'sibling', nombre: 'Hermano/a' },
  { clave: 'spouse', nombre: 'Cónyuge' },
  { clave: 'other', nombre: 'Otro' },
];

/** Sin tildes, sin mayusculas y sin espacios de sobra: "Tío/a" y "tio/a" son lo mismo. */
const normalizar = (texto) =>
  String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const filas = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;

  return [];
};

const leerCatalogo = async () => {
  const respuesta = await fetch(`${BASE}/GetAllParentesco?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!respuesta.ok) throw new Error(`El catálogo de parentesco no respondió (${respuesta.status}).`);

  return filas(await respuesta.json());
};

const crearParentesco = async (nombre) => {
  const respuesta = await fetch(`${BASE}/SetParentesco`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    // El id que se manda da igual: la base pone el suyo. Se manda 0 por claridad.
    body: JSON.stringify({ idParentesco: 0, nombre }),
  });

  if (!respuesta.ok) throw new Error(`No se pudo crear el parentesco "${nombre}".`);

  const datos = await respuesta.json();
  const creado = datos?.data ?? datos;
  const id = Number(creado?.idParentesco ?? 0);

  if (!id) throw new Error(`La API no devolvió el id de "${nombre}".`);

  return id;
};

/**
 * El mapa clave -> idParentesco, creando lo que falte.
 *
 * Se pide el catalogo UNA vez y se completa de golpe: pedirlo por cada tutor
 * serian tres viajes para guardar tres telefonos.
 */
export const mapaDeParentescos = async () => {
  const catalogo = await leerCatalogo();
  const porNombre = new Map(
    catalogo
      .map((fila) => [normalizar(fila?.nombre), Number(fila?.idParentesco ?? 0)])
      .filter(([nombre, id]) => nombre && id)
  );

  const mapa = new Map();

  for (const { clave, nombre } of PARENTESCOS) {
    const existente = porNombre.get(normalizar(nombre));

    if (existente) {
      mapa.set(clave, existente);
      continue;
    }

    // Se crean de uno en uno y EN ORDEN: asi los ids salen en el orden del
    // catalogo la primera vez, que es lo que espera quien mira la tabla.
    // eslint-disable-next-line no-await-in-loop
    mapa.set(clave, await crearParentesco(nombre));
  }

  return mapa;
};

/** El camino de vuelta: del id que guarda la API a nuestra clave. */
export const claveDesdeId = (mapa, idParentesco) => {
  const id = Number(idParentesco ?? 0);

  for (const [clave, valor] of mapa.entries()) {
    if (valor === id) return clave;
  }

  return '';
};
