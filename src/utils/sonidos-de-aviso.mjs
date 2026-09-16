// ----------------------------------------------------------------------
// LOS SONIDOS DE AVISO, HECHOS EN EL NAVEGADOR.
//
// Son tonos cortos generados con Web Audio, no archivos: no hay nada que
// descargar —suenan al instante, tambien la primera vez— y no engordan el
// paquete. Cada uno son dos o tres notas de menos de medio segundo.
//
// Aqui vive el CATALOGO y como suena cada uno. Que sonido usa cada aviso lo
// elige el Administrador Global en Administracion -> Sonidos, y se guarda para
// toda la organizacion (ver `src/services/sonidos-service.js`).
// ----------------------------------------------------------------------

export const SIN_SONIDO = 'ninguno';

export const SONIDOS = [
  {
    clave: 'gota',
    nombre: 'Gota',
    descripcion: 'Dos notas que suben. Discreto.',
    onda: 'sine',
    notas: [
      { hz: 880, en: 0, dura: 0.1, volumen: 0.5 },
      { hz: 1320, en: 0.07, dura: 0.16, volumen: 0.4 },
    ],
  },
  {
    clave: 'campanita',
    nombre: 'Campanita',
    descripcion: 'Una nota clara con cola. El clasico de mensaje.',
    onda: 'triangle',
    notas: [{ hz: 1568, en: 0, dura: 0.55, volumen: 0.35 }],
  },
  {
    clave: 'toc',
    nombre: 'Toc',
    descripcion: 'Un golpe seco y grave. Casi no se nota.',
    onda: 'square',
    notas: [{ hz: 320, en: 0, dura: 0.07, volumen: 0.22 }],
  },
  {
    clave: 'brillo',
    nombre: 'Brillo',
    descripcion: 'Tres notas rapidas hacia arriba. Para lo que sale bien.',
    onda: 'sine',
    notas: [
      { hz: 784, en: 0, dura: 0.08, volumen: 0.4 },
      { hz: 1046, en: 0.07, dura: 0.08, volumen: 0.4 },
      { hz: 1568, en: 0.14, dura: 0.2, volumen: 0.35 },
    ],
  },
  {
    clave: 'burbuja',
    nombre: 'Burbuja',
    descripcion: 'Una nota que se dobla hacia arriba. Para lo que se envia.',
    onda: 'sine',
    notas: [{ hz: 520, en: 0, dura: 0.16, volumen: 0.45, hasta: 880 }],
  },
  {
    clave: 'suave',
    nombre: 'Suave',
    descripcion: 'Entra y sale sin filo. Para trabajar con gente al lado.',
    onda: 'sine',
    notas: [{ hz: 660, en: 0, dura: 0.42, volumen: 0.3, ataque: 0.12 }],
  },
  {
    clave: 'doble',
    nombre: 'Doble',
    descripcion: 'Dos toques iguales. Se distingue del resto sin subir el volumen.',
    onda: 'triangle',
    notas: [
      { hz: 1175, en: 0, dura: 0.1, volumen: 0.35 },
      { hz: 1175, en: 0.16, dura: 0.1, volumen: 0.35 },
    ],
  },
];

export const AVISOS = [
  {
    clave: 'mensajeRecibido',
    nombre: 'Mensaje de chat recibido',
    descripcion: 'Cuando alguien te escribe y la pantalla del chat no es la que miras.',
    modulo: 'Chat',
    porDefecto: 'campanita',
  },
  {
    clave: 'campana',
    nombre: 'Notificación de la campana',
    descripcion: 'Avisos del sistema: pedidos, aprobaciones, actividades.',
    modulo: 'Campana de notificaciones',
    porDefecto: 'gota',
  },
  {
    clave: 'mensajeEnviado',
    nombre: 'Mensaje enviado',
    descripcion: 'Confirma que tu mensaje salió. Conviene que sea muy corto.',
    modulo: 'Chat',
    porDefecto: 'burbuja',
  },
  {
    clave: 'archivoSubido',
    nombre: 'Archivo cargado',
    descripcion: 'Cuando termina de subirse una foto o un documento.',
    modulo: 'Subidas de archivos y fotos',
    porDefecto: 'brillo',
  },
];

export const sonidoPorClave = (clave) => SONIDOS.find((sonido) => sonido.clave === clave) ?? null;

export const eleccionPorDefecto = () =>
  Object.fromEntries(AVISOS.map((aviso) => [aviso.clave, aviso.porDefecto]));

// ----------------------------------------------------------------------

let contexto = null;

/**
 * El contexto de audio, uno para toda la pagina y creado al primer clic.
 *
 * Los navegadores no dejan sonar nada hasta que la persona toca algo, asi que
 * crearlo al cargar la pantalla lo dejaba "suspendido" y el primer sonido no se
 * oia. Se crea —y se despierta— cuando de verdad hay que sonar.
 */
const contextoDeAudio = () => {
  if (typeof window === 'undefined') return null;

  const Constructor = window.AudioContext ?? window.webkitAudioContext;

  if (!Constructor) return null;

  if (!contexto) contexto = new Constructor();
  if (contexto.state === 'suspended') contexto.resume();

  return contexto;
};

/**
 * Toca un sonido del catalogo. Devuelve `false` si no se pudo (sin Web Audio, o
 * "ninguno"), para que quien llame pueda decidir si avisa de otra forma.
 */
export function reproducirSonido(clave, { volumenGeneral = 1 } = {}) {
  const sonido = sonidoPorClave(clave);

  if (!sonido) return false;

  const audio = contextoDeAudio();

  if (!audio) return false;

  const inicio = audio.currentTime;

  sonido.notas.forEach((nota) => {
    const oscilador = audio.createOscillator();
    const volumen = audio.createGain();
    const desde = inicio + nota.en;
    const hasta = desde + nota.dura;
    const pico = Math.max(0, Math.min(1, nota.volumen * volumenGeneral));
    // Sin subida y sin bajada, una nota empieza y termina con un chasquido: es
    // el corte de la onda, no el tono. El ataque por defecto es muy corto para
    // que el aviso siga siendo seco.
    const ataque = nota.ataque ?? 0.01;

    oscilador.type = sonido.onda;
    oscilador.frequency.setValueAtTime(nota.hz, desde);

    if (nota.hasta) oscilador.frequency.exponentialRampToValueAtTime(nota.hasta, hasta);

    volumen.gain.setValueAtTime(0.0001, desde);
    volumen.gain.exponentialRampToValueAtTime(pico, desde + ataque);
    volumen.gain.exponentialRampToValueAtTime(0.0001, hasta);

    oscilador.connect(volumen).connect(audio.destination);
    oscilador.start(desde);
    oscilador.stop(hasta + 0.02);
  });

  return true;
}

// ----------------------------------------------------------------------
// LO QUE SUENA EN CADA MODULO.
//
// La eleccion se guarda una vez (la pone el Administrador Global en
// Administracion → Sonidos) y desde aqui la usan el chat, la campana y las
// subidas. Vive en una variable del modulo, no en un contexto de React, porque
// quien la necesita no es una pantalla: es el sitio exacto donde llega un
// mensaje o termina una subida, y ahi no siempre hay un componente a mano.
// ----------------------------------------------------------------------

let eleccionActiva = eleccionPorDefecto();

export const fijarEleccionDeSonidos = (eleccion) => {
  eleccionActiva = { ...eleccionPorDefecto(), ...(eleccion ?? {}) };
};

export const eleccionDeSonidos = () => ({ ...eleccionActiva });

/**
 * Despierta el audio con el primer gesto de la persona.
 *
 * Los navegadores tienen el audio dormido hasta que se toca algo, y despertarlo
 * tarda unas decimas: si eso pasa en el primer Enter, el sonido llega DESPUES
 * del mensaje. Se hace antes, con el primer clic o la primera tecla, para que
 * cuando toque sonar ya este todo listo.
 */
export function prepararAudio() {
  try {
    contextoDeAudio();
  } catch {
    // Sin Web Audio no hay nada que preparar.
  }
}

/**
 * Toca el sonido del aviso que sea. Es lo que llaman los modulos.
 *
 * No falla nunca: si el aviso esta en "Sin sonido", o el navegador no deja sonar
 * todavia —hace falta que la persona haya tocado algo—, no pasa nada.
 */
export function sonarAviso(clave, { retrasoMs = 0, silenciado = false } = {}) {
  const sonido = eleccionActiva[clave];

  if (silenciado || !sonido || sonido === SIN_SONIDO) return false;

  // El retraso es para los avisos que acompañan a algo que se ve: el mensaje
  // aparece en la conversacion y el sonido entra justo detras. Pegado al golpe
  // de la tecla se oye como parte del teclado, no como "salio".
  if (retrasoMs > 0) {
    setTimeout(() => {
      try {
        reproducirSonido(sonido);
      } catch {
        // Un aviso nunca tumba a quien lo dispara.
      }
    }, retrasoMs);

    return true;
  }

  try {
    return reproducirSonido(sonido);
  } catch {
    return false;
  }
}
