// ----------------------------------------------------------------------
// EL MANIFIESTO DE MEDALLAS, PARA PRODUCCIÓN.
//
// En desarrollo, `/api/insignias/medallas` lee la carpeta en el momento: una
// imagen nueva aparece al recargar. En Netlify la función no lleva `public/`
// consigo, así que lee este manifiesto, que se genera solo antes de cada build
// (`prebuild` en package.json) con la carpeta tal como está al desplegar.
//
// Uso a mano: node scripts/generar-manifiesto-medallas.mjs
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

const carpeta = path.join(process.cwd(), 'public', 'parches', 'Cintas y medallas', 'medallas');
const destino = path.join(process.cwd(), 'src', 'utils', 'medallas-manifiesto.json');

const archivos = fs.existsSync(carpeta)
  ? fs
      .readdirSync(carpeta, { withFileTypes: true })
      .filter((entrada) => entrada.isFile())
      .map((entrada) => entrada.name)
      .sort()
  : [];

fs.writeFileSync(destino, `${JSON.stringify({ archivos }, null, 2)}\n`);

console.log(
  `[medallas] manifiesto con ${archivos.length} archivos → ${path.relative(process.cwd(), destino)}`
);
