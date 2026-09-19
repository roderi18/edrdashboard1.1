// ----------------------------------------------------------------------
// NOMBRE Y DESCRIPCIÓN DE CADA CINTA, para el aviso al pasar el ratón.
//
// Texto del manual de uniforme. Los nombres van sin "y medalla": en el perfil se
// muestra la cinta, no la medalla. Se quitaron las remisiones "(ver capítulo…)",
// que no llevan a ningún sitio dentro de la aplicación.
// ----------------------------------------------------------------------

const destreza = (color) => ({
  nombre: `Cinta premio de destreza, de liderazgo, de premio bíblico (${color})`,
  descripcion:
    'Los líderes pueden llevar en su uniforme la cinta del color de los premios de destrezas que han enseñado. Los exploradores pueden llevar las cintas del color de los premios de destreza que han ganado. Un número puede ser colocado en la cinta para indicar el número de premios de destreza enseñados o ganados.',
});

const PENDIENTE = 'Descripción pendiente del manual.';

const YA_NO_DISPONIBLES =
  'no están disponibles en la actualidad. Los líderes que lo ganaron previamente lo pueden utilizar en su uniforme en cualquier momento, de acuerdo con los lineamientos del uniforme 2.0.';

export const TEXTOS_CINTAS_PERFIL = Object.freeze({
  1: {
    nombre: 'Cinta al Valor',
    descripcion:
      'Esta cinta se da cuando un muchacho o líder salva una vida poniendo la suya en peligro. La oficina nacional debe aprobar el premio.',
  },
  2: {
    nombre: 'Cinta de Valentía',
    descripcion:
      'Esta cinta se da al muchacho o líder que salve una vida, sin arriesgar la suya. La oficina nacional debe aprobar este premio.',
  },
  3: {
    nombre: 'Cinta de Oro al Logro de Honor',
    descripcion:
      'La Medalla de Oro al Logro de Honor es la medalla más alta ganada en los Exploradores del Rey, reconociendo que un muchacho ha viajado fielmente a través del sistema de avance. También recibirán un parche y una cinta.',
  },
  4: {
    nombre: 'Cinta Senda del Sable',
    descripcion:
      'La Senda del Sable está diseñada para motivar y recompensar a los Exploradores que aprovechan al máximo las oportunidades de desarrollo del liderazgo juvenil disponibles en su destacamento y nación. Una vez completados los requisitos, se otorga un parche especial, una medalla y una cinta. El premio reconoce el liderazgo de servicio y el crecimiento experimentado en este proceso que comienza en Pioneros o Seguidores de la Senda y culmina en Exploradores.',
  },
  5: {
    nombre: 'Histórica cinta de Oro al Logro (MOL)',
    descripcion:
      'Antiguo galardón más alto del ministerio de los Exploradores del Rey. Anterior al 2014, cuando la Medalla de Oro al Logro de Honor fue introducida al programa por cambios en el Currículo de Exploradores del Rey Internacional 2.0.',
  },
  6: {
    nombre: 'Cinta al Premio de Liderazgo Global',
    descripcion:
      'El Premio de Liderazgo Global está limitado a los miembros del Royal Rangers International Council y a sus miembros principales del equipo regional. Los ganadores reciben una medalla, una cinta y un elegante certificado para mostrar con orgullo. Royal Rangers International procesa el Premio de Liderazgo Global.',
  },
  7: {
    nombre: 'Cinta al Mérito Nacional',
    descripcion:
      'Se da a los muchachos y líderes de Exploradores del Rey que han demostrado esfuerzo y compromiso ejemplares a Exploradores del Rey. Es concedida por y a voluntad del Director Nacional de Exploradores del Rey.',
  },
  8: {
    nombre: 'Cinta a la Excelencia',
    descripcion:
      'Se concede a los líderes locales de destacamento que han completado la senda del Adiestramiento para líderes de la Academia Ministerial de los Exploradores del Rey, y que han llevado por lo menos a un muchacho en un viaje que culmina con la obtención de la medalla más alta en cualquiera de los cuatro grupos de Exploradores del Rey.',
  },
  10: {
    nombre: 'Cinta Directiva Ejecutiva Nacional (Nivel 1)',
    descripcion:
      'La Medalla de Liderazgo Ejecutivo Nacional y la cinta son para líderes organizacionales que sirven como miembros del comité ejecutivo de Exploradores del Rey, y han demostrado un servicio excepcional para alcanzar los objetivos del programa de Exploradores del Rey.',
  },
  11: {
    nombre: 'Cinta Directiva Regional (Nivel 2)',
    descripcion:
      'La Medalla de Liderazgo Nacional y la cinta son para líderes organizacionales que sirven a nivel regional u otro personal de apoyo nacional que han demostrado un servicio excepcional para alcanzar los objetivos del programa de Exploradores del Rey (puede postular un líder con una función específica, pero que no pertenece a la Directiva Ejecutiva Nacional).',
  },
  '12a': {
    nombre: 'Cinta de Reconocimiento al Liderazgo Nacional',
    descripcion:
      'La Medalla de Reconocimiento al Liderazgo Nacional y la cinta son para líderes organizacionales que sirven como Directores Nacionales para su Nación, quienes han demostrado un servicio excepcional para alcanzar los objetivos del Ministerio de los Exploradores del Rey. El premio es procesado y otorgado por el Coordinador Regional de RRI.',
  },
  '12b': {
    nombre: 'Cinta de Proyectos Misioneros',
    descripcion:
      'Este premio se concede a los individuos que han participado en cualquier viaje misionero internacional o nacional, aprobado por la denominación, durante un mínimo de cinco días excluyendo viaje.',
  },
  13: {
    nombre: 'Histórica cinta Estrella Dorada para Líderes',
    descripcion:
      'La Cinta de la Estrella Dorada es un premio antiguo que se presentaba por liderazgo y servicio. Este premio no está disponible en la actualidad. Los líderes que lo ganaron previamente lo pueden utilizar en su uniforme en cualquier momento, de acuerdo con los lineamientos del uniforme 2.0.',
  },
  14: {
    nombre: 'Cinta de Servicio Destacado',
    descripcion:
      'El Premio al Servicio Destacado se otorga tanto a jóvenes como a líderes adultos. Se concede a individuos para el reconocimiento de servicio excepcional a los Exploradores del Rey. Es otorgado por la región a discreción del Coordinador Regional de RRI.',
  },
  15: {
    nombre: 'Cinta Directiva Ejecutiva Distrital (Nivel 3)',
    descripcion:
      'El Premio de Liderazgo Ejecutivo Organizacional es para todos los líderes organizacionales que sirven en el equipo ejecutivo distrital de Exploradores del Rey y han demostrado una capacidad excepcional para alcanzar los objetivos del ministerio de los Exploradores del Rey.',
  },
  16: {
    nombre: 'Cinta Directiva Seccional (Nivel 4)',
    descripcion:
      'El Premio de Liderazgo Organizacional es para todos los miembros del personal de apoyo seccional y del área que han demostrado una capacidad excepcional para alcanzar las metas del ministerio de los Exploradores del Rey (puede postular un líder con una función específica, pero que no pertenece a la Directiva Ejecutiva Distrital).',
  },
  17: {
    nombre: 'Histórica cinta del Águila Plateada o Racimo Plateado',
    descripcion: `Los premios del Águila Plateada y el Racimo Plateado son premios antiguos que se presentaban por liderazgo y servicio. Estos premios ${YA_NO_DISPONIBLES}`,
  },
  18: {
    nombre: 'Histórica cinta del Racimo Dorado o Racimo Azul',
    descripcion: `Los premios del Racimo Dorado y el Racimo Azul son premios antiguos que se presentaban por liderazgo y servicio. Estos premios ${YA_NO_DISPONIBLES}`,
  },
  19: {
    nombre: 'Cinta para el Pastor',
    descripcion:
      'Este premio es concedido a los pastores en reconocimiento a su apoyo al destacamento de Exploradores del Rey. El coordinador del destacamento o el Comité del Destacamento puede conferir el premio al pastor.',
  },
  20: {
    nombre: 'Cinta para el Coordinador de Destacamento',
    descripcion:
      'Para los coordinadores de destacamento que han demostrado habilidades sobresalientes al alcanzar los objetivos del programa de los Exploradores del Rey.',
  },
  21: {
    nombre: 'Cinta para el Líder de Grupo',
    descripcion:
      'Este premio es para los líderes de grupo que han demostrado habilidades sobresalientes al alcanzar los objetivos del programa de los Exploradores del Rey.',
  },
  22: {
    nombre: 'Cinta de Servicio del Destacamento',
    descripcion:
      'Este premio de logro es especial para los líderes asistentes de grupo, capellanes y consejo de destacamento que han demostrado una capacidad sobresaliente al lograr los objetivos del ministerio de los Exploradores del Rey.',
  },
  23: {
    nombre: 'Cinta del Curso de Adiestramiento para Líderes (CAL)',
    descripcion:
      'Bajo los requisitos de adiestramiento, antes del 2006, el Curso de Adiestramiento para Líderes era el curso de liderazgo teórico ofrecido a los nuevos líderes de Exploradores del Rey. Este premio no se gana en la actualidad y no cuenta dentro de ningún requisito de adiestramiento 2.0.',
  },
  24: {
    nombre: 'Histórica cinta de Oro al Logro para Líderes',
    descripcion:
      'Bajo los requisitos de adiestramiento para líderes, antes del 2006, la Medalla de Oro al Logro para Líderes era presentada a los líderes que completaban: Orientación para Líderes de la Iglesia (OLI), Adiestramiento para el Consejo de Destacamento (ACD), Fundamentos, Curso de Adiestramiento para Líderes, Campamento para Líderes de Navegantes (CLN), Seguridad, Campamento Nacional de Adiestramiento (CNA), Campamento Nacional de Adiestramiento Avanzado (CNAA), Introducción al Liderazgo Juvenil (ILJ), Campamento de Barras Doradas (CBD), dos o más talleres teóricos y dos o más talleres prácticos de aprendizaje continuo. Este premio no se gana en la actualidad y no cuenta dentro de ningún requisito de adiestramiento 2.0.',
  },
  25: {
    nombre: 'Cinta del Servicio de los Líderes Juveniles',
    descripcion:
      'Este premio es para los líderes juveniles, Guía Mayor, Guía Mayor Auxiliar y Guía de Patrulla que han demostrado una capacidad sobresaliente al lograr los objetivos del ministerio de los Exploradores del Rey. Los solicitantes deben tener por lo menos once años y haber ganado la Medalla de Bronce de los Seguidores de la Senda o el Premio E1 del Grupo de Exploradores. Los criterios adicionales se encuentran en la solicitud del premio, disponible en la página web de Exploradores del Rey.',
  },
  26: {
    nombre: 'Cinta de Servicio Especial',
    descripcion:
      'Cualquier líder, sea a nivel del destacamento o a nivel nacional, puede presentar este premio. Su propósito es rendir honor a los individuos que tengan dieciocho años o más que hayan hecho contribuciones significativas, servicio o apoyo al ministerio de los Exploradores del Rey. El premio puede ser dado a un líder de Exploradores del Rey o a personas fuera de la organización.',
  },
  27: {
    nombre: 'Cinta de Talleres Prácticos de Aprendizaje Continuo',
    descripcion:
      'Este premio se da por completar de 2 a 4 horas de un adiestramiento práctico de aprendizaje continuo en artes en el ministerio, actividades al aire libre, deportes, habilidades profesionales o tecnologías. Esta capacitación es ofrecida predominantemente fuera del ambiente de clase tradicional. Es dada o aprobada por la Oficina Nacional de Exploradores del Rey. Algunos cursos pueden tener requisitos previos para asistir, tales como edad, adiestramientos previos o asignaciones. El reconocimiento es dado al completar satisfactoriamente todos los requisitos. Después de ganar la primera cinta, se colocan números centrados en la cinta mostrando el número de adiestramientos prácticos completados.',
  },
  28: {
    nombre: 'Cinta de Talleres Teóricos de Aprendizaje Continuo',
    descripcion:
      'Este premio se entrega al completar de dos a cuatro horas de taller de aprendizaje continuo, seminario en línea, o módulos en una clase o entorno, o por correspondencia. Es dada o aprobada por la Oficina Nacional de Exploradores del Rey. Algunos cursos pueden tener requisitos previos para asistir, tales como edad, adiestramientos previos o asignaciones. El reconocimiento es dado al completar satisfactoriamente todos los requisitos. Después de ganar la primera cinta, se colocan números centrados en la cinta mostrando el número de adiestramientos completados.',
  },
  29: {
    nombre: 'Cinta al Logro de Exploradores',
    descripcion:
      'Al ganar todos los tres premios de avance al final de cada año, obtienen la cinta al Logro E3, la cual pueden vestir con sus camisas de uniforme aun después que el joven deje Exploradores.',
  },
  30: {
    nombre: 'Cinta al Logro de Seguidores de la Senda',
    descripcion:
      'Al ganar todos los tres premios de avance al final de cada año, obtienen la cinta al Logro de Seguidores de la Senda, la cual pueden vestir con sus camisas de uniforme aun después que el joven deje Seguidores.',
  },
  31: {
    nombre: 'Cinta al Logro de Pioneros',
    descripcion:
      'Al ganar todos los tres premios de avance al final de cada año, obtienen la cinta al Logro de Pioneros, la cual pueden vestir con sus camisas de uniforme aun después que el joven deje Pioneros.',
  },
  32: {
    nombre: 'Cinta al Logro de Navegantes',
    descripcion:
      'Al ganar todos los tres premios de avance al final de cada año, obtienen la cinta al Logro de Navegantes, la cual pueden vestir con sus camisas de uniforme aun después que el joven deje Navegantes.',
  },
  33: destreza('azul'),
  34: destreza('roja'),
  35: destreza('verde'),
  36: destreza('amarilla'),
  37: destreza('plateada'),
  38: destreza('celeste'),
  39: destreza('naranja'),
  40: destreza('marrón'),
  // Llegaron como imagen, sin su texto del manual: el nombre sale de la imagen y
  // la descripción dice que falta, en vez de inventarla.
  a5: {
    nombre: 'Histórica cinta de Oro al Logro (MOL) con estrella',
    descripcion: PENDIENTE,
  },
  z1: { nombre: 'Premio Nacional al Liderazgo Ejecutivo', descripcion: PENDIENTE },
  z2: { nombre: 'Cinta Nacional de Servicio Ejecutivo', descripcion: PENDIENTE },
  z3: { nombre: 'Premio Nacional al Servicio Destacado', descripcion: PENDIENTE },
  z4: { nombre: 'Cinta Ready', descripcion: PENDIENTE },
  z5: { nombre: 'Cinta de Servicio Especial', descripcion: PENDIENTE },
  z6: { nombre: 'Cinta CAL', descripcion: PENDIENTE },
});
