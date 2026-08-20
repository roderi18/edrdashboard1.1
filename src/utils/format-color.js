const HEX_COLOR_NAMES_ES = {
  '#000000': 'Negro',
  '#FFFFFF': 'Blanco',
  '#FFFC00': 'Amarillo',
  '#FFC107': 'Amarillo',
  '#FFD666': 'Amarillo',
  '#FF5630': 'Naranja',
  '#FB8C00': 'Naranja',
  '#1890FF': 'Azul',
  '#1E88E5': 'Azul',
  '#00B8D9': 'Celeste',
  '#36CFC9': 'Turquesa',
  '#00AB55': 'Verde',
  '#4CAF50': 'Verde',
  '#FF4842': 'Rojo',
  '#E53935': 'Rojo',
  '#7635DC': 'Morado',
  '#8E33FF': 'Morado',
  '#6C757D': 'Gris',
  '#ADB5BD': 'Gris',
  '#795548': 'Marron',
  '#8D6E63': 'Marron',
  '#F8BBD0': 'Rosado',
  '#EC407A': 'Rosado',
};

const isHexColor = (value = '') => /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(value.trim());

const normalizeHex = (value = '') => {
  const trimmed = value.trim();

  if (!isHexColor(trimmed)) {
    return trimmed;
  }

  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toUpperCase();
  }

  return trimmed.toUpperCase();
};

export const fNaturalColor = (value) => {
  if (!value) return '';

  const text = String(value).trim();
  const normalizedHex = normalizeHex(text);

  if (HEX_COLOR_NAMES_ES[normalizedHex]) {
    return HEX_COLOR_NAMES_ES[normalizedHex];
  }

  if (isHexColor(text)) {
    return normalizedHex;
  }

  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // `\p{L}` y no `\w`: con `\w`, que es solo ASCII, una tilde contaba como
    // frontera de palabra y la letra de detras salia en mayuscula ("MarróN").
    .replace(
      /(^|[\s.])(\p{L})/gu,
      (coincidencia, separador, letra) => separador + letra.toLocaleUpperCase()
    );
};

export const fVariantDescription = (size, color) => {
  const parts = [size, fNaturalColor(color)].filter(Boolean);
  return parts.join(' / ');
};

export const fReceiptItemDescription = (description) => {
  if (!description) return '';

  return String(description)
    .split('/')
    .map((part) => {
      const trimmed = part.trim();
      return isHexColor(trimmed) ? fNaturalColor(trimmed) : trimmed;
    })
    .join(' / ');
};
