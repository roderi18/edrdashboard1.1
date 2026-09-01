import { mapaDeParentescos, claveDesdeId } from 'src/server/parentescos-api.mjs';
import {
  exigirSesionRest,
  exigirPermisoDeCargoRest,
  exigirCoordinadorDeDestacamentoRest,
} from 'src/server/sesion-rest.mjs';

// ----------------------------------------------------------------------
// Los tutores de un miembro, contra la API.
//
//   Tutores:  idTutor, nombres, telefono, idParentesco, idMiembro
//
// La pantalla manda la lista ENTERA y aqui se calcula la diferencia con lo que
// hay: lo nuevo se crea, lo cambiado se actualiza y lo que ya no esta se borra.
// Es mas simple de usar que pedirle al navegador que lleve la cuenta, y sobre
// todo no deja huerfanos si algo falla a medias.
//
// El `idParentesco` no se escribe a mano en ningun sitio: lo resuelve
// `mapaDeParentescos`, que lo busca por nombre y crea lo que falte.
// ----------------------------------------------------------------------

const BASE = 'https://systexploradores.somee.com/api/Tutores';

const MAXIMO = 3;
const TOPE_NOMBRE = 100;
const TOPE_TELEFONO = 20;

const texto = (valor, tope) =>
  String(valor ?? '')
    .trim()
    .slice(0, tope);

const filas = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;

  return [];
};

const traerTutores = async (idMiembro) => {
  const respuesta = await fetch(`${BASE}/GetAllTutores?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!respuesta.ok) throw new Error(`No se pudieron leer los tutores (${respuesta.status}).`);

  return filas(await respuesta.json()).filter(
    (fila) => Number(fila?.idMiembro ?? 0) === Number(idMiembro)
  );
};

const enviar = async (ruta, cuerpo, metodo = 'POST') => {
  const respuesta = await fetch(`${BASE}/${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');

    throw new Error(`La API respondió ${respuesta.status} en ${ruta}. ${detalle.slice(0, 200)}`);
  }

  return respuesta.json().catch(() => null);
};

/** Lo mismo que ve la pantalla: nuestras claves, no los ids de la API. */
const aFormulario = (fila, mapa) => ({
  idTutor: Number(fila?.idTutor ?? 0),
  nombres: String(fila?.nombres ?? ''),
  telefono: String(fila?.telefono ?? ''),
  parentesco: claveDesdeId(mapa, fila?.idParentesco),
});

export async function GET(req) {
  try {
    const noAutorizado = await exigirSesionRest(req);

    if (noAutorizado) return noAutorizado;

    const idMiembro = new URL(req.url).searchParams.get('idMiembro') || '';

    if (!idMiembro) return Response.json({ error: 'Falta el miembro.' }, { status: 400 });

    const [tutores, mapa] = await Promise.all([traerTutores(idMiembro), mapaDeParentescos()]);

    return Response.json({ tutores: tutores.map((fila) => aFormulario(fila, mapa)) });
  } catch (error) {
    console.error('[miembros/tutores] no se pudo leer', error);

    return Response.json({ error: 'No se pudieron cargar los tutores.' }, { status: 502 });
  }
}

export async function PUT(req) {
  try {
    // Añadir y corregir: `padres.editar`. Borrar lleva ademas su propio guardia,
    // mas abajo: es el Coordinador de Destacamento y su Asistente.
    const noAutorizado = await exigirPermisoDeCargoRest(req, ['padres.editar']);

    if (noAutorizado) return noAutorizado;

    const cuerpo = await req.json();
    const idMiembro = Number(cuerpo?.idMiembro ?? 0);

    if (!idMiembro) return Response.json({ error: 'Falta el miembro.' }, { status: 400 });

    const entrantes = (Array.isArray(cuerpo?.tutores) ? cuerpo.tutores : [])
      .map((tutor) => ({
        idTutor: Number(tutor?.idTutor ?? 0),
        nombres: texto(tutor?.nombres, TOPE_NOMBRE),
        telefono: texto(tutor?.telefono, TOPE_TELEFONO),
        parentesco: texto(tutor?.parentesco, 40),
      }))
      // Un renglon en blanco no es un tutor: es un renglon en blanco.
      .filter((tutor) => tutor.nombres || tutor.telefono)
      .slice(0, MAXIMO);

    const sinParentesco = entrantes.find((tutor) => !tutor.parentesco);

    if (sinParentesco) {
      return Response.json(
        { error: `Falta la relación con el miembro de ${sinParentesco.nombres || 'un tutor'}.` },
        { status: 400 }
      );
    }

    const [actuales, mapa] = await Promise.all([traerTutores(idMiembro), mapaDeParentescos()]);
    const idsEntrantes = new Set(entrantes.map((tutor) => tutor.idTutor).filter(Boolean));
    const aBorrar = actuales.filter((fila) => !idsEntrantes.has(Number(fila?.idTutor ?? 0)));

    // BORRAR ES DEL COORDINADOR Y SU ASISTENTE.
    //
    // Se comprueba AQUI y no solo en la pantalla: esconder la papelera evita el
    // error, no el intento. Un telefono que desaparece no deja rastro de que
    // existio, y el dia que haya que llamar no habra a quien.
    if (aBorrar.length) {
      const noPuedeBorrar = await exigirCoordinadorDeDestacamentoRest(req);

      if (noPuedeBorrar) return noPuedeBorrar;
    }

    for (const tutor of entrantes) {
      const carga = {
        idTutor: tutor.idTutor || 0,
        nombres: tutor.nombres,
        telefono: tutor.telefono,
        idParentesco: mapa.get(tutor.parentesco) ?? 0,
        idMiembro,
      };

      // eslint-disable-next-line no-await-in-loop
      await enviar(tutor.idTutor ? 'UpdateTutores' : 'SetTutores', carga);
    }

    for (const fila of aBorrar) {
      // eslint-disable-next-line no-await-in-loop
      await enviar(`DeleteTutores?id=${Number(fila.idTutor)}`, null, 'DELETE');
    }

    const guardados = await traerTutores(idMiembro);

    return Response.json({ tutores: guardados.map((fila) => aFormulario(fila, mapa)) });
  } catch (error) {
    console.error('[miembros/tutores] no se pudo guardar', error);

    return Response.json(
      { error: error?.message || 'No se pudieron guardar los tutores.' },
      { status: 502 }
    );
  }
}
