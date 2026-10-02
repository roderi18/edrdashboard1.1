// Ajustes visuales compartidos por cualquier bloque de EXPEDITION Designer.
// Se guardan dentro de `diseno` y pasan por el mismo ciclo de borrador,
// publicación, versiones y campañas que los demás ajustes.

const objeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const colorValido = (valor) =>
  typeof valor === 'string' && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(valor);
const numero = (valor, min, max) =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= min && valor <= max
    ? valor
    : null;

export const FUENTES_DEL_LIENZO = Object.freeze([
  'Inter',
  'DM Sans',
  'Nunito Sans',
  'Public Sans',
  'Barlow',
  'Arial',
  'Georgia',
]);

export const PROPIEDADES_VISUALES = Object.freeze({
  x: [numero, -1000, 1000],
  y: [numero, -1000, 1000],
  width: [numero, 1, 2000],
  height: [numero, 1, 2000],
  fontSize: [numero, 6, 200],
  letterSpacing: [numero, -5, 40],
  lineHeight: [numero, 0.5, 3],
  opacity: [numero, 0, 1],
  rotate: [numero, -360, 360],
  borderRadius: [numero, 0, 500],
  color: [colorValido],
  backgroundColor: [colorValido],
  fontFamily: [(valor) => FUENTES_DEL_LIENZO.includes(valor)],
  fontWeight: [(valor) => ['400', '500', '600', '700', '800', '900'].includes(String(valor))],
  textAlign: [(valor) => ['left', 'center', 'right'].includes(valor)],
});

export const propiedadesDeElemento = (valor) => {
  if (!objeto(valor)) return null;

  const resultado = {};

  for (const [campo, dato] of Object.entries(valor)) {
    if (campo === 'texto') {
      if (typeof dato !== 'string' || dato.length > 500) return null;
      resultado.texto = dato;
      continue;
    }

    const [validar, min, max] = PROPIEDADES_VISUALES[campo] ?? [];
    if (!validar || (validar === numero ? validar(dato, min, max) === null : !validar(dato))) {
      return null;
    }

    resultado[campo] = dato;
  }

  return resultado;
};

export const sanearElementosVisuales = (valor) => {
  if (valor === undefined) return undefined;
  if (!objeto(valor) || Object.keys(valor).length > 120) return null;

  const resultado = {};

  for (const [clave, propiedades] of Object.entries(valor)) {
    // El número señala un elemento seleccionable en el componente real.
    if (!/^(?:0|[1-9]\d{0,3})$/.test(clave)) return null;
    const limpio = propiedadesDeElemento(propiedades);
    if (limpio === null) return null;
    resultado[clave] = limpio;
  }

  return resultado;
};

export const sanearCapasVisuales = (valor) => {
  if (valor === undefined) return undefined;
  if (!Array.isArray(valor) || valor.length > 40) return null;

  const ids = new Set();
  const resultado = [];

  for (const capa of valor) {
    if (!objeto(capa) || !/^[a-z0-9-]{1,40}$/i.test(capa.id) || ids.has(capa.id)) return null;
    if (!['texto', 'forma', 'imagen'].includes(capa.tipo)) return null;
    if (numero(capa.x, 0, 100) === null || numero(capa.y, 0, 100) === null) return null;
    if (numero(capa.width, 1, 100) === null || numero(capa.height, 1, 100) === null) return null;
    if (capa.tipo === 'texto' && (typeof capa.texto !== 'string' || capa.texto.length > 500)) {
      return null;
    }
    if (
      capa.tipo === 'imagen' &&
      (typeof capa.src !== 'string' || !/^(?:https:\/\/|\/(?!\/))[^\s]{1,2000}$/.test(capa.src))
    ) {
      return null;
    }

    const estilo = propiedadesDeElemento(capa.estilo ?? {});
    if (estilo === null) return null;

    ids.add(capa.id);
    resultado.push({
      id: capa.id,
      tipo: capa.tipo,
      x: capa.x,
      y: capa.y,
      width: capa.width,
      height: capa.height,
      ...(capa.tipo === 'texto' ? { texto: capa.texto } : {}),
      ...(capa.tipo === 'imagen' ? { src: capa.src } : {}),
      estilo,
    });
  }

  return resultado;
};
