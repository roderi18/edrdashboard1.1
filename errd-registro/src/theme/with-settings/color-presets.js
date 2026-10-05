import { primary, secondary } from '../core/palette';

// ----------------------------------------------------------------------
// LOS PRESETS DEL ENGRANAJE, TODOS DE LA CASA.
//
// Antes eran los cinco de la plantilla: cian, morado, naranja, rojo y un azul
// ajeno. Cinco colores de fuera en el selector invitan a elegir uno que rompe la
// identidad, y quien lo elige no esta haciendo nada raro: estan ahi para eso.
//
// Ahora los cinco salen del escudo. Se puede cambiar el acento sin que la
// aplicacion deje de parecer Exploradores del Rey.
//
//   default   Azul cielo: el azul de la casa subido de luz. Es el que trae la
//             aplicacion puesta. Estaba en el segundo puesto y de adorno; se
//             cambio por el institucional porque es el que se lee mejor sobre el
//             navy de la barra y la cabecera, que es donde vive el acento.
//   preset1   El azul institucional de `theme-config.js`, ahora en el segundo
//             puesto. Quien lo prefiera lo tiene a un clic.
//   preset2   Navy: el acento se funde con el escudo. El mas sobrio.
//   preset3   Oro. OJO: es el unico con `contrastText` oscuro (ver abajo).
//   preset4   Verde ER, para quien venia del verde de antes y lo echa de menos.
//   preset5   Granate, para campañas y eventos.
//
// CADA UNO CON SUS CINCO PARADAS. `Label`, `Button` y `Chip` leen de `lighter` a
// `darker`: un preset que solo diera el `main` dejaria las etiquetas suaves y los
// botones con hover del color anterior.
//
// Y CADA UNO CON SU `contrastText` COMPROBADO. Es el texto que va encima y MUI se
// lo cree sin verificarlo: el oro es claro y pide texto oscuro; el resto, blanco.
// Al reves quedan botones ilegibles y nada avisa.
// ----------------------------------------------------------------------

export const primaryColorPresets = {
  // Azul cielo. El de por defecto.
  default: {
    lighter: '#D7E9FB',
    light: '#6FAEEB',
    main: '#1C74D4',
    dark: '#14549C',
    darker: '#0B3163',
    contrastText: '#FFFFFF',
  },
  // El azul institucional, el de `theme-config.js`.
  preset1: {
    lighter: primary.lighter,
    light: primary.light,
    main: primary.main,
    dark: primary.dark,
    darker: primary.darker,
    contrastText: primary.contrastText,
  },
  // Navy del escudo.
  preset2: {
    lighter: '#D5DDEA',
    light: '#6B82A8',
    main: '#1B3A6B',
    dark: '#122A4F',
    darker: '#0B1B36',
    contrastText: '#FFFFFF',
  },
  // Oro institucional. El unico con texto oscuro encima.
  preset3: {
    lighter: '#FBF0CE',
    light: '#E8C765',
    main: '#C9A227',
    dark: '#96751A',
    darker: '#614A0F',
    contrastText: '#1C252E',
  },
  // Verde ER.
  preset4: {
    lighter: '#D8F5E2',
    light: '#5FD98A',
    main: '#16A34A',
    dark: '#0E7A37',
    darker: '#074D22',
    contrastText: '#FFFFFF',
  },
  // Granate.
  preset5: {
    lighter: '#F8DCDF',
    light: '#D98A93',
    main: '#A62639',
    dark: '#7C1A29',
    darker: '#4F0D18',
    contrastText: '#FFFFFF',
  },
};

// ----------------------------------------------------------------------
// EL SECUNDARIO VIAJA CON EL PRIMARIO.
//
// Esta tabla existia desde siempre pero `update-core.js` la tenia COMENTADA, asi
// que el secundario no se movia nunca: se elegia el preset naranja y los botones
// secundarios seguian morados. Cada pareja esta elegida para acompañar a su
// primario, no para competir con el.
// ----------------------------------------------------------------------

export const secondaryColorPresets = {
  // Azul cielo → oro: el contraste clasico del escudo. Va con el primario de por
  // defecto, asi que se intercambio con el de abajo cuando ellos se cambiaron.
  default: {
    lighter: '#FBF0CE',
    light: '#E8C765',
    main: '#C9A227',
    dark: '#96751A',
    darker: '#614A0F',
    contrastText: '#1C252E',
  },
  // El que acompaña al azul institucional.
  preset1: {
    lighter: secondary.lighter,
    light: secondary.light,
    main: secondary.main,
    dark: secondary.dark,
    darker: secondary.darker,
    contrastText: secondary.contrastText,
  },
  // Navy → oro, por la misma razon y con mas motivo.
  preset2: {
    lighter: '#FBF0CE',
    light: '#E8C765',
    main: '#C9A227',
    dark: '#96751A',
    darker: '#614A0F',
    contrastText: '#1C252E',
  },
  // Oro → navy. Al reves que el anterior: con el oro de acento, el que acompaña
  // tiene que ser el grave.
  preset3: {
    lighter: '#D5DDEA',
    light: '#6B82A8',
    main: '#1B3A6B',
    dark: '#122A4F',
    darker: '#0B1B36',
    contrastText: '#FFFFFF',
  },
  // Verde → azul de la casa.
  preset4: {
    lighter: '#DDE7F6',
    light: '#7A9BD4',
    main: '#1F4FA6',
    dark: '#183E82',
    darker: '#0E2550',
    contrastText: '#FFFFFF',
  },
  // Granate → oro.
  preset5: {
    lighter: '#FBF0CE',
    light: '#E8C765',
    main: '#C9A227',
    dark: '#96751A',
    darker: '#614A0F',
    contrastText: '#1C252E',
  },
};
