export const STORAGE_KEY = 'mapa-rd-composicion-v1';

export const ESCENA_INICIAL = Object.freeze({
  mapa: { id: 'mapa', tipo: 'mapa', x: 0, y: 0, ancho: 100, alto: 100, z: 0 },
  elementos: [],
});

const LIMITES_MINIMOS = {
  mapa: { ancho: 25, alto: 25 },
  linea: { ancho: 6, alto: 3 },
  default: { ancho: 4, alto: 4 },
};

export function limitar(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

export function normalizarMarco(marco) {
  const minimos = LIMITES_MINIMOS[marco.tipo] || LIMITES_MINIMOS.default;
  const ancho = limitar(Number(marco.ancho) || minimos.ancho, minimos.ancho, 100);
  const alto = limitar(Number(marco.alto) || minimos.alto, minimos.alto, 100);
  const x = limitar(Number(marco.x) || 0, 0, 100 - ancho);
  const y = limitar(Number(marco.y) || 0, 0, 100 - alto);

  return { ...marco, x, y, ancho, alto };
}

export function crearElemento(tipo, indice = 0) {
  const desplazamiento = (indice % 5) * 4;
  const base = {
    id: `${tipo}-${Date.now()}-${indice}`,
    tipo,
    x: 38 + desplazamiento,
    y: 34 + desplazamiento,
    ancho: 20,
    alto: 16,
    z: indice + 3,
    color: '#f4b942',
    opacidad: 1,
  };

  if (tipo === 'circulo') return { ...base, ancho: 13, alto: 18 };
  if (tipo === 'linea') return { ...base, y: 48, ancho: 24, alto: 8, invertida: false };
  if (tipo === 'texto') {
    return { ...base, ancho: 22, alto: 9, texto: 'Texto editable', tamanoTexto: 24 };
  }
  if (tipo === 'icono') {
    return { ...base, ancho: 9, alto: 13, icono: 'solar:medal-star-circle-bold' };
  }
  if (tipo === 'entidad') {
    return {
      ...base,
      ancho: 11,
      alto: 17,
      nivelEntidad: 'nacional',
      entidadId: 'consejo-nacional',
      nombreEntidad: 'Consejo Nacional',
      imagenEntidad: '/parches/Generales/consejo-nacional-cuadrado.webp',
      usarImagen: true,
      mostrarNombre: true,
    };
  }
  return base;
}

export function normalizarEscena(valor) {
  if (!valor || typeof valor !== 'object') return ESCENA_INICIAL;

  const mapa = normalizarMarco({ ...ESCENA_INICIAL.mapa, ...(valor.mapa || {}), id: 'mapa' });
  const elementos = Array.isArray(valor.elementos)
    ? valor.elementos
        .filter((elemento) => elemento && typeof elemento.id === 'string')
        .map(normalizarMarco)
    : [];

  return { mapa, elementos };
}
