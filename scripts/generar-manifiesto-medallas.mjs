// ----------------------------------------------------------------------
// LOS MANIFIESTOS DE MEDALLAS Y PINES, PARA PRODUCCIÓN.
//
// En desarrollo, `/api/insignias/medallas` y `/api/insignias/pines` leen su
// carpeta en el momento: una imagen nueva aparece al recargar. En Netlify la
// función no lleva `public/` consigo, así que leen estos manifiestos, que se
// generan solos antes de cada build (`prebuild` en package.json) con las
// carpetas tal como están al desplegar.
//
// Uso a mano: node scripts/generar-manifiesto-medallas.mjs
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

const MANIFIESTOS = [
  { carpeta: 'medallas', destino: 'medallas-manifiesto.json' },
  { carpeta: 'pines', destino: 'pines-manifiesto.json' },
];

MANIFIESTOS.forEach(({ carpeta: nombre, destino: archivo }) => {
  const carpeta = path.join(process.cwd(), 'public', 'parches', 'Cintas y medallas', nombre);
  const destino = path.join(process.cwd(), 'src', 'utils', archivo);

  const archivos = fs.existsSync(carpeta)
    ? fs
        .readdirSync(carpeta, { withFileTypes: true })
        .filter((entrada) => entrada.isFile())
        .map((entrada) => entrada.name)
        .sort()
    : [];

  fs.writeFileSync(destino, `${JSON.stringify({ archivos }, null, 2)}\n`);

  console.log(
    `[${nombre}] manifiesto con ${archivos.length} archivos → ${path.relative(process.cwd(), destino)}`
  );
});
