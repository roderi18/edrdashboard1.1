import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// DATOS DE EJEMPLO, Y SE DICE EN PANTALLA.
//
// La pantalla Principal se rediseño a partir de una maqueta, y la maqueta enseña
// cosas que todavia no tienen de donde salir: no hay servicio de eventos, ni de
// comunicados, ni de progreso de nivel, ni de historias.
//
// Lo que SI es real y sale de la sesion y de Firestore:
//
//   - Quien eres, tu destacamento y tu region (de la sesion).
//   - El muro entero: publicaciones, me gusta, comentarios (`principal-service`).
//
// Todo lo de este archivo es INVENTADO y cada bloque que lo usa lleva encima una
// marca visible que lo dice. Sin esa marca, un panel con numeros verosimiles se
// lee como el estado real de la organizacion, y alguien acabaria tomando una
// decision con datos que nadie midio.
//
// Al conectar cada panel se borra su bloque de aqui y se quita su marca.
// ----------------------------------------------------------------------

/**
 * Bandera unica de la marca "Ejemplo".
 *
 * APAGADA a peticion expresa: la pantalla se esta enseñando y los sellos
 * distraian. Ojo con lo que implica —los datos de debajo SIGUEN siendo
 * inventados, solo que ahora no lo avisan—: mientras este en `false`, lo que se
 * ve se lee como el estado real de la organizacion. Volver a ponerla en `true`
 * devuelve todos los sellos de golpe.
 */
export const HAY_DATOS_DE_EJEMPLO = false;

export const RESUMEN_DE_EJEMPLO = {
  lema: 'Preparado para servir, aprender y liderar.',
  cifras: [
    { clave: 'actividades', valor: 12, etiqueta: 'Actividades', icono: 'solar:calendar-date-bold' },
    { clave: 'insignias', valor: 8, etiqueta: 'Insignias', icono: 'solar:medal-ribbon-bold' },
    {
      clave: 'asistencias',
      valor: 24,
      etiqueta: 'Asistencias',
      icono: 'solar:users-group-rounded-bold',
    },
  ],
  nivel: { numero: 4, nombre: 'Explorador', porcentaje: 82 },
};

export const ACCESOS_RAPIDOS = [
  {
    clave: 'registrar',
    titulo: 'Registrar actividad',
    icono: 'solar:calendar-date-bold',
    acento: 'azul',
    href: paths.dashboard.calendar,
  },
  {
    clave: 'proxima',
    titulo: 'Próxima actividad',
    icono: 'custom:calendar-agenda-outline',
    acento: 'verde',
    href: paths.dashboard.calendar,
  },
  {
    clave: 'insignias',
    titulo: 'Mis insignias',
    icono: 'solar:medal-star-bold',
    acento: 'ambar',
    href: paths.dashboard.certificates,
  },
  {
    clave: 'capacitacion',
    titulo: 'Capacitación',
    icono: 'solar:notebook-bold-duotone',
    acento: 'morado',
    href: paths.dashboard.fileManager,
  },
];

export const PROXIMA_ACTIVIDAD_DE_EJEMPLO = {
  titulo: 'Campamento Regional 2026',
  lugar: 'San José de los Llanos, Dajabón',
  fechas: '26 — 28 septiembre 2026',
  diasQueFaltan: 13,
  estado: 'Registrado',
};

export const MI_PROGRESO_DE_EJEMPLO = {
  nivel: 'Nivel Explorador 4',
  porcentaje: 82,
  hechas: 24,
  total: 30,
  areas: [
    { nombre: 'Campismo', estado: 'Completado', avance: 100, acento: 'verde' },
    { nombre: 'Orientación', estado: 'Completado', avance: 100, acento: 'ambar' },
    { nombre: 'Primeros auxilios', estado: 'En progreso', avance: 70, acento: 'azul' },
    { nombre: 'Alas de Bronce', estado: 'En progreso', avance: 40, acento: 'morado' },
  ],
};

export const HISTORIAS_DE_EJEMPLO = [
  { clave: 'campamento', titulo: 'Campamento Regional' },
  { clave: 'insignias', titulo: 'Insignias' },
  { clave: 'alas', titulo: 'Alas de Bronce' },
  { clave: 'destacamento', titulo: 'Destacamento 233' },
  { clave: 'eventos', titulo: 'Eventos' },
  { clave: 'formacion', titulo: 'Formación' },
  { clave: 'vida', titulo: 'Vida del ER' },
];

export const EVENTOS_DE_EJEMPLO = [
  {
    clave: 'campamento-regional',
    dia: '26',
    mes: 'SEP',
    titulo: 'Campamento Regional 2026',
    lugar: 'San José de los Llanos, Dajabón',
    estado: 'Registrado',
    color: 'success',
  },
  {
    clave: 'alas-bronce',
    dia: '03',
    mes: 'OCT',
    titulo: 'Alas de Bronce',
    lugar: 'Sede Central, Santo Domingo',
    estado: 'Por confirmar',
    color: 'info',
  },
  {
    clave: 'promocion',
    dia: '17',
    mes: 'OCT',
    titulo: 'Ceremonia de Promoción',
    lugar: 'Templo El Redentor, Santo Domingo',
    estado: 'Pendiente',
    color: 'warning',
  },
];

export const DESTACAMENTO_DESTACADO_DE_EJEMPLO = {
  nombre: 'Destacamento 52 — Halcones del Este',
  region: 'Región Este',
  miembros: 38,
  valoracion: 4.9,
};

export const COMUNICADOS_DE_EJEMPLO = [
  {
    clave: 'competencias',
    origen: 'Dirección Nacional',
    titulo: 'Convocatoria Nacional de Competencias 2026',
    fecha: '13 sep 2026',
  },
  {
    clave: 'lineamientos',
    origen: 'Dirección Nacional',
    titulo: 'Nuevos lineamientos de capacitación',
    fecha: '05 sep 2026',
  },
];
