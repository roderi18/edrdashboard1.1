import { cuandoCumple, fraseDeCumpleanos } from '../utils/chat-sistema.mjs';
import { idDelMiembro, nombreDelMiembro, destacamentoDelMiembro } from './cumpleanos-core.mjs';

export { cuandoCumple };

// ----------------------------------------------------------------------
// LOS CUMPLEAÑOS EN EL CHAT DE SISTEMA.
//
// Una semana antes, el dia antes y el mismo dia, cada persona del destacamento
// —el Pastor incluido— recibe en su chat con Sistema UN SOLO mensaje con la lista
// de quien cumple: foto, nombre y cuando. Uno solo aunque cumplan tres: con un
// mensaje por cumpleañero, un destacamento grande llenaba el chat.
//
// Al cumpleañero no se le anuncia su propio cumpleaños: el mismo dia recibe su
// felicitacion. Si ademas cumple alguien mas, recibe la lista sin el.
//
// Llega a todos, aunque hayan apagado los cumpleaños en la campana: el chat de
// Sistema no tiene preferencias, es el canal del destacamento.
//
// Puro y sin Firebase: lo usan la funcion programada y la prueba a mano, y se
// prueba con `node --test`. La escritura esta en `chat-sistema-envio.mjs`.
// ----------------------------------------------------------------------

export const TIPO_ENVIO_CUMPLEANOS = 'cumpleanos';

const texto = (valor) => String(valor ?? '').trim();

/**
 * La fecha del dia en Santo Domingo, 'YYYY-MM-DD'. `toISOString` da la de UTC:
 * a partir de las 8 de la noche de aqui ya es mañana en UTC, y una prueba lanzada
 * a esa hora apuntaba el envio al dia siguiente.
 */
export const fechaClaveLocal = (fecha = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);

const nombreDelDestacamento = (miembro = {}) =>
  texto(miembro?.idDestacamentoNavigation?.nombre ?? miembro?.nombreDestacamento);

const primerNombre = (miembro = {}) =>
  texto(miembro?.nombres ?? miembro?.firstName).split(/\s+/)[0] || nombreDelMiembro(miembro);

const persona = ({ miembro, dias }, fotos = {}) => {
  const idMiembros = Number(idDelMiembro(miembro));
  const foto = fotos[String(idMiembros)];

  return {
    idMiembros,
    nombre: nombreDelMiembro(miembro),
    dias,
    // La GRANDE: el mensaje la enseña a todo lo ancho, y la miniatura (hecha para
    // un circulo de 40px) se veia borrosa. La mini solo si no hay otra.
    ...(foto?.grande || foto?.mini ? { fotoUrl: foto.grande || foto.mini } : {}),
  };
};

// Primero quien cumple antes; a igual dia, por nombre.
const porCercania = (a, b) => a.dias - b.dias || a.nombre.localeCompare(b.nombre, 'es');

/**
 * El texto de la lista, una frase por persona. La tarjeta lo pinta con la foto de
 * cada uno; el texto queda para la vista previa de la lista de chats.
 */
export const textoDeLaLista = (personas = []) =>
  personas.map((item) => fraseDeCumpleanos(item.nombre, item.dias)).join('\n');

export const textoDeLaFelicitacion = ({ miembro, nombreDestacamento = '' }) =>
  `🎉 ¡Feliz cumpleaños, ${primerNombre(miembro)}! Todo ${
    nombreDestacamento ? `el destacamento ${nombreDestacamento}` : 'tu destacamento'
  } te desea un día muy especial.`;

/**
 * Quien recibe el chat: las personas del destacamento CON CUENTA. Sin cuenta no
 * hay chat que leer, y la conversacion se quedaria huerfana.
 */
const receptoresDelDestacamento = ({ idDestacamento, miembros = [], cuentasPorMiembro = {} }) => {
  const vistos = new Set();

  return (Array.isArray(miembros) ? miembros : []).filter((miembro) => {
    const id = idDelMiembro(miembro);

    if (!id || vistos.has(id)) return false;
    if (destacamentoDelMiembro(miembro) !== texto(idDestacamento)) return false;
    if (!(cuentasPorMiembro[id] ?? []).length) return false;

    vistos.add(id);
    return true;
  });
};

const participanteDe = (miembro = {}, fotos = {}) => ({
  idMiembros: Number(idDelMiembro(miembro)),
  codigoMiembro: texto(miembro?.codigoMiembro ?? miembro?.memberId),
  nombres: texto(miembro?.nombres ?? miembro?.firstName),
  apellidos: texto(miembro?.apellidos ?? miembro?.lastName),
  correo: '',
  telefono: '',
  estatusMiembro: texto(miembro?.estatusMiembro),
  avatarUrl: fotos[idDelMiembro(miembro)]?.mini || fotos[idDelMiembro(miembro)]?.grande || '',
});

/**
 * Los envios del dia, uno por destacamento.
 *
 * `cumpleaneros`: lo que devuelve `cumpleanosDelDia` con `DIAS_DE_AVISO_CHAT`.
 * Cada envio lleva sus `mensajes`, uno por receptor (y la felicitacion aparte).
 * Los ids de mensaje llevan la fecha: si la tarea corre dos veces el mismo dia,
 * la segunda encuentra el mensaje y no lo repite.
 */
export const repartoDelChatDeCumpleanos = ({
  cumpleaneros = [],
  miembros = [],
  cuentasPorMiembro = {},
  fotos = {},
  nombresDeDestacamentos = {},
  fechaClave,
}) => {
  const porDestacamento = new Map();

  cumpleaneros.forEach((cumpleanero) => {
    const idDestacamento = destacamentoDelMiembro(cumpleanero.miembro);

    if (!idDestacamento || !idDelMiembro(cumpleanero.miembro)) return;

    porDestacamento.set(idDestacamento, [
      ...(porDestacamento.get(idDestacamento) ?? []),
      cumpleanero,
    ]);
  });

  return [...porDestacamento].map(([idDestacamento, delDestacamento]) => {
    const personas = delDestacamento.map((item) => persona(item, fotos)).sort(porCercania);
    const nombreDestacamento =
      texto(nombresDeDestacamentos[idDestacamento]) ||
      nombreDelDestacamento(delDestacamento[0].miembro);
    const receptores = receptoresDelDestacamento({ idDestacamento, miembros, cuentasPorMiembro });

    const mensajes = receptores.flatMap((receptor) => {
      const idReceptor = Number(idDelMiembro(receptor));
      const participante = participanteDe(receptor, fotos);
      const paraEl = personas.filter((item) => item.idMiembros !== idReceptor);
      const suyo = personas.find((item) => item.idMiembros === idReceptor);
      const salida = [];

      if (paraEl.length) {
        salida.push({
          idMiembros: idReceptor,
          nombre: nombreDelMiembro(receptor),
          participante,
          idMensaje: `sistema_cumpleanos_${fechaClave}`,
          texto: textoDeLaLista(paraEl),
          metadatos: { cumpleanosSistema: { personas: paraEl } },
        });
      }

      if (suyo?.dias === 0) {
        salida.push({
          idMiembros: idReceptor,
          nombre: nombreDelMiembro(receptor),
          participante,
          idMensaje: `sistema_felicitacion_${fechaClave}`,
          texto: textoDeLaFelicitacion({ miembro: receptor, nombreDestacamento }),
          metadatos: { cumpleanosSistema: { personas: [suyo], felicitacion: true } },
        });
      }

      return salida;
    });

    return { idDestacamento, nombreDestacamento, personas, mensajes };
  });
};

/** "Cumpleaños: Randy Samuel Cruz Martinez (hoy), Ana Gil (en 7 días)". */
export const motivoDelEnvio = (personas = []) =>
  `Cumpleaños: ${personas
    .map((item) => `${item.nombre} (${cuandoCumple(item.dias).toLowerCase()})`)
    .join(', ')}`;

/**
 * La entrada del registro que ve el Administrador Global: dia y hora, cuantos
 * mensajes, a que destacamento, a quienes y por que. Solo lo que de verdad salio:
 * los que ya tenian el mensaje (una segunda pasada del dia) no cuentan.
 */
export const registroDelEnvio = ({
  envio,
  enviados = [],
  fecha = new Date(),
  fechaClave,
  origen = 'programado',
}) => {
  const destinatarios = envio.mensajes
    .filter((mensaje) => enviados.includes(`${mensaje.idMiembros}:${mensaje.idMensaje}`))
    .map((mensaje) => ({
      idMiembros: mensaje.idMiembros,
      nombre: mensaje.nombre,
      felicitacion: mensaje.idMensaje.startsWith('sistema_felicitacion_'),
    }));

  return {
    id: `${fechaClave}_${TIPO_ENVIO_CUMPLEANOS}_${envio.idDestacamento}${
      origen === 'programado' ? '' : `_${origen}_${fecha.getTime()}`
    }`,
    tipo: TIPO_ENVIO_CUMPLEANOS,
    motivo: motivoDelEnvio(envio.personas),
    origen,
    fecha: fecha.toISOString(),
    fechaClave,
    idDestacamento: envio.idDestacamento,
    nombreDestacamento: envio.nombreDestacamento,
    cantidadMensajes: destinatarios.length,
    destinatarios,
    cumpleaneros: envio.personas.map(({ idMiembros, nombre, dias }) => ({
      idMiembros,
      nombre,
      dias,
    })),
  };
};
