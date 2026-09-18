import { normalizarTexto } from './buscador-catalogo.mjs';

// ----------------------------------------------------------------------
// PERSONAS Y NIVELES EN EL BUSCADOR DE LA CABECERA.
//
// El buscador encontraba pantallas, articulos y premios, pero no a la gente: para
// dar con un miembro habia que saber de que destacamento era, entrar en su lista
// y buscarlo alli. Aqui se busca a todos los miembros por su nombre, y a los
// destacamentos, secciones y regiones por el suyo.
//
// "SIMILARES Y COINCIDENTES": los nombres se escriben de memoria y con prisa.
// "Estalin", "Peralt", "jose" o "maria del carmen" tienen que encontrar a quien
// es. Cada palabra escrita busca una palabra del nombre que EMPIECE igual, que la
// LLEVE dentro o que se le PAREZCA (una letra de mas, de menos o cambiada).
// ----------------------------------------------------------------------

const textoLimpio = (valor) => String(valor ?? '').trim();

const palabrasDe = (texto) =>
  normalizarTexto(texto)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Cuantas letras hay que cambiar para pasar de una palabra a otra. */
export const distanciaEntre = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let anterior = Array.from({ length: b.length + 1 }, (_, indice) => indice);

  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];

    for (let j = 1; j <= b.length; j += 1) {
      actual[j] = Math.min(
        anterior[j] + 1,
        actual[j - 1] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    anterior = actual;
  }

  return anterior[b.length];
};

// Cuantas letras mal se le perdonan a una palabra segun lo larga que es. Con
// dos letras escritas no se adivina nada: "jo" no es "yo".
const toleranciaPara = (largo) => (largo >= 7 ? 2 : largo >= 4 ? 1 : 0);

/**
 * Lo lejos que queda una palabra escrita de una palabra del nombre: 0 si la
 * empieza, 1 si la lleva dentro, 2 o 3 si se le parece. `null` si no tiene nada
 * que ver.
 */
const cercaniaDePalabra = (escrita, delNombre) => {
  if (delNombre.startsWith(escrita)) return 0;
  if (escrita.length >= 3 && delNombre.includes(escrita)) return 1;

  const tolerancia = toleranciaPara(escrita.length);

  if (!tolerancia) return null;

  // Contra el principio de la palabra del mismo largo (lo que va escrito hasta
  // ahora) y contra la palabra entera (lo escrito completo, con una errata).
  const distancia = Math.min(
    distanciaEntre(escrita, delNombre.slice(0, escrita.length)),
    distanciaEntre(escrita, delNombre)
  );

  return distancia <= tolerancia ? 1 + distancia : null;
};

/**
 * Lo lejos que queda la consulta de un elemento, o `null` si no coincide.
 * TODAS las palabras escritas tienen que encontrar la suya: "juan perez" no
 * trae a todos los Juan.
 */
export const cercaniaDeNombre = (consulta, elemento) => {
  const escritas = palabrasDe(consulta);

  if (!escritas.length) return null;

  const nombre = normalizarTexto(elemento.nombre);
  const palabras = palabrasDe(elemento.nombre);
  const codigo = normalizarTexto(elemento.codigo);
  const texto = normalizarTexto(consulta);

  // El codigo de miembro va tal cual: "edr-10001" o solo "10001".
  if (codigo && texto.length >= 3 && codigo.includes(texto)) return 0;

  let total = 0;

  for (const escrita of escritas) {
    const cercanias = palabras
      .map((palabra) => cercaniaDePalabra(escrita, palabra))
      .filter((valor) => valor !== null);

    if (!cercanias.length) return null;

    total += Math.min(...cercanias);
  }

  // El nombre que empieza como lo escrito, delante de todo.
  return nombre.startsWith(texto) ? total : total + 0.5;
};

/** Los que coinciden, los mas cercanos primero. */
export const buscarPorNombre = ({ elementos = [], consulta = '', tope = 6 } = {}) => {
  if (!normalizarTexto(consulta)) return [];

  return elementos
    .map((elemento) => ({ elemento, cercania: cercaniaDeNombre(consulta, elemento) }))
    .filter(({ cercania }) => cercania !== null)
    .sort(
      (a, b) => a.cercania - b.cercania || a.elemento.nombre.localeCompare(b.elemento.nombre, 'es')
    )
    .slice(0, tope)
    .map(({ elemento }) => elemento);
};

// ----------------------------------------------------------------------
// EL INDICE, A PARTIR DE LO QUE DEVUELVE LA API .NET.
//
// Solo nombre, codigo y a donde pertenece: nada de telefonos, correos ni fechas
// de nacimiento. Es lo que cualquiera con sesion ve ya en un carnet o en un
// organigrama, y lo unico que hace falta para encontrar a alguien.
// ----------------------------------------------------------------------

const nombreDeDestacamento = (destacamento) =>
  [textoLimpio(destacamento?.nombre), textoLimpio(destacamento?.numero)].filter(Boolean).join(' ');

export const armarIndiceDeOrganizacion = ({
  miembros = [],
  destacamentos = [],
  iglesias = [],
  secciones = [],
  regiones = [],
} = {}) => {
  const regionPorId = new Map(
    regiones.map((region) => [String(region?.idRegion ?? region?.id), textoLimpio(region?.nombre)])
  );
  const seccionPorId = new Map(
    secciones.map((seccion) => [String(seccion?.idSeccion ?? seccion?.id), seccion])
  );
  const iglesiaPorId = new Map(
    iglesias.map((iglesia) => [String(iglesia?.idIglesia ?? iglesia?.id), iglesia])
  );
  const destacamentoPorId = new Map(
    destacamentos.map((destacamento) => [String(destacamento?.idDestacamento), destacamento])
  );

  // El destacamento cuelga de su iglesia, y la iglesia de su seccion.
  const seccionDeDestacamento = (destacamento) => {
    const idSeccion =
      destacamento?.idSeccion ?? iglesiaPorId.get(String(destacamento?.idIglesia))?.idSeccion;

    return seccionPorId.get(String(idSeccion)) ?? null;
  };

  return {
    miembros: miembros
      .map((miembro) => {
        const idDestacamento = miembro?.idDestacamento ?? null;

        return {
          id: String(miembro?.idMiembros ?? ''),
          nombre: [textoLimpio(miembro?.nombres), textoLimpio(miembro?.apellidos)]
            .filter(Boolean)
            .join(' '),
          codigo: textoLimpio(miembro?.codigoMiembro),
          idDestacamento: idDestacamento === null ? '' : String(idDestacamento),
          destacamento: nombreDeDestacamento(destacamentoPorId.get(String(idDestacamento))),
        };
      })
      .filter((miembro) => miembro.id && miembro.nombre),
    destacamentos: destacamentos
      .map((destacamento) => ({
        id: String(destacamento?.idDestacamento ?? ''),
        nombre: nombreDeDestacamento(destacamento),
        detalle: textoLimpio(seccionDeDestacamento(destacamento)?.nombre),
      }))
      .filter((destacamento) => destacamento.id && destacamento.nombre),
    secciones: secciones
      .map((seccion) => ({
        id: String(seccion?.idSeccion ?? seccion?.id ?? ''),
        nombre: textoLimpio(seccion?.nombre),
        detalle: regionPorId.get(String(seccion?.idRegion)) || '',
      }))
      .filter((seccion) => seccion.id && seccion.nombre),
    regiones: regiones
      .map((region) => ({
        id: String(region?.idRegion ?? region?.id ?? ''),
        nombre: textoLimpio(region?.nombre),
        detalle: '',
      }))
      .filter((region) => region.id && region.nombre),
  };
};
