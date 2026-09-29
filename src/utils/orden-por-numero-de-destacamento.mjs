// ----------------------------------------------------------------------
// LA LISTA DE DESTACAMENTOS VA POR NÚMERO (1, 2, … 46, … 189), no por nombre.
// Ordenar el número como texto dejaba "189" antes que "46"; aquí se compara
// como número. Los que no tienen número van al final, por nombre.
// ----------------------------------------------------------------------

const numeroDe = (dest) => {
  const n = Number.parseInt(String(dest?.destNumber ?? dest?.numero ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
};

const nombreDe = (dest) => String(dest?.destName ?? dest?.name ?? dest?.nombre ?? '');

export function compararPorNumeroDeDestacamento(a, b) {
  const na = numeroDe(a);
  const nb = numeroDe(b);
  if (na !== nb) {
    if (na === null) return 1;
    if (nb === null) return -1;
    return na - nb;
  }
  return nombreDe(a).localeCompare(nombreDe(b), 'es');
}
