// ----------------------------------------------------------------------
// LO QUE LEE EL BARRIDO DE CUMPLEAÑOS: el padron, las cuentas y las fotos.
//
// Estaba dentro de la funcion programada de Netlify. Se saco aqui para que la
// prueba a mano del chat de Sistema (`scripts/prueba-chat-sistema-cumpleanos.mjs`)
// lea EXACTAMENTE lo mismo: con dos copias, la prueba podia pasar y la funcion
// fallar. Recibe `db` (Admin SDK) desde fuera; no importa `firebase-admin`.
// ----------------------------------------------------------------------

const COLECCION_ACCESOS = 'usuarios_roles';
const COLECCION_FOTOS = 'fotos';
const MIEMBROS_UPSTREAM = 'https://systexploradores.somee.com/api/Miembros/GetAllMiembros';
const DESTACAMENTOS_UPSTREAM =
  'https://systexploradores.somee.com/api/Destacamentos/GetAllDestacamentos';

const filas = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
};

/**
 * El nombre de cada destacamento por su id. El padron de miembros no lo trae
 * (`idDestacamentoNavigation` llega vacio), y sin el el registro del chat de
 * Sistema decia "Destacamento 231". Si la API falla, sin nombres: el envio sigue.
 */
export const leerNombresDeDestacamentos = async () => {
  try {
    const respuesta = await fetch(DESTACAMENTOS_UPSTREAM, {
      headers: { Accept: 'application/json' },
    });

    if (!respuesta.ok) return {};

    return Object.fromEntries(
      filas(await respuesta.json())
        .map((fila) => [
          String(fila?.idDestacamento ?? '').trim(),
          String(fila?.nombre ?? '').trim(),
        ])
        .filter(([id, nombre]) => id && nombre)
    );
  } catch {
    return {};
  }
};

export const leerMiembros = async () => {
  const respuesta = await fetch(MIEMBROS_UPSTREAM, { headers: { Accept: 'application/json' } });

  if (!respuesta.ok) {
    throw new Error(`El padron no respondio (${respuesta.status}).`);
  }

  return filas(await respuesta.json());
};

/** El id de miembro -> los ids de acceso de sus cuentas. */
export const leerCuentasPorMiembro = async (db) => {
  const snapshot = await db.collection(COLECCION_ACCESOS).get();
  const cuentas = {};

  snapshot.forEach((documento) => {
    const datos = documento.data() ?? {};
    const idMiembros = String(datos.idMiembros ?? '').trim();

    if (!idMiembros) return;

    const idUsuario = String(datos.uid ?? datos.uidUsuario ?? documento.id ?? '').trim();

    if (!idUsuario) return;

    cuentas[idMiembros] = [...new Set([...(cuentas[idMiembros] ?? []), idUsuario])];
  });

  return cuentas;
};

/**
 * La foto de perfil de cada miembro.
 *
 * No viene en el padron de la API: vive en Firebase, en `fotos`, con el tipo de
 * entidad y el estado que la aplicacion usa para elegir la principal. Sin esto
 * el aviso de cumpleaños sale con un icono generico en vez de con su cara.
 */
export const leerFotosDeMiembros = async (db) => {
  const snapshot = await db
    .collection(COLECCION_FOTOS)
    .where('tipoEntidad', '==', 'miembro')
    .get()
    .catch(() => null);

  const fotos = {};

  snapshot?.forEach((documento) => {
    const datos = documento.data() ?? {};

    if (datos.tipoFoto !== 'perfil' || datos.estado !== 'activo') return;

    const idEntidad = String(datos.idEntidad ?? '').trim();

    if (!idEntidad || !datos.urlFoto) return;

    fotos[idEntidad] = {
      grande: String(datos.urlFoto),
      mini: String(datos.urlFotoMiniatura || ''),
    };
  });

  return fotos;
};
