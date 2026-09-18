import path from 'path';
import { readdir } from 'fs/promises';

import manifiesto from 'src/utils/medallas-manifiesto.json';
import { CARPETA_MEDALLAS, catalogoDesdeArchivos } from 'src/utils/medallas-perfil.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------
// EL CATÁLOGO DE MEDALLAS ES LA CARPETA.
//
// Cualquier imagen que se deje en `public/parches/Cintas y medallas/medallas`
// tiene que salir en la aplicación sin tocar código. Aquí se lee la carpeta en
// el momento; donde no se puede —la función de Netlify no lleva `public/`— se
// usa el manifiesto que `scripts/generar-manifiesto-medallas.mjs` escribe antes
// de cada build. Son nombres de imágenes públicas: no hace falta sesión.
// ----------------------------------------------------------------------

const leerCarpeta = async () => {
  try {
    const entradas = await readdir(path.join(process.cwd(), ...CARPETA_MEDALLAS), {
      withFileTypes: true,
    });

    return entradas.filter((entrada) => entrada.isFile()).map((entrada) => entrada.name);
  } catch {
    return null;
  }
};

export async function GET() {
  const archivos = (await leerCarpeta()) ?? manifiesto.archivos ?? [];

  return Response.json(
    { medallas: catalogoDesdeArchivos(archivos) },
    // Un minuto: una medalla nueva aparece enseguida, sin leer la carpeta en
    // cada perfil que se pinta.
    { headers: { 'Cache-Control': 'public, max-age=60' } }
  );
}
