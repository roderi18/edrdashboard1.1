// ----------------------------------------------------------------------

export const themeConfig = {
  /** **************************************
   * Base
   *************************************** */
  // El telefono manda mientras nadie diga lo contrario: 'system' engancha el
  // tema a `prefers-color-scheme`, que en el movil es el ajuste de oscuro del
  // sistema, y lo sigue en vivo. Quien lo fije a mano desde Ajustes gana.
  defaultMode: 'system',
  modeStorageKey: 'theme-mode',
  direction: 'ltr',
  classesPrefix: 'minimal',
  /** **************************************
   * Css variables
   *************************************** */
  cssVariables: {
    cssVarPrefix: '',
    colorSchemeSelector: 'data-color-scheme',
  },
  /** **************************************
   * Typography
   *************************************** */
  fontFamily: {
    primary: 'Public Sans Variable',
    secondary: 'Barlow',
  },
  /** **************************************
   * Palette
   *************************************** */
  // LA PALETA DE LA CASA.
  //
  // Hasta aqui era la de la plantilla —verde `#00A76F`, morado, cian— y no decia
  // nada de Exploradores del Rey. Ahora sale del escudo: azul institucional y oro.
  //
  // CINCO PARADAS POR FAMILIA, no una. `createPaletteChannel` y todas las
  // variantes de `Label`, `Button` y `Chip` leen de `lighter` a `darker`: dar solo
  // el `main` deja el tema a medias y MUI se inventa lo que falta.
  //
  // `contrastText` es un campo, no un adorno: es el texto que va ENCIMA de ese
  // tono y MUI se lo cree sin comprobarlo. Los dos tonos claros —el ambar de
  // `warning` y el oro de marca— piden texto oscuro; el resto, blanco. Al reves
  // quedan botones ilegibles y nada avisa.
  palette: {
    // AZUL INSTITUCIONAL, no azul de pantalla. El primer intento fue el azul
    // saturado de las interfaces modernas (`#2563EB`): sobre el navy del escudo
    // salia seco y duro, con demasiada luz y demasiado croma al lado de un fondo
    // grave. Este esta bajado en las dos cosas y acercado al navy: se separa con
    // holgura pero pertenece a la misma familia.
    primary: {
      lighter: '#DDE7F6',
      light: '#7A9BD4',
      main: '#1F4FA6',
      dark: '#183E82',
      darker: '#0E2550',
      contrastText: '#FFFFFF',
    },
    // El morado acompaña: formacion y capacitacion. No es el oro del escudo a
    // proposito —ver `brand` mas abajo—.
    secondary: {
      lighter: '#EFE6FE',
      light: '#B794F6',
      main: '#7C3AED',
      dark: '#5B21B6',
      darker: '#3B1178',
      contrastText: '#FFFFFF',
    },
    // VERDE AZULADO, NO CIAN. Era `#00B8D9`, y con el primario en verde se leia
    // como otra cosa; con el primario en AZUL pasaba a ser "azul un poco mas
    // claro" y el ojo dejaba de separarlos. Ese cian ya se colo dos veces donde
    // tocaba el color de la casa, y eso fue con un primario que no se le parecia
    // en nada. Se aleja del azul sin irse al verde de `success`.
    info: {
      lighter: '#CDF3EE',
      light: '#5FCFBF',
      main: '#0E9384',
      dark: '#0A6B60',
      darker: '#05403A',
      contrastText: '#FFFFFF',
    },
    success: {
      lighter: '#D8F5E2',
      light: '#5FD98A',
      main: '#16A34A',
      dark: '#0E7A37',
      darker: '#074D22',
      contrastText: '#FFFFFF',
    },
    warning: {
      lighter: '#FEF3D4',
      light: '#FBCF63',
      main: '#F59E0B',
      dark: '#B26D05',
      darker: '#734402',
      contrastText: '#1C252E',
    },
    error: {
      lighter: '#FFE2E2',
      light: '#FF9A94',
      main: '#E5484D',
      dark: '#AF1D28',
      darker: '#6E0A14',
      contrastText: '#FFFFFF',
    },
    // EL GRIS LLEVA SESGO AZUL. Un gris puro al lado de un primario azul se ve
    // sucio: no es neutro respecto a el, es un azul apagado que no cuadra. Este
    // esta girado hacia el azul lo justo para asentarse, sin llegar a leerse como
    // un color.
    grey: {
      50: '#FBFCFE',
      100: '#F7F9FC',
      200: '#EDF2F9',
      300: '#DCE4EF',
      400: '#B9C5D8',
      500: '#8A9AB2',
      600: '#5B6C86',
      700: '#3E4E68',
      800: '#1B2942',
      900: '#0D1626',
    },
    // ----------------------------------------------------------------
    // MOBILIARIO DE MARCA, FUERA DE LAS SEIS FAMILIAS.
    //
    // El navy y el oro del escudo NO son acentos semanticos: no distinguen un
    // estado de otro, identifican a la organizacion. Van aparte por dos razones
    // concretas:
    //
    //   - El oro `#C9A227` y el ambar de `warning` son el mismo color para quien
    //     no los tenga uno al lado del otro. Si el oro fuera `secondary`, un aviso
    //     de atencion dejaria de leerse como aviso.
    //   - El preset del engranaje cambia `primary` y `secondary`. El escudo no
    //     cambia con un ajuste de usuario.
    //
    // Se usan en la barra lateral, la portada y la pantalla Principal.
    // ----------------------------------------------------------------
    //
    // Planas y no anidadas (`navy`, no `navy.main`) para que `palette.brand.navy`
    // sea un color y no un objeto: la barra lateral y la pantalla Principal lo
    // usan tal cual, y anidarlo obligaria a escribir `.main` en cada sitio.
    brand: {
      navyLighter: '#33507E',
      navyLight: '#13294D',
      navy: '#0B1B36',
      navyDark: '#071228',
      navyDarker: '#040B18',
      oroLighter: '#FBF0CE',
      oroLight: '#E8C765',
      oro: '#C9A227',
      oroDark: '#96751A',
      oroDarker: '#614A0F',
    },
    common: {
      black: '#000000',
      white: '#FFFFFF',
    },
  },
};
