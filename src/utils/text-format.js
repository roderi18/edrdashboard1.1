// ----------------------------------------------------------------------

export function capitalizeWords(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
