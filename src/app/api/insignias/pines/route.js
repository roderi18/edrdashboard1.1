import path from 'path';
import { readdir } from 'fs/promises';

import manifiesto from 'src/utils/pines-manifiesto.json';
import { CARPETA_PINES, catalogoDePinesDesdeArchivos } from 'src/utils/pines-perfil.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------
// EL CATÁLOGO DE PINES ES LA CARPETA, como el de medallas
// (`/api/insignias/medallas`): se lee `public/parches/Cintas y medallas/pines`
// en el momento y, donde no se puede —la función de Netlify no lleva `public/`—,
// el manifiesto que `prebuild` escribe antes de cada build. Son nombres de
// imágenes públicas: no hace falta sesión.
// ----------------------------------------------------------------------

const leerCarpeta = async () => {
  try {
    // `turbopackIgnore`: sin él, el trazado de Next no sabía qué carpeta se lee
    // y metía el PROYECTO ENTERO en la función del servidor (103 MB: docs/,
    // outputs/, PDFs de public/…). Al pasar del tope de AWS Lambda, Netlify
    // rechazaba el despliegue ("Invalid AWS Lambda parameters"). En producción
    // esta lectura falla igual —la función no lleva public/— y manda el manifiesto.
    const carpeta = path.join(/* turbopackIgnore: true */ process.cwd(), ...CARPETA_PINES);
    const entradas = await readdir(carpeta, { withFileTypes: true });

    return entradas.filter((entrada) => entrada.isFile()).map((entrada) => entrada.name);
  } catch {
    return null;
  }
};

export async function GET() {
  const archivos = (await leerCarpeta()) ?? manifiesto.archivos ?? [];

  return Response.json(
    { pines: catalogoDePinesDesdeArchivos(archivos) },
    { headers: { 'Cache-Control': 'public, max-age=60' } }
  );
}
