import { getAdminDb, isAdminConfigured } from 'src/server/firebase-admin';
import { exigirSesionRest, exigirPermisoDeCargoRest } from 'src/server/sesion-rest.mjs';

// ----------------------------------------------------------------------
// Los padres o tutores de un miembro.
//
// Un documento por miembro, con dos personas y una nota. Nada de fotos: aqui no
// se guarda la cara de nadie, solo a quien llamar.
//
// Se escribe desde el SERVIDOR, no desde el navegador, por lo mismo que el
// resto: las escrituras directas a Firestore estan cerradas fuera de la puerta
// de cambios, y `src/app/api/**` es el lado que decide, no el transporte.
// ----------------------------------------------------------------------

const COLECCION = 'padres_miembros';

const TOPE_NOMBRE = 60;
const TOPE_TELEFONO = 14;
const TOPE_NOTA = 500;

const texto = (valor, tope) =>
  String(valor ?? '')
    .trim()
    .slice(0, tope);

/** Una persona: quien es y como se le llama. Sin foto, a proposito. */
const limpiarPersona = (persona = {}) => ({
  nombres: texto(persona.nombres, TOPE_NOMBRE),
  apellidos: texto(persona.apellidos, TOPE_NOMBRE),
  telefono: texto(persona.telefono, TOPE_TELEFONO),
});

const vacia = (persona = {}) => !persona.nombres && !persona.apellidos && !persona.telefono;

export async function GET(req) {
  try {
    // Leer exige sesion; QUE se puede leer lo decide la pantalla, que ya conoce
    // el alcance del usuario sobre este miembro.
    const noAutorizado = await exigirSesionRest(req);

    if (noAutorizado) return noAutorizado;

    const idMiembro = new URL(req.url).searchParams.get('idMiembro') || '';

    if (!idMiembro) {
      return Response.json({ error: 'Falta el miembro.' }, { status: 400 });
    }

    if (!isAdminConfigured()) {
      return Response.json({ padres: null });
    }

    const documento = await getAdminDb().collection(COLECCION).doc(String(idMiembro)).get();

    return Response.json({ padres: documento.exists ? (documento.data() ?? null) : null });
  } catch (error) {
    console.error('[miembros/padres] no se pudo leer', error);

    return Response.json({ error: 'No se pudo cargar la información.' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const noAutorizado = await exigirPermisoDeCargoRest(req, ['padres.editar']);

    if (noAutorizado) return noAutorizado;

    if (!isAdminConfigured()) {
      return Response.json({ error: 'El servidor no puede guardar ahora mismo.' }, { status: 503 });
    }

    const cuerpo = await req.json();
    const idMiembro = texto(cuerpo?.idMiembro, 40);

    if (!idMiembro) {
      return Response.json({ error: 'Falta el miembro.' }, { status: 400 });
    }

    const padre = limpiarPersona(cuerpo?.padre);
    const madre = limpiarPersona(cuerpo?.madre);
    const nota = texto(cuerpo?.nota, TOPE_NOTA);

    // Ni un padre ni una madre ni nota: no se guarda un documento vacio.
    if (vacia(padre) && vacia(madre) && !nota) {
      return Response.json(
        { error: 'Escribe al menos un nombre o una nota antes de guardar.' },
        { status: 400 }
      );
    }

    const datos = {
      idMiembro: String(idMiembro),
      padre,
      madre,
      nota,
      actualizadoEn: new Date().toISOString(),
    };

    await getAdminDb().collection(COLECCION).doc(String(idMiembro)).set(datos, { merge: true });

    return Response.json({ padres: datos });
  } catch (error) {
    console.error('[miembros/padres] no se pudo guardar', error);

    return Response.json({ error: 'No se pudo guardar la información.' }, { status: 500 });
  }
}
