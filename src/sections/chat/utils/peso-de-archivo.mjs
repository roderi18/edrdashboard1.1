// ----------------------------------------------------------------------
// LO QUE PESA UN ARCHIVO, EN CORTO.
//
// Se escribia en la caja de adjuntar, mientras se sube, y en ningun sitio mas:
// una vez enviado, el documento solo decia su tipo ("application/pdf") y habia
// que descargarlo para saber si eran 80 kB o 40 MB. Ahora lo dicen los dos, con
// las mismas unidades, porque la cuenta vive aqui.
//
// Un decimal basta: la diferencia entre 1,2 MB y 1,25 MB no le cambia la
// decision a nadie, y dos decimales hacen la linea mas larga que el nombre.
// ----------------------------------------------------------------------

export function pesoDeArchivo(bytes) {
  const numero = Number(bytes);

  // Sin dato no se inventa un cero: un "0 B" al lado del nombre parece un
  // archivo roto, y lo que pasa es que no sabemos cuanto pesa.
  if (!Number.isFinite(numero) || numero <= 0) return '';

  if (numero < 1024) return `${numero} B`;
  if (numero < 1024 * 1024) return `${(numero / 1024).toFixed(1)} KB`;

  return `${(numero / (1024 * 1024)).toFixed(1)} MB`;
}
