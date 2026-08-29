import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ----------------------------------------------------------------------
// Deja que una prueba importe el codigo REAL de `src/`.
//
// La aplicacion escribe `src/utils/...` (alias de Next) y omite la extension en
// los imports relativos; node no resuelve ni lo uno ni lo otro, y por eso las
// pruebas de acceso venian replicando la regla en vez de ejecutarla —una replica
// puede pasar mientras la aplicacion hace justo lo contrario—.
//
// Se registra desde la propia prueba con `register()`, asi que no hay que tocar
// ni el comando de pruebas ni la configuracion del proyecto.
// ----------------------------------------------------------------------

const RAIZ = process.cwd();
const EXTENSIONES = ['', '.js', '.mjs', '/index.js', '/index.mjs'];

const primeroQueExista = (base) => {
  for (const extension of EXTENSIONES) {
    const candidato = base + extension;

    if (fs.existsSync(candidato) && fs.statSync(candidato).isFile()) return candidato;
  }

  return null;
};

// Los .json necesitan el atributo de import; el codigo de la aplicacion no lo
// pone porque se lo resuelve el empaquetador.
const resultado = (archivo) => {
  const url = pathToFileURL(archivo).href;

  return {
    url,
    shortCircuit: true,
    ...(url.endsWith('.json') ? { importAttributes: { type: 'json' }, format: 'json' } : {}),
  };
};

export async function resolve(especificador, contexto, siguiente) {
  if (especificador.startsWith('src/')) {
    const archivo = primeroQueExista(path.join(RAIZ, especificador));

    if (archivo) return resultado(archivo);
  }

  if (especificador.startsWith('.') && contexto.parentURL?.startsWith('file:')) {
    const carpeta = path.dirname(
      new URL(contexto.parentURL).pathname.replace(/^\/([A-Za-z]:)/, '$1')
    );
    const archivo = primeroQueExista(path.resolve(carpeta, especificador));

    if (archivo) return resultado(archivo);
  }

  return siguiente(especificador, contexto);
}
