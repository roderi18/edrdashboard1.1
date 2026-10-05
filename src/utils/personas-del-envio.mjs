// ----------------------------------------------------------------------
// LAS PERSONAS DE UN ENVÍO DE LA PÁGINA DE ACTUALIZACIÓN.
//
// Cada envío nombra a dos personas: el Coordinador de Destacamento y quien lo
// envía. La carga no hacía nada con ellas, así que el coordinador que alguien
// escribió como "persona nueva" no existía en la aplicación y su casilla seguía
// con el de antes (o vacía). Ahora la carga da de alta a quien no exista y pone
// al coordinador en su casilla; aquí está la parte que no toca la red: quién es
// cada uno, si son la misma persona y qué se dice en la bandeja.
// ----------------------------------------------------------------------

const texto = (valor) => String(valor ?? '').trim();

const normalizar = (valor) =>
  texto(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const digitos = (valor) => {
  const d = String(valor ?? '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
};

// "Juan Carlos Pérez Gómez" -> nombres "Juan Carlos", apellidos "Pérez Gómez".
// Mismo criterio que el alta del Pastor: con tres palabras o menos, la primera
// es el nombre.
const partirNombre = (completo) => {
  const palabras = texto(completo).split(/\s+/).filter(Boolean);
  if (palabras.length <= 3) {
    return { nombres: palabras[0] || '', apellidos: palabras.slice(1).join(' ') };
  }
  return { nombres: palabras.slice(0, 2).join(' '), apellidos: palabras.slice(2).join(' ') };
};

export const nombreCompleto = (persona = {}) =>
  [texto(persona.nombres), texto(persona.apellidos)].filter(Boolean).join(' ');

/** ¿Es la misma persona? Por id, por teléfono o por nombre completo. */
export const esLaMismaPersona = (a, b) => {
  if (!a || !b) return false;
  if (a.idMiembro && b.idMiembro) return String(a.idMiembro) === String(b.idMiembro);
  if (digitos(a.telefono) && digitos(a.telefono) === digitos(b.telefono)) return true;
  return (
    Boolean(nombreCompleto(a)) && normalizar(nombreCompleto(a)) === normalizar(nombreCompleto(b))
  );
};

const primera = (valor) => normalizar(valor).split(' ')[0] || '';

/**
 * ¿Este miembro del padrón es la persona del envío? Lo de arriba, o el mismo
 * primer nombre y primer apellido: en la página se escribe "Wagner Antonio
 * Betances" y en el padrón está "Wagner Betances". Solo se usa entre los
 * miembros de su destacamento y de "Provisional", donde un choque de nombres es
 * casi imposible; antes se creaba a la persona otra vez.
 */
export const esElMiembroDelEnvio = (persona, miembro) =>
  esLaMismaPersona(persona, miembro) ||
  (Boolean(primera(persona?.nombres)) &&
    Boolean(primera(persona?.apellidos)) &&
    primera(persona.nombres) === primera(miembro?.nombres) &&
    primera(persona.apellidos) === primera(miembro?.apellidos));

/** El destacamento "Provisional" del padrón: donde quedan quienes aún no tienen el suyo. */
export const esDestacamentoProvisional = (destacamento) =>
  normalizar(destacamento?.nombre ?? destacamento?.name) === 'provisional';

/**
 * El coordinador y quien envía, con la misma forma:
 * { idMiembro, nombres, apellidos, telefono }. `null` si el envío no lo trae.
 * `mismaPersona` dice si quien envía ES el coordinador (entonces se crea una vez).
 */
export function personasDelEnvio(fila = {}) {
  const c = fila.datos?.coordinador || {};
  const coordinador = texto(c.nombres)
    ? {
        idMiembro: c.idMiembro ? String(c.idMiembro) : null,
        nombres: texto(c.nombres),
        apellidos: texto(c.apellidos),
        telefono: texto(c.telefono),
      }
    : null;

  const e = fila.enviadoPor || {};
  // `miembro` trae el nombre ya partido como lo escribió; `enviadoPor`, entero.
  const partido = texto(fila.miembro?.nombres)
    ? { nombres: texto(fila.miembro.nombres), apellidos: texto(fila.miembro.apellidos) }
    : partirNombre(e.nombre);
  const enviador = partido.nombres
    ? {
        idMiembro: e.idMiembro ? String(e.idMiembro) : null,
        ...partido,
        telefono: texto(e.telefono),
      }
    : null;

  return { coordinador, enviador, mismaPersona: esLaMismaPersona(coordinador, enviador) };
}

/**
 * Lo que dice la columna Destacamento de la bandeja sobre quién se creó.
 * `creadas` es lo que la carga guardó en el envío: { coordinador, enviador },
 * cada uno con { idMiembro, nombre } o ausente. Si quien envía era el propio
 * coordinador, solo se creó una persona: "Se creó nuevo Coordinador".
 */
export function textoPersonasCreadas(creadas) {
  const coordinador = Boolean(creadas?.coordinador?.idMiembro);
  const enviador = Boolean(creadas?.enviador?.idMiembro);
  const misma =
    coordinador &&
    enviador &&
    String(creadas.coordinador.idMiembro) === String(creadas.enviador.idMiembro);

  if (coordinador && enviador && !misma) return 'Se crearon ambas personas';
  if (coordinador) return 'Se creó nuevo Coordinador';
  if (enviador) return 'Se creó persona que envía';
  return '';
}

/**
 * Qué se cambia en la ficha de alguien que YA existía:
 * - `mover`: estaba en "Provisional" y pasa al destacamento del envío.
 * - `ponerTelefono`: quien envía deja SU teléfono ("Tu teléfono") aunque la
 *   ficha tuviera otro; el del coordinador lo escribió otra persona y solo
 *   llena un hueco.
 */
export function cambiosDeFicha({
  destacamentoFicha,
  telefonoFicha,
  telefonoEnvio,
  esSuyo,
  idProvisional,
}) {
  const mover = Boolean(idProvisional) && String(destacamentoFicha) === String(idProvisional);
  const ponerTelefono =
    Boolean(digitos(telefonoEnvio)) &&
    (esSuyo ? digitos(telefonoEnvio) !== digitos(telefonoFicha) : !digitos(telefonoFicha));
  return { mover, ponerTelefono };
}
