import { COLECCIONES } from '../config/esquema-firestore.mjs';

// ----------------------------------------------------------------------
// SALUD DEL SISTEMA EN SEGUNDO PLANO.
//
// La revisión vivía solo en la pantalla `/dashboard/admin/health`: se calculaba
// en el navegador al abrirla y era ahí donde se creaban las alertas. Sin nadie
// mirando no se revisaba nada, y un fallo (la API caída, Storage lleno) no
// avisaba hasta que alguien entraba al módulo.
//
// Ahora la revisa el servidor (`src/server/salud-sistema/`):
//  - Cada hora, en silencio: solo avisa si algo falla.
//  - Cada día a las 4:00 p. m. (Santo Domingo): además, un resumen corto en el
//    chat "ADMINISTRADORES GLOBALES", escrito por Sistema.
// Un fallo (crítico) va a la campana de cada Administrador Global y al chat del
// grupo; un aviso (advertencia) solo a la campana y al resumen del día. Cada
// chequeo avisa UNA vez por día: la revisión de cada hora no repite.
//
// Aquí está lo que no depende de Firebase: estados, umbrales y textos.
// Sin dependencias, para probarlo con `node --test`.
// ----------------------------------------------------------------------

export const ESTADOS_SALUD = Object.freeze({
  correcto: 'correcto',
  advertencia: 'advertencia',
  critico: 'critico',
});

// Los mismos umbrales que usaba la pantalla de Salud.
export const UMBRALES_SALUD = Object.freeze({
  storageAdvertencia: 75,
  storageCritico: 90,
  respaldoAdvertenciaDias: 7,
  respaldoCriticoDias: 30,
  notificacionesAdvertencia: 50,
  notificacionesCritico: 150,
  // Una respuesta más lenta que esto se avisa (la API .NET va de 0,3 s a 17 s).
  apiLentaMs: 5000,
  apiTiempoMaximoMs: 20000,
  firebaseLentoMs: 3000,
});

// El límite del plan de Storage, el mismo de la pantalla Archivos.
export const LIMITE_STORAGE_BYTES = 5 * 1024 ** 3;

export const ID_GRUPO_ADMINISTRADORES = 'grupo_administradores_globales';
export const NOMBRE_GRUPO_ADMINISTRADORES = 'ADMINISTRADORES GLOBALES';

// Constancia de cada revisión del servidor: `salud_sistema/ultima` (la última,
// la que lee la pantalla) y `salud_sistema_revisiones/<fecha-hora>` (historia).
export const COLECCION_SALUD = COLECCIONES.saludSistema;
export const COLECCION_REVISIONES_SALUD = COLECCIONES.revisionesSaludSistema;

const ZONA = 'America/Santo_Domingo';

/** "2026-10-02" en hora de Santo Domingo: la clave del día para no repetir avisos. */
export const fechaClaveSalud = (fecha = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);

/** "viernes 2 de octubre". */
export const fechaLegibleSalud = (fecha = new Date()) =>
  new Intl.DateTimeFormat('es-DO', {
    timeZone: ZONA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fecha);

/** "4:00 p. m.". */
export const horaLegibleSalud = (fecha = new Date()) =>
  new Intl.DateTimeFormat('es-DO', {
    timeZone: ZONA,
    hour: 'numeric',
    minute: '2-digit',
  }).format(fecha);

/** El estado de un número contra dos umbrales (mayor es peor). */
export const estadoPorUmbral = (valor, advertencia, critico) =>
  valor >= critico
    ? ESTADOS_SALUD.critico
    : valor >= advertencia
      ? ESTADOS_SALUD.advertencia
      : ESTADOS_SALUD.correcto;

/** El estado general: el peor de los chequeos. */
export const estadoGeneralSalud = (chequeos = []) => {
  const criticos = chequeos.filter((c) => c.status === ESTADOS_SALUD.critico).length;
  const advertencias = chequeos.filter((c) => c.status === ESTADOS_SALUD.advertencia).length;

  return {
    status: criticos
      ? ESTADOS_SALUD.critico
      : advertencias
        ? ESTADOS_SALUD.advertencia
        : ESTADOS_SALUD.correcto,
    criticos,
    advertencias,
    total: chequeos.length,
  };
};

const ICONO = { correcto: '✅', advertencia: '⚠️', critico: '🔴' };
const NOMBRE_ESTADO = { correcto: 'Correcto', advertencia: 'Advertencia', critico: 'Crítico' };

const lineaDeChequeo = (chequeo) =>
  `${ICONO[chequeo.status] || '•'} ${chequeo.name}: ${chequeo.resumen || chequeo.detail}`;

/**
 * El resumen diario del chat. Corto: lo que falla o avisa, con su detalle; lo
 * que va bien, agrupado por área en una sola línea cada una.
 */
export const textoResumenDiarioSalud = ({ chequeos = [], fecha = new Date() } = {}) => {
  const general = estadoGeneralSalud(chequeos);
  // Primero lo que falla, luego lo que avisa.
  const problemas = [
    ...chequeos.filter((c) => c.status === ESTADOS_SALUD.critico),
    ...chequeos.filter((c) => c.status === ESTADOS_SALUD.advertencia),
  ];
  const bien = chequeos.filter((c) => c.status === ESTADOS_SALUD.correcto);
  const conteo = [
    general.criticos && `${general.criticos} ${general.criticos === 1 ? 'fallo' : 'fallos'}`,
    general.advertencias &&
      `${general.advertencias} ${general.advertencias === 1 ? 'aviso' : 'avisos'}`,
  ]
    .filter(Boolean)
    .join(', ');
  const lineas = [
    `🩺 Salud del sistema · ${fechaLegibleSalud(fecha)}`,
    `Estado general: ${ICONO[general.status]} ${NOMBRE_ESTADO[general.status]}${conteo ? ` (${conteo})` : ''}`,
    '',
    ...problemas.map(lineaDeChequeo),
    // Lo que va bien, una línea cada uno. La API .NET y los módulos ya llegan
    // agrupados cuando todo va bien ("7 de 7 servicios responden").
    ...bien.map(lineaDeChequeo),
  ];

  lineas.push('', `Revisado a las ${horaLegibleSalud(fecha)} · Detalle en Administración → Salud`);

  return lineas.join('\n');
};

/** El mensaje del chat cuando algo falla fuera del resumen. */
export const textoAvisoDeFallasSalud = ({ fallas = [], fecha = new Date(), origen = '' } = {}) =>
  [
    `🔴 Fallo en el sistema · ${fechaLegibleSalud(fecha)}, ${horaLegibleSalud(fecha)}`,
    '',
    ...fallas.map(lineaDeChequeo),
    '',
    `${origen === 'pantalla' ? 'Detectado al abrir Salud del sistema' : 'Detectado por la revisión automática'} · Detalle en Administración → Salud`,
  ].join('\n');

/** El id de la alerta de un chequeo en un día: el mismo que usaba la pantalla, así no se duplica. */
export const idAvisoDeChequeoSalud = (idChequeo, fechaClave) =>
  `salud_sistema_alerta_${String(idChequeo || 'chequeo').replace(/[/.#[\]]/g, '_')}_${fechaClave}`;

/** Qué se avisa y por dónde: los críticos a la campana y al chat; las advertencias solo a la campana. */
export const avisosDeSalud = (chequeos = []) => ({
  campana: chequeos.filter((c) => c.status !== ESTADOS_SALUD.correcto),
  chat: chequeos.filter((c) => c.status === ESTADOS_SALUD.critico),
});

/** Saneado de lo que manda la pantalla: solo lo que hace falta y con tope. */
export const sanearChequeoSalud = (chequeo = {}) => {
  const texto = (valor, max) =>
    String(valor ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  const status = Object.values(ESTADOS_SALUD).includes(chequeo.status)
    ? chequeo.status
    : ESTADOS_SALUD.correcto;

  return {
    id: texto(chequeo.id, 80) || 'chequeo',
    area: texto(chequeo.area, 60),
    name: texto(chequeo.name, 120) || 'Chequeo',
    status,
    value: texto(chequeo.value, 60),
    detail: texto(chequeo.detail, 300),
  };
};
