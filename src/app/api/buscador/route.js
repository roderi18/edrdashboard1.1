import { iconoDePremio } from 'src/utils/buscador-catalogo.mjs';

import { getAdminDb, isAdminConfigured } from 'src/server/firebase-admin';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// EL CATALOGO DEL BUSCADOR DE LA CABECERA.
//
// El buscador buscaba SOLO entre las pantallas del menu. Lo que la gente escribe
// ahi son nombres de cosas —"emblema", "1 Cronicas", "cinta"—, no nombres de
// pantallas, y no encontraba nada. Aqui se le da lo que hay que buscar: los
// articulos de la tienda y los 522 premios del sistema de ascenso.
//
// TODO DE UNA VEZ Y GUARDADO, no una consulta por pulsacion: son unos 600
// nombres, pesan poco y filtrar en el navegador es instantaneo. Firestore se lee
// como mucho cada cinco minutos por servidor, no una vez por persona que escribe.
//
// Las caras de los productos vienen DENTRO (`indice_buscador`, miniaturas de
// ~2 kB como texto): pintar un resultado no pide ninguna imagen. Los premios no
// tienen imagen propia en ningun sitio, asi que llevan el icono de su grupo o el
// de su division, que son archivos locales que el navegador ya tiene.
// ----------------------------------------------------------------------

const CACHE_MS = 5 * 60_000;

let guardado = null;

const textoLimpio = (valor) => String(valor ?? '').trim();

const leerCatalogo = async () => {
  const db = getAdminDb();
  const [indice, productos, premios] = await Promise.all([
    db.collection('indice_buscador').doc('productos').get(),
    db.collection('productos').get(),
    db.collection('itemsAscenso').get(),
  ]);

  const fichas = indice.exists ? (indice.data()?.articulos ?? {}) : {};

  return {
    productos: productos.docs
      .map((documento) => {
        const datos = documento.data() ?? {};
        const ficha = fichas[documento.id] ?? {};

        return {
          id: documento.id,
          nombre: textoLimpio(datos.nombre) || textoLimpio(ficha.nombre),
          codigo: textoLimpio(datos.codigo),
          categoria: textoLimpio(datos.categoria),
          // Solo la miniatura del indice. La foto de verdad NO viaja aqui: una
          // sola pesa mas que todo este catalogo junto.
          miniatura: textoLimpio(ficha.miniatura),
          publicado: datos.publicacion !== 'borrador',
        };
      })
      .filter((producto) => producto.nombre),
    premios: premios.docs
      .map((documento) => {
        const datos = documento.data() ?? {};

        return {
          id: documento.id,
          nombre: textoLimpio(datos.nombre),
          grupo: textoLimpio(datos.nombreGrupo),
          division: textoLimpio(datos.nombreDivision),
          icono: iconoDePremio({ idGrupo: datos.idGrupo, idDivision: datos.idDivision }),
        };
      })
      .filter((premio) => premio.nombre),
  };
};

export async function GET() {
  if (!isAdminConfigured()) {
    return Response.json({ productos: [], premios: [] });
  }

  try {
    if (!guardado || guardado.hasta < Date.now()) {
      guardado = { hasta: Date.now() + CACHE_MS, datos: await leerCatalogo() };
    }

    return Response.json(guardado.datos, {
      // Privado: el catalogo de la tienda no se comparte en una cache de por
      // medio, y cada quien lo reutiliza durante cinco minutos.
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch (error) {
    // El buscador de pantallas sigue funcionando sin esto: se responde vacio en
    // vez de romper la cabecera entera.
    console.warn('[buscador] no se pudo leer el catálogo', error?.message ?? error);

    return Response.json({ productos: [], premios: [] }, { status: 200 });
  }
}
