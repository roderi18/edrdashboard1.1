// ----------------------------------------------------------------------
// EL DISEÑO LIBRE DEL ENCABEZADO: modelo, saneado y estilos.
//
// Aqui no hay React. Es la parte que decide QUE se puede guardar y COMO se
// pinta, y se prueba con `node --test` sin montar un navegador.
//
// TODO LO QUE ENTRA SE SANEA. Un diseño no es una preferencia inofensiva: lo
// escribe el Administrador Global y lo LEE todo el que entra a la tienda, asi
// que un campo sin acotar seria una via para meter estilos —o algo peor— en la
// pantalla de los demas. Por eso:
//
//   - Los textos son TEXTO PLANO y con tope de largo. Nada de HTML.
//   - Los colores solo pasan si son `#rrggbb` o `#rrggbbaa`. Un color es un
//     valor de CSS: aceptar cadenas libres es aceptar `url(...)` y compania.
//   - Los numeros se recortan a un rango util, no solo a "es un numero": un
//     tamaño de letra de 4000 tapa la pantalla entera igual que un ataque.
//   - Lo que no se reconoce NO se guarda a medias: cae al valor por defecto.
//
// Y las posiciones van en PORCENTAJE, no en pixeles: el mismo diseño tiene que
// sostenerse en un telefono y en un monitor ancho.
// ----------------------------------------------------------------------

export const ALINEACIONES = ['left', 'center', 'right'];

// Que se puede poner encima del encabezado. La imagen existe porque el escudo
// TAMBIEN se coloca —era lo unico que no se podia mover ni cambiar—, y la linea
// y las formas porque un rotulo se arma separando y enmarcando, no solo
// escribiendo.
export const TIPOS_DE_ELEMENTO = ['texto', 'imagen', 'linea', 'forma', 'cuenta'];

export const FORMAS = ['rectangulo', 'circulo'];

// La CAPA de un elemento: quien tapa a quien. Se guarda un numero pequeño y no
// el orden del array porque duplicar o borrar reordena el array, y entonces lo
// que estaba delante pasaba detras sin que nadie lo tocara.
export const CAPAS = { min: 0, max: 99 };

// COMO SE ESCRIBE LA CUENTA. No es lo mismo una oferta de dos horas que una
// campaña de tres semanas: la primera pide un reloj y la segunda, palabras.
export const FORMATOS_DE_CUENTA = [
  { id: 'compacto', etiqueta: '1d 02:30:05' },
  { id: 'reloj', etiqueta: '26:30:05' },
  { id: 'palabras', etiqueta: '1 día, 2 h, 30 min' },
];

export const IDS_DE_FORMATO_CUENTA = FORMATOS_DE_CUENTA.map((formato) => formato.id);

// LOS CINCO EFECTOS, con nombre propio.
//
// Antes habia dos interruptores sueltos —parpadeo y multicolor— que se podian
// encender a la vez y daban resultados que nadie eligio. Un efecto es UNO: se
// elige viendolo, y lo que se guarda es su nombre, no la mezcla de banderas con
// la que se pintaba.
export const EFECTOS = [
  { id: 'ninguno', etiqueta: 'Sin efecto' },
  { id: 'parpadeo', etiqueta: 'Parpadeo clásico' },
  { id: 'pulso', etiqueta: 'Pulso suave' },
  { id: 'colores-derecha', etiqueta: 'Colores hacia la derecha' },
  { id: 'colores-izquierda', etiqueta: 'Colores hacia la izquierda' },
  { id: 'colores-vertical', etiqueta: 'Colores en vertical' },
  { id: 'neon', etiqueta: 'Resplandor neón' },
];

export const IDS_DE_EFECTO = EFECTOS.map((efecto) => efecto.id);

// Los que pintan el texto con dos colores en movimiento. Se agrupan porque
// comparten el degradado recortado a las letras; lo unico que cambia es hacia
// donde corre.
export const EFECTOS_DE_COLOR = ['colores-derecha', 'colores-izquierda', 'colores-vertical'];

export const esEfectoDeColor = (efecto) => EFECTOS_DE_COLOR.includes(String(efecto || ''));

export const LOGO_POR_DEFECTO = '/logo/exploradores-del-rey-logo.png';

export const FONDOS = ['plano', 'degradado', 'sombra'];

// El lienzo con el que se diseña. Los tamaños de letra se guardan pensando en
// este ancho y se reescalan al de cada pantalla; asi el diseño se ve igual de
// proporcionado en un movil que en un monitor.
export const ANCHO_DE_REFERENCIA = 1200;

export const LIMITES = {
  texto: 240,
  elementos: 24,
  tamano: { min: 10, max: 96 },
  alto: { min: 1, max: 100 },
  grosor: { min: 1, max: 24 },
  radio: { min: 0, max: 50 },
  velocidad: { min: 0.3, max: 4 },
  capa: CAPAS,
  ancho: { min: 5, max: 100 },
  altura: { min: 120, max: 480 },
  posicion: { min: 0, max: 100 },
  opacidad: { min: 0, max: 1 },
  angulo: { min: 0, max: 360 },
};

// La paleta que se ofrece. Son colores fijos y no tokens del tema a proposito:
// el diseño se guarda una vez y lo ve gente con el modo claro y con el oscuro,
// asi que el color elegido tiene que significar lo mismo en los dos.
export const PALETA = [
  '#FFFFFF',
  '#F4F6F8',
  '#919EAB',
  '#212B36',
  '#000000',
  '#00A76F',
  '#007867',
  '#004B50',
  '#00B8D9',
  '#006C9C',
  '#8E33FF',
  '#5119B7',
  '#FFAB00',
  '#B76E00',
  '#FF5630',
  '#B71D18',
];

// SIN COLOR es un color transparente, no la ausencia de dato. Guardar `''` o
// `null` obligaria a preguntar "¿hay color?" en cada sitio que lo pinta; un
// negro con alfa cero se dibuja igual que nada y pasa por el mismo filtro que
// los demas.
export const SIN_COLOR = '#00000000';

export const esSinColor = (valor) => String(valor ?? '').toUpperCase() === SIN_COLOR;

const COLOR_VALIDO = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

// Una direccion de imagen solo puede ser del propio sitio (`/logo/...`) o de
// `https`. Ni `javascript:`, ni `data:` —que se puede usar para colar un SVG con
// script—, ni `http` a secas, que rompe la pagina segura.
const URL_IMAGEN_VALIDA = /^(?:\/[\w\-./%]*|https:\/\/[\w\-.]+(?::\d+)?\/[\w\-./%?&=+~:@]*)$/i;

const acotar = (valor, { min, max }, porDefecto) => {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return porDefecto;

  return Math.min(max, Math.max(min, numero));
};

/** Un color solo pasa si es hexadecimal. Cualquier otra cosa cae al de repuesto. */
export const sanearColor = (valor, porDefecto = '#FFFFFF') => {
  const texto = String(valor ?? '').trim();

  return COLOR_VALIDO.test(texto) ? texto.toUpperCase() : porDefecto;
};

/**
 * Un instante, guardado en ISO y en UTC.
 *
 * Se guarda el instante y NO "el 24 a las 8": la tienda la miran desde varios
 * husos y una promocion que empieza el viernes tiene que empezar a la vez para
 * todos. Lo que no se entiende como fecha se descarta entero: media fecha es
 * peor que ninguna, porque una promocion podria quedarse encendida para siempre.
 */
export const sanearFecha = (valor) => {
  const texto = String(valor ?? '').trim();

  if (!texto) return '';

  const fecha = new Date(texto);

  return Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString();
};

/** Una imagen solo pasa si es del propio sitio o `https`. */
export const sanearUrlImagen = (valor, porDefecto = '') => {
  const texto = String(valor ?? '').trim();

  return URL_IMAGEN_VALIDA.test(texto) ? texto : porDefecto;
};

/** Texto plano, sin saltos de linea y con tope de largo. */
export const sanearTexto = (valor, porDefecto = '') => {
  const texto = String(valor ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();

  // EL TOPE SE CUENTA EN CARACTERES DE VERDAD, no en unidades del motor. Un
  // emoji ocupa dos —y una bandera o una familia, hasta once—, asi que cortar
  // con `slice` partia el emoji por la mitad y dejaba un simbolo roto al final.
  // `Array.from` recorre por caracter completo.
  return Array.from(texto || porDefecto)
    .slice(0, LIMITES.texto)
    .join('');
};

const enLista = (valor, lista, porDefecto) =>
  lista.includes(String(valor ?? '')) ? String(valor) : porDefecto;

let contador = 0;

/** Identificador propio: no se usa el indice, que cambia al reordenar. */
export const nuevoIdDeElemento = () => {
  contador += 1;

  return `txt-${Date.now().toString(36)}-${contador.toString(36)}`;
};

const sanearId = (valor) => {
  const texto = String(valor ?? '').trim();

  return /^[a-zA-Z0-9_-]{1,64}$/.test(texto) ? texto : nuevoIdDeElemento();
};

export const ELEMENTO_POR_DEFECTO = {
  tipo: 'texto',
  capa: 10,
  bloqueado: false,
  enlace: '',
  comoBoton: false,
  desde: '',
  hasta: '',
  formatoCuenta: 'compacto',
  prefijoCuenta: '',
  texto: 'Texto nuevo',
  url: '',
  x: 8,
  y: 40,
  ancho: 40,
  alto: 10,
  tamano: 24,
  color: '#FFFFFF',
  colorSecundario: '#FFAB00',
  alineacion: 'left',
  forma: 'rectangulo',
  grosor: 2,
  radio: 0,
  negrita: false,
  cursiva: false,
  subrayado: false,
  efecto: 'ninguno',
  velocidad: 1.1,
};

export const FONDO_POR_DEFECTO = {
  tipo: 'degradado',
  color: '#004B50',
  colorSecundario: '#007867',
  angulo: 135,
  opacidad: 1,
};

export const DISENO_POR_DEFECTO = {
  activo: false,
  altura: 200,
  fondo: FONDO_POR_DEFECTO,
  elementos: [],
};

/**
 * El efecto de un elemento, con los diseños viejos incluidos.
 *
 * Lo guardado antes de que existieran los cinco efectos usaba dos banderas. No
 * se descarta: `parpadeo` era el clasico y `multicolor` el de colores hacia la
 * derecha, asi que un encabezado guardado hace meses sigue viendose igual.
 */
const efectoDe = (elemento = {}) => {
  if (elemento.efecto !== undefined) return enLista(elemento.efecto, IDS_DE_EFECTO, 'ninguno');
  if (elemento.multicolor) return 'colores-derecha';
  if (elemento.parpadeo) return 'parpadeo';

  return 'ninguno';
};

export const sanearElemento = (elemento = {}) => ({
  id: sanearId(elemento.id),
  tipo: enLista(elemento.tipo, TIPOS_DE_ELEMENTO, ELEMENTO_POR_DEFECTO.tipo),
  texto: sanearTexto(elemento.texto, ELEMENTO_POR_DEFECTO.texto),
  url: sanearUrlImagen(elemento.url),
  x: acotar(elemento.x, LIMITES.posicion, ELEMENTO_POR_DEFECTO.x),
  y: acotar(elemento.y, LIMITES.posicion, ELEMENTO_POR_DEFECTO.y),
  ancho: acotar(elemento.ancho, LIMITES.ancho, ELEMENTO_POR_DEFECTO.ancho),
  tamano: acotar(elemento.tamano, LIMITES.tamano, ELEMENTO_POR_DEFECTO.tamano),
  color: sanearColor(elemento.color, ELEMENTO_POR_DEFECTO.color),
  alto: acotar(elemento.alto, LIMITES.alto, ELEMENTO_POR_DEFECTO.alto),
  colorSecundario: sanearColor(elemento.colorSecundario, ELEMENTO_POR_DEFECTO.colorSecundario),
  alineacion: enLista(elemento.alineacion, ALINEACIONES, ELEMENTO_POR_DEFECTO.alineacion),
  forma: enLista(elemento.forma, FORMAS, ELEMENTO_POR_DEFECTO.forma),
  grosor: acotar(elemento.grosor, LIMITES.grosor, ELEMENTO_POR_DEFECTO.grosor),
  radio: acotar(elemento.radio, LIMITES.radio, ELEMENTO_POR_DEFECTO.radio),
  negrita: Boolean(elemento.negrita),
  cursiva: Boolean(elemento.cursiva),
  subrayado: Boolean(elemento.subrayado),
  efecto: efectoDe(elemento),
  capa: Math.round(acotar(elemento.capa, LIMITES.capa, ELEMENTO_POR_DEFECTO.capa)),
  // Un elemento bloqueado se ve igual: lo que no se puede es moverlo sin querer
  // mientras se coloca lo de al lado.
  bloqueado: Boolean(elemento.bloqueado),
  // El enlace pasa por el mismo filtro que las imagenes: del propio sitio o
  // `https`. Un `javascript:` en la portada seria un agujero para todos.
  enlace: sanearUrlImagen(elemento.enlace),
  comoBoton: Boolean(elemento.comoBoton),
  desde: sanearFecha(elemento.desde),
  hasta: sanearFecha(elemento.hasta),
  formatoCuenta: enLista(
    elemento.formatoCuenta,
    IDS_DE_FORMATO_CUENTA,
    ELEMENTO_POR_DEFECTO.formatoCuenta
  ),
  // Lo que va delante del reloj: "Termina en", "Quedan"… En blanco, solo el
  // reloj, que es lo que se quiere cuando el cartel de al lado ya lo explica.
  prefijoCuenta: sanearTexto(elemento.prefijoCuenta, ''),
  // El parpadeo se mide en segundos por latido. Muy rapido deja de leerse y
  // ademas molesta de verdad, asi que el rango es corto por los dos lados.
  velocidad: acotar(elemento.velocidad, LIMITES.velocidad, ELEMENTO_POR_DEFECTO.velocidad),
});

export const sanearFondo = (fondo = {}) => ({
  tipo: enLista(fondo.tipo, FONDOS, FONDO_POR_DEFECTO.tipo),
  color: sanearColor(fondo.color, FONDO_POR_DEFECTO.color),
  colorSecundario: sanearColor(fondo.colorSecundario, FONDO_POR_DEFECTO.colorSecundario),
  angulo: acotar(fondo.angulo, LIMITES.angulo, FONDO_POR_DEFECTO.angulo),
  opacidad: acotar(fondo.opacidad, LIMITES.opacidad, FONDO_POR_DEFECTO.opacidad),
});

/** El diseño completo, con todo dentro de rango. Nunca lanza: es la portada. */
export const sanearDiseno = (diseno = {}) => ({
  activo: Boolean(diseno?.activo),
  altura: acotar(diseno?.altura, LIMITES.altura, DISENO_POR_DEFECTO.altura),
  fondo: sanearFondo(diseno?.fondo),
  // El tope de elementos no es decorativo: cada uno es un nodo que se pinta en
  // la pantalla de todos los que entran a la tienda.
  elementos: (Array.isArray(diseno?.elementos) ? diseno.elementos : [])
    .slice(0, LIMITES.elementos)
    .map(sanearElemento),
});

// ----------------------------------------------------------------------
// La semilla: el encabezado que ya existe, hecho piezas.
// ----------------------------------------------------------------------

/**
 * El diseño con el que se abre el editor la primera vez.
 *
 * NO SE EMPIEZA EN BLANCO. Quien pulsa "Avanzados" quiere mover lo que esta
 * viendo, no volver a escribirlo: se colocan el escudo y los mismos textos —con
 * el mismo orden y parecido tamaño— en las posiciones que ya ocupaban, segun la
 * disposicion que estuviera puesta.
 */
export const disenoDesdeEncabezado = (encabezado = {}, { logoUrl = LOGO_POR_DEFECTO } = {}) => {
  const franja = String(encabezado?.disposicion || '') === 'franja';
  const conFoto = !!String(encabezado?.fotoUrl || '').trim();

  const elementos = [
    // El escudo, en su esquina de siempre.
    crearElemento({ tipo: 'imagen', url: logoUrl, x: 2, y: 22, ancho: 6 }),
    crearElemento({ texto: 'TIENDA OFICIAL', x: 10, y: 18, ancho: 30, tamano: 12 }),
    crearElemento({
      texto: encabezado?.titulo || '',
      x: 10,
      y: 32,
      ancho: 45,
      tamano: 34,
      negrita: true,
    }),
  ];

  if (franja) {
    elementos.push(
      crearElemento({ texto: encabezado?.pieTitulo || '', x: 10, y: 62, ancho: 30, tamano: 12 }),
      crearElemento({
        texto: encabezado?.subtitulo || '',
        x: 58,
        y: 36,
        ancho: 34,
        tamano: 18,
        cursiva: true,
      })
    );
  } else {
    elementos.push(
      crearElemento({
        texto: encabezado?.subtitulo || '',
        x: 10,
        y: 62,
        ancho: 45,
        tamano: 16,
        cursiva: true,
      })
    );
  }

  return sanearDiseno({
    activo: true,
    altura: DISENO_POR_DEFECTO.altura,
    // Con foto, un velo que la deje ver; sin foto, el mismo degradado verde de
    // la portada de siempre, para que encender el editor no cambie el aspecto.
    fondo: conFoto
      ? {
          tipo: 'degradado',
          color: '#000000',
          colorSecundario: '#212B36',
          angulo: 135,
          opacidad: 0.62,
        }
      : FONDO_POR_DEFECTO,
    // Los textos vacios no se colocan: dejarian un recuadro invisible que
    // estorba al arrastrar.
    elementos: elementos.filter(
      (elemento) => elemento.tipo === 'imagen' || elemento.texto !== ELEMENTO_POR_DEFECTO.texto
    ),
  });
};

/** Un elemento nuevo, colocado donde se pidio y con lo demas por defecto. */
export const crearElemento = (parcial = {}) =>
  sanearElemento({ ...ELEMENTO_POR_DEFECTO, ...parcial, id: nuevoIdDeElemento() });

// ----------------------------------------------------------------------
// De modelo a CSS.
// ----------------------------------------------------------------------

const conOpacidad = (color, opacidad) => {
  // "Sin color" se queda sin color. La opacidad de la capa lo convertia en un
  // negro a medias: bajar el velo del fondo hacia aparecer un gris donde se
  // habia pedido que no hubiera nada.
  if (esSinColor(color)) return color;

  if (opacidad >= 1) return color;

  const canal = Math.round(Math.min(1, Math.max(0, opacidad)) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

  // Se respeta el alfa que ya trajera el color: se sustituye, no se apila.
  return `${color.slice(0, 7)}${canal}`;
};

/**
 * La capa de fondo, en `background-image`.
 *
 * Se devuelve SIEMPRE como imagen —tambien el color plano, con un degradado de
 * un solo color— para que la foto de la portada, si la hay, pueda ir debajo en
 * la misma propiedad sin dos caminos distintos de pintado.
 */
export const fondoACss = (fondo) => {
  const { tipo, color, colorSecundario, angulo, opacidad } = sanearFondo(fondo);
  const principal = conOpacidad(color, opacidad);

  if (tipo === 'degradado') {
    return `linear-gradient(${angulo}deg, ${principal} 0%, ${conOpacidad(colorSecundario, opacidad)} 100%)`;
  }

  if (tipo === 'sombra') {
    // Una viñeta: el centro se deja ver y los bordes se cierran. Sirve para
    // posar texto claro sobre una foto sin apagarla entera.
    return `radial-gradient(circle at 50% 50%, ${conOpacidad(color, opacidad * 0.35)} 0%, ${conOpacidad(colorSecundario, opacidad)} 100%)`;
  }

  return `linear-gradient(0deg, ${principal} 0%, ${principal} 100%)`;
};

/**
 * El tamaño de letra, en pixeles del LIENZO DE DISEnO.
 *
 * Antes se pintaba con `clamp(... vw ...)` para que el texto encogiera con la
 * ventana. Encogia el texto, si, pero solo el texto: las imagenes iban en
 * porcentaje del ancho y las posiciones tambien, mientras el alto del
 * encabezado estaba fijo en pixeles. Tres reglas distintas para tres cosas que
 * tienen que moverse juntas, y por eso al estrechar la ventana el diseño se
 * descuadraba en vez de hacerse pequeño.
 *
 * Ahora manda una sola: TODO se mide sobre un lienzo de 1200 x altura, y el
 * lienzo entero se encoge para caber en el ancho que haya (ver
 * `HeaderVisualCanvas`). Lo que se ve en un monitor y lo que se ve en un
 * telefono son la misma imagen a dos tamaños.
 */
export const tamanoACss = (tamano) =>
  `${acotar(tamano, LIMITES.tamano, ELEMENTO_POR_DEFECTO.tamano)}px`;

/** Los estilos de un texto del diseño, ya acotados. */
export const elementoACss = (elemento) => {
  const seguro = sanearElemento(elemento);

  if (seguro.tipo === 'imagen') {
    return {
      left: `${seguro.x}%`,
      top: `${seguro.y}%`,
      width: `${seguro.ancho}%`,
    };
  }

  return {
    left: `${seguro.x}%`,
    top: `${seguro.y}%`,
    width: `${seguro.ancho}%`,
    color: seguro.color,
    fontSize: tamanoACss(seguro.tamano),
    fontWeight: seguro.negrita ? 700 : 400,
    fontStyle: seguro.cursiva ? 'italic' : 'normal',
    textDecoration: seguro.subrayado ? 'underline' : 'none',
    textAlign: seguro.alineacion,
    // UNA PROMOCION NO SE PARTE EN SILABAS. "¡Oferta!" en un bloque estrecho
    // salia como "¡Ofert / a!": el texto corto se queda en una linea y, si no
    // cabe, se sale del bloque en vez de romperse.
    ...(esEfectoDeColor(seguro.efecto) && {
      // El degradado se pinta en el propio texto: hace falta recortarlo a las
      // letras, y el color transparente para que se vea por debajo.
      backgroundImage: `linear-gradient(${seguro.efecto === 'colores-vertical' ? '180deg' : '90deg'}, ${seguro.color} 0%, ${seguro.colorSecundario} 50%, ${seguro.color} 100%)`,
      backgroundSize: seguro.efecto === 'colores-vertical' ? '100% 200%' : '200% 100%',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      color: 'transparent',
    }),
  };
};

/** El estilo de una linea o de una forma. */
export const figuraACss = (elemento) => {
  const seguro = sanearElemento(elemento);

  const base = {
    left: `${seguro.x}%`,
    top: `${seguro.y}%`,
    width: `${seguro.ancho}%`,
  };

  if (seguro.tipo === 'linea') {
    return { ...base, height: `${seguro.grosor}px`, backgroundColor: seguro.color };
  }

  return {
    ...base,
    height: `${seguro.alto}%`,
    backgroundColor: seguro.color,
    borderRadius: seguro.forma === 'circulo' ? '50%' : `${seguro.radio}px`,
  };
};

// ----------------------------------------------------------------------
// El movimiento.
// ----------------------------------------------------------------------

/**
 * La animacion del efecto elegido, lista para `sx`.
 *
 * SIEMPRE lleva su apagado por `prefers-reduced-motion`. No es un adorno
 * opcional: para quien tiene sensibilidad vestibular o migrañas, algo que late
 * en la cabecera de la pantalla es motivo para cerrarla. Al apagarse, el color
 * y el texto se quedan como estan —legibles—, solo deja de moverse.
 */
export const efectoACss = (elemento) => {
  const { efecto, velocidad } = sanearElemento(elemento);

  if (efecto === 'ninguno') return null;

  const sinMovimiento = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } };

  if (efecto === 'parpadeo') {
    return {
      '@keyframes efectoParpadeo': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
      animation: `efectoParpadeo ${velocidad}s steps(1, end) infinite`,
      ...sinMovimiento,
      '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 1 },
    };
  }

  if (efecto === 'neon') {
    const { colorSecundario } = sanearElemento(elemento);

    return {
      // El resplandor va en la SOMBRA del texto, no en su color: asi el texto
      // se lee igual de bien cuando la animacion esta apagada, que es el caso
      // de quien pidio menos movimiento.
      '@keyframes efectoNeon': {
        '0%, 100%': {
          textShadow: `0 0 4px ${colorSecundario}, 0 0 12px ${colorSecundario}`,
        },
        '50%': { textShadow: `0 0 2px ${colorSecundario}` },
      },
      textShadow: `0 0 4px ${colorSecundario}, 0 0 12px ${colorSecundario}`,
      animation: `efectoNeon ${velocidad * 1.4}s ease-in-out infinite`,
      ...sinMovimiento,
    };
  }

  if (efecto === 'pulso') {
    return {
      // El pulso NO parpadea: crece y respira. Es el que se pone cuando hay que
      // llamar la atencion sin que la portada se vuelva un semaforo.
      '@keyframes efectoPulso': {
        '0%, 100%': { transform: 'scale(1)', opacity: 0.9 },
        '50%': { transform: 'scale(1.06)', opacity: 1 },
      },
      transformOrigin: 'left center',
      animation: `efectoPulso ${velocidad * 1.6}s ease-in-out infinite`,
      ...sinMovimiento,
    };
  }

  // Los tres de color mueven el degradado por debajo de las letras. El vertical
  // va y vuelve (`alternate`), que es lo que se lee como "en ambos sentidos".
  const recorrido = efecto === 'colores-vertical' ? '0 200%' : '200% 0';

  return {
    '@keyframes efectoColores': {
      '0%': { backgroundPosition: '0 0' },
      '100%': { backgroundPosition: recorrido },
    },
    animation: `efectoColores ${velocidad * 2}s linear infinite${
      efecto === 'colores-izquierda' ? ' reverse' : ''
    }${efecto === 'colores-vertical' ? ' alternate' : ''}`,
    ...sinMovimiento,
  };
};

// ----------------------------------------------------------------------
// Cuando se ve cada cosa, y en que orden.
// ----------------------------------------------------------------------

/**
 * Si un elemento toca estar en pantalla ahora mismo.
 *
 * Sin fechas, siempre. Con fechas, dentro del rango: `desde` incluido y `hasta`
 * excluido, que es como se lee "hasta el viernes". Una promocion caducada NO se
 * borra —se puede volver a usar el año que viene—, simplemente deja de pintarse.
 */
export const estaVigente = (elemento, ahora = Date.now()) => {
  const { desde, hasta } = sanearElemento(elemento);
  const momento = new Date(ahora).getTime();

  if (desde && momento < new Date(desde).getTime()) return false;
  if (hasta && momento >= new Date(hasta).getTime()) return false;

  return true;
};

/**
 * Los elementos que se pintan, ya ordenados por capa.
 *
 * El orden es estable: a igual capa manda quien se creo antes. Sin esto, dos
 * elementos en la misma capa se intercambiaban al guardar y el diseño cambiaba
 * solo.
 */
export const elementosVisibles = (diseno, ahora = Date.now(), { todos = false } = {}) =>
  sanearDiseno(diseno)
    .elementos.map((elemento, indice) => ({ elemento, indice }))
    .filter(({ elemento }) => todos || estaVigente(elemento, ahora))
    .sort((uno, otro) => uno.elemento.capa - otro.elemento.capa || uno.indice - otro.indice)
    .map(({ elemento }) => elemento);

// ----------------------------------------------------------------------
// La cuenta regresiva.
// ----------------------------------------------------------------------

/** Lo que falta hasta `hasta`, en piezas. Nunca negativo. */
export const tiempoRestante = (hasta, ahora = Date.now()) => {
  const fecha = sanearFecha(hasta);
  const faltan = fecha ? new Date(fecha).getTime() - new Date(ahora).getTime() : 0;

  if (!fecha || faltan <= 0) {
    return { dias: 0, horas: 0, minutos: 0, segundos: 0, terminado: true };
  }

  const segundosTotales = Math.floor(faltan / 1000);

  return {
    dias: Math.floor(segundosTotales / 86400),
    horas: Math.floor((segundosTotales % 86400) / 3600),
    minutos: Math.floor((segundosTotales % 3600) / 60),
    segundos: segundosTotales % 60,
    terminado: false,
  };
};

const doble = (numero) => String(numero).padStart(2, '0');

/**
 * La cuenta, escrita.
 *
 * `compacto` es el de siempre: los dias solo aparecen cuando quedan, porque
 * "00d 02:14:07" hace pensar que falta mucho mas de lo que falta. `reloj`
 * vuelca los dias en las horas —util cuando lo que se quiere subrayar es la
 * urgencia— y `palabras` se lee sin descifrar, para campañas largas.
 */
export const formatearCuenta = (restante, textoFinal = '¡Terminó!', formato = 'compacto') => {
  if (restante.terminado) return textoFinal;

  const { dias, horas, minutos, segundos } = restante;

  if (formato === 'palabras') {
    const piezas = [
      dias > 0 && `${dias} ${dias === 1 ? 'día' : 'días'}`,
      (dias > 0 || horas > 0) && `${horas} h`,
      `${minutos} min`,
      // Los segundos solo cuando ya no queda casi nada: en una campaña de tres
      // semanas son ruido que ademas obliga a repintar cada segundo.
      dias === 0 && horas === 0 && `${segundos} s`,
    ].filter(Boolean);

    return piezas.join(', ');
  }

  if (formato === 'reloj') {
    return `${doble(dias * 24 + horas)}:${doble(minutos)}:${doble(segundos)}`;
  }

  const reloj = `${doble(horas)}:${doble(minutos)}:${doble(segundos)}`;

  return dias > 0 ? `${dias}d ${reloj}` : reloj;
};
