import { normalizeText } from 'src/utils/normalize-text';
import { generateMemberId } from 'src/utils/generate-member-id';

import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';

import { getMembers } from './member-service';
import { guardarAsignacionDirectiva } from './directivas-organizacionales-service';

// ----------------------------------------------------------------------
// El pastor de la iglesia es una PERSONA, no un texto.
//
// Al crear un destacamento se escribe el nombre del pastor en los datos de la
// iglesia. Antes se quedaba ahi, como una cadena suelta: no existia como miembro,
// no tenia id, y la casilla "Pastor" del organigrama del destacamento salia
// vacante aunque el dato estuviera escrito dos campos mas arriba.
//
// Ahora se le da de alta como miembro —con su codigo, como cualquier otro— y se
// le asigna esa casilla. Como del formulario solo se conoce el nombre, el resto
// de la ficha queda por completar, y de eso avisa el organigrama.
// ----------------------------------------------------------------------

// Valores que se ven a simple vista como pendientes de rellenar. Solo se ponen
// donde la aplicacion los necesita; el resto de campos se dejan vacios, que ya
// se lee como "falta".

// En E.164, que es como se guardan los telefonos reales (+18292545465) y lo que
// el campo de telefono espera: con "0000000000" a secas protestaba en consola
// —"Expected the initial value to be a E.164 phone number"— y no lo pintaba. Asi
// se muestra como "(809) 000-0000", que se lee de inmediato como un relleno.
export const TELEFONO_PENDIENTE = '+18090000000';

// Fecha inventada de forma evidente. Ademas de marcar, CUMPLE UNA FUNCION: la
// division se deduce de la edad y, sin fecha, el servidor asigna la primera de la
// lista — Navegantes, la de 5 a 7 años. Un pastor acabaria ahi. Con esta queda en
// Liderazgo, que es lo que corresponde.
export const FECHA_NACIMIENTO_PENDIENTE = '1900-01-01';

const POSICION_PASTOR = DIRECTIVA_POSITIONS.find(
  (position) => position.idCargo === 'destacamento-pastor'
);

// "Juan Carlos Perez Gomez" -> nombres "Juan Carlos", apellidos "Perez Gomez".
// Con dos palabras o menos, la primera es el nombre y el resto el apellido.
export const partirNombrePastor = (nombreCompleto = '') => {
  const palabras = String(nombreCompleto || '').trim().split(/\s+/).filter(Boolean);

  if (!palabras.length) return { nombres: '', apellidos: '' };
  if (palabras.length === 1) return { nombres: palabras[0], apellidos: '' };
  if (palabras.length <= 3) {
    return { nombres: palabras[0], apellidos: palabras.slice(1).join(' ') };
  }

  return {
    nombres: palabras.slice(0, 2).join(' '),
    apellidos: palabras.slice(2).join(' '),
  };
};

const mismoNombre = (miembro, nombres, apellidos) =>
  normalizeText(`${miembro?.firstName ?? ''} ${miembro?.lastName ?? ''}`) ===
  normalizeText(`${nombres} ${apellidos}`);

/**
 * Da de alta al pastor como miembro (o reutiliza el que ya exista en ese
 * destacamento con el mismo nombre) y le asigna la casilla "Pastor" del
 * organigrama.
 *
 * Devuelve el id del miembro, o null si no habia nombre que registrar.
 */
export async function asegurarPastorDelDestacamento({
  nombrePastor,
  idDestacamento,
  nombreDestacamento = '',
  usuario = null,
}) {
  const { nombres, apellidos } = partirNombrePastor(nombrePastor);
  const idDest = Number(idDestacamento) || null;

  if (!nombres || !idDest || !POSICION_PASTOR) return null;

  const miembros = await getMembers().catch(() => []);

  // Se REUTILIZA el que ya este en ese destacamento con el mismo nombre: editar
  // la iglesia no debe crear una persona nueva cada vez.
  const existente = (Array.isArray(miembros) ? miembros : []).find(
    (miembro) =>
      String(miembro?.destId ?? miembro?.idDestacamento ?? '') === String(idDest) &&
      mismoNombre(miembro, nombres, apellidos)
  );

  let idMiembro = existente?.id ?? null;

  if (!idMiembro) {
    const codigoMiembro = await generateMemberId();

    const res = await fetch('/api/members/post/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idMiembros: 0,
        codigoMiembro,
        nombres,
        apellidos,
        genero: null,
        fechaNacimiento: FECHA_NACIMIENTO_PENDIENTE,
        sizeCamisas: null,
        ocupacion: null,
        fechaCreacion: new Date().toISOString(),
        idDestacamento: idDest,
        telefono: TELEFONO_PENDIENTE,
        direccion: '',
        correo: '',
        estatusMiembro: 'active',
      }),
    });

    const texto = await res.text();
    let datos = null;

    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch {
      datos = null;
    }

    if (!res.ok) {
      throw new Error(datos?.message || datos?.Message || 'No se pudo registrar al pastor.');
    }

    idMiembro =
      datos?.idMiembros ?? datos?.data?.idMiembros ?? datos?.Data?.idMiembros ?? null;

    // El alta no siempre devuelve el id: se busca por el codigo recien generado.
    if (!idMiembro) {
      const actualizados = await getMembers().catch(() => []);
      idMiembro =
        (Array.isArray(actualizados) ? actualizados : []).find(
          (miembro) => String(miembro?.memberId ?? miembro?.codigoMiembro) === codigoMiembro
        )?.id ?? null;
    }
  }

  if (!idMiembro) return null;

  await guardarAsignacionDirectiva({
    nivel: 'destacamento',
    idEntidad: idDest,
    nombreEntidad: nombreDestacamento,
    idCargo: Number(POSICION_PASTOR.idCargoApi) || null,
    idMiembro,
    idPosicionDirectiva: POSICION_PASTOR.idCargo,
    division: POSICION_PASTOR.division ?? null,
    orden: POSICION_PASTOR.orden || 1,
    origen: 'form-destacamento-pastor',
    activo: true,
    nombreMiembro: `${nombres} ${apellidos}`.trim(),
    nombresMiembro: nombres,
    apellidosMiembro: apellidos,
    usuario,
  });

  return idMiembro;
}

