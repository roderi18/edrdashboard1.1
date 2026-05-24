export const isUnknownLabel = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .includes('desconocid');
